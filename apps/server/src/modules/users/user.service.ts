import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, StudySetVisibility, User } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as bcrypt from 'bcrypt';
import { LoggerService } from 'src/common/logger/logger.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UserStatus } from 'src/common/interfaces/user.interface';
import { slugify } from 'src/common/utils/sligify';
import { Role } from 'src/common/decorators/roles.decorator';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  SEARCH_SYNC_QUEUE,
  SearchSyncJob,
  SearchSyncJobPayload,
} from 'src/common/queue/queue.constants';

export interface DeletedAccount {
  user: User;
  /** Storage key of the avatar that was detached, for the caller to remove. */
  removedProfilePicture: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    @InjectQueue(SEARCH_SYNC_QUEUE)
    private readonly searchSyncQueue: Queue<SearchSyncJobPayload>,
  ) {}

  async create(userDto: CreateUserDto): Promise<User> {
    return await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: userDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const username = await this.allocateUsername(
        userDto.name || userDto.email,
      );
      const hashed = userDto.password
        ? await bcrypt.hash(userDto.password, 10)
        : userDto.password;

      return tx.user.create({
        data: {
          email: userDto.email,
          username,
          displayName: userDto.name?.trim() || null,
          password: hashed,
          status: userDto.status ?? 'active',
          role: userDto.role ?? Role.USER,
        },
      });
    });
  }

  private async allocateUsername(
    baseInput: string,
    excludeUserId?: string,
  ): Promise<string> {
    const base =
      slugify(
        baseInput.includes('@') ? baseInput.split('@')[0] : baseInput,
        28,
      ) || 'user';
    let candidate = base;
    for (let i = 0; i < 10_000; i++) {
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
      });
      if (!existing || existing.id === excludeUserId) {
        return candidate;
      }
      candidate = `${base.slice(0, 18)}${i + 2}`;
    }
    return `${base}-${Date.now()}`;
  }

  /** Fills `username` for rows created before the username column existed */
  private async ensureUsernameBackfill(user: User): Promise<User> {
    if (user.username != null && user.username !== '') {
      return user;
    }
    const username = await this.allocateUsername(user.email, user.id);
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        username,
      },
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filter?: { status?: UserStatus },
  ) {
    const where: Prisma.UserWhereInput = filter?.status
      ? { status: filter.status }
      : {};

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return null;
    }
    return this.ensureUsernameBackfill(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.ensureUsernameBackfill(user);
  }

  /**
   * Narrow-write self-service update used by PATCH /users/me.
   *
   * Only the user-visible profile fields (name, bio) are writable here.
   * `name` is the display name; it never renames `username`, which stays
   * stable so profile URLs and mentions don't break.
   * role / status / email / profilePicture are deliberately not in the
   * input DTO and not handled here — they belong to admin, the
   * email-change flow, and the avatar upload endpoint respectively.
   */
  async updateMyProfile(
    id: string,
    dto: {
      name?: string;
      bio?: string;
      timezone?: string;
      preferredLanguage?: string;
    },
  ): Promise<User> {
    const existing = await this.findById(id);
    const patch: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      patch.displayName = dto.name.trim();
    }
    if (dto.bio !== undefined) {
      patch.bio = dto.bio;
    }
    if (dto.timezone !== undefined) {
      patch.timezone = dto.timezone;
    }
    if (dto.preferredLanguage !== undefined) {
      patch.preferredLanguage = dto.preferredLanguage;
    }

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    return this.prisma.user.update({
      where: { id },
      data: patch,
    });
  }

  /** Set just the profilePicture URL — called from the avatar upload endpoint. */
  async setProfilePicture(id: string, url: string | null): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { profilePicture: url },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const existing = await this.findById(id);
    const patch: Prisma.UserUpdateInput = {};

    if (updateUserDto.email !== undefined) patch.email = updateUserDto.email;
    if (updateUserDto.name !== undefined) {
      patch.username = await this.allocateUsername(updateUserDto.name, id);
    }
    if (updateUserDto.status !== undefined) patch.status = updateUserDto.status;
    if (updateUserDto.role !== undefined) {
      patch.role = updateUserDto.role;
    }
    if (updateUserDto.profilePicture !== undefined) {
      patch.profilePicture = updateUserDto.profilePicture;
    }

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    return this.prisma.user.update({
      where: { id },
      data: patch,
    });
  }

  /**
   * Soft-deletes an account (SRS FR-USER-05, §9.6). The row stays so study
   * history, comments and FK references remain intact, but the account is
   * anonymised and can never sign in again:
   *  - status=deleted, email/username replaced with `deleted_<id>` values
   *  - password replaced, Google link, avatar and bio cleared
   *  - owned sets made private (and dropped from search)
   *  - every session revoked, pending magic links removed
   */
  async delete(id: string): Promise<DeletedAccount> {
    const existing = await this.findById(id);
    const tag = randomUUID().replace(/-/g, '').slice(0, 12);
    const unusablePassword = await bcrypt.hash(randomUUID(), 10);

    const { user, unpublishedSetIds } = await this.prisma.$transaction(
      async (tx) => {
        const published = await tx.studySet.findMany({
          where: {
            ownerId: id,
            visibility: { not: StudySetVisibility.PRIVATE },
          },
          select: { id: true },
        });
        await tx.studySet.updateMany({
          where: { ownerId: id },
          data: { visibility: StudySetVisibility.PRIVATE },
        });
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.magicLink.deleteMany({ where: { userId: id } });

        const user = await tx.user.update({
          where: { id },
          data: {
            status: UserStatus.DELETED,
            email: `deleted_${tag}@deleted.local`,
            username: `deleted_${tag}`,
            displayName: null,
            password: unusablePassword,
            googleProviderId: null,
            profilePicture: null,
            bio: null,
            emailVerified: false,
          },
        });

        return { user, unpublishedSetIds: published.map((s) => s.id) };
      },
    );

    // After commit: the index workers read Postgres, so they must see the
    // sets as private. Same jobId scheme as SearchSyncService.enqueueDelete.
    await Promise.all(
      unpublishedSetIds.map((setId) =>
        this.searchSyncQueue.add(
          SearchSyncJob.DELETE_SET,
          { setId },
          { jobId: `delete-${setId}` },
        ),
      ),
    );

    this.logger.log(
      `Account soft-deleted: userId=${id}, setsUnpublished=${unpublishedSetIds.length}`,
    );

    return { user, removedProfilePicture: existing.profilePicture ?? null };
  }

  async updatePassword(id: string, newPassword: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
  }

  async changePassword(
    id: string,
    {
      oldPassword,
      confirmPassword,
      newPassword,
    }: {
      oldPassword: string;
      confirmPassword: string;
      newPassword: string;
    },
  ): Promise<{
    ok: boolean;
    message: string;
    data: User | null;
  }> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException({
        ok: false,
        message: 'User not found',
      });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new HttpException(
        {
          ok: false,
          message: 'Old password is incorrect',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (newPassword !== confirmPassword) {
      throw new ConflictException({
        ok: false,
        message: 'New password and confirm password do not match',
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const saved = await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    return {
      ok: true,
      message: 'Password updated successfully',
      data: saved,
    };
  }
}
