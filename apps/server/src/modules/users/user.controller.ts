import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  UseGuards,
  Delete,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './user.service';
import { UpdateMyProfileDto } from './dtos/update-my-profile.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiOkEnvelope } from 'src/common/decorators/api-envelope.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { StatusGuard } from 'src/guards/status.guard';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from './dtos/user-response.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { extname } from 'path';
import { ApiConsumes } from '@nestjs/swagger';
import { StorageService } from 'src/common/storage/storage.service';
import { StoragePrefix } from 'src/common/storage/storage.constants';
import * as crypto from 'crypto';

type MulterFile = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const avatarMulterOptions: multer.Options = {
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AVATAR_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      // multer 2.x signals rejection by throwing; calling cb(err, false)
      // is no longer accepted by the type signature.
      throw new BadRequestException(
        'Only image files are allowed (jpeg, png, gif, webp)',
      );
    }
  },
};

function cryptoRandomId(): string {
  // 8 hex chars is enough entropy for a per-user collision-free filename.
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Best-effort: parse the stored profile-picture URL back into the
 * MinIO object name so we can delete the previous file when a user
 * uploads a replacement. Returns the trailing path after `<bucket>/`.
 */
function extractObjectName(url: string): string {
  const slash = url.indexOf('/avatars/');
  if (slash >= 0) {
    return url.slice(slash + 1);
  }
  // Falls through for the old `/uploads/profile-pictures/...` URLs left
  // over from the pre-MinIO implementation — nothing to delete in MinIO
  // for those, so return a sentinel that storage.delete() will swallow.
  return url;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storage: StorageService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkEnvelope(UserResponseDto, {
    description: 'User profile returned successfully',
  })
  async getMe(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<UserResponseDto>> {
    const foundUser = await this.usersService.findByEmail(user.email);
    const data = plainToInstance(UserResponseDto, foundUser, {
      excludeExtraneousValues: true,
    });

    return {
      ok: true,
      message: 'User profile returned successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, StatusGuard)
  @Patch('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update current user' })
  @ApiOkEnvelope(UserResponseDto, { description: 'User updated successfully' })
  async updateMe(
    @CurrentUser() user: IUser,
    @Body() dto: UpdateMyProfileDto,
  ): Promise<ResponseDto<UserResponseDto | null>> {
    const updatedUser = await this.usersService.updateMyProfile(user.id, dto);

    return {
      ok: true,
      message: 'User updated successfully',
      data: updatedUser
        ? plainToInstance(UserResponseDto, updatedUser, {
            excludeExtraneousValues: true,
          })
        : null,
    };
  }

  @Patch('me/profile-picture')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', avatarMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: "Upload / update user's profile picture" })
  @ApiOkEnvelope(UserResponseDto, {
    description: 'Profile picture updated successfully',
  })
  async uploadProfilePicture(
    @CurrentUser() user: IUser,
    @UploadedFile() file: MulterFile,
  ): Promise<ResponseDto<UserResponseDto | null>> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!ALLOWED_AVATAR_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only image files are allowed (jpeg, png, gif, webp)',
      );
    }

    // Object key includes the userId so it's auditable + sorts by user
    // in MinIO console, but also a UUID so concurrent uploads from the
    // same user never collide.
    const ext = extname(file.originalname).toLowerCase();
    const result = await this.storage.upload({
      prefix: StoragePrefix.AVATARS,
      key: `${user.id}/${cryptoRandomId()}${ext}`,
      body: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    // Look up the previous URL so we can delete the old object after a
    // successful new upload. Best-effort — storage.delete() swallows
    // missing-object errors so this never blocks the request.
    const before = await this.usersService.findById(user.id);
    const updatedUser = await this.usersService.setProfilePicture(
      user.id,
      result.url,
    );
    if (before.profilePicture) {
      await this.storage.delete(extractObjectName(before.profilePicture));
    }

    return {
      ok: true,
      message: 'Profile picture updated successfully',
      data: plainToInstance(UserResponseDto, updatedUser, {
        excludeExtraneousValues: true,
      }),
    };
  }

  @Patch('me/change-password')
  @HttpCode(200)
  @UseGuards(JwtGuard, StatusGuard)
  @ApiOperation({ summary: 'Update current user password' })
  @ApiOkEnvelope(null, { description: 'Password updated successfully' })
  async updatePassword(
    @CurrentUser() user: IUser,
    @Body() data: ChangePasswordDto,
  ): Promise<ResponseDto<null>> {
    const result = await this.usersService.changePassword(user.id, data);
    return {
      ok: result.ok,
      message: result.message,
      data: null,
    };
  }

  @Delete('me')
  @HttpCode(200)
  @UseGuards(JwtGuard, StatusGuard)
  @ApiOperation({ summary: 'Delete current user' })
  @ApiOkEnvelope(UserResponseDto, { description: 'User deleted successfully' })
  async deleteMe(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<UserResponseDto | null>> {
    const deletedUser = await this.usersService.delete(user.id);
    return {
      ok: true,
      message: 'User deleted successfully',
      data: deletedUser
        ? plainToInstance(UserResponseDto, deletedUser, {
            excludeExtraneousValues: true,
          })
        : null,
    };
  }
}
