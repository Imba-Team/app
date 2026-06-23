import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { UpdateUserDto } from './dtos/update-user.dto';
import * as bcrypt from 'bcrypt';
import { LoggerService } from 'src/common/logger/logger.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UserStatus } from 'src/common/interfaces/user.interface';
import { slugify } from 'src/common/utils/sligify';
import { Role } from 'src/common/decorators/roles.decorator';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
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

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.ensureUsernameBackfill(user);
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

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.user.delete({ where: { id } });
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
