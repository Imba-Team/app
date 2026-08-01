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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiConsumes,
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
import { User } from '@prisma/client';
import { MediaService } from 'src/common/media/media.service';
import {
  AvatarPolicy,
  buildMulterOptions,
  MediaErrorCode,
  MediaValidationException,
  type UploadedMediaFile,
} from 'src/common/media';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly media: MediaService,
  ) {}

  /**
   * Serialise a raw Prisma `User` into the response DTO, resolving the
   * stored `profilePicture` (an object name — or legacy full URL — see
   * MediaService.resolveUrl) to an absolute URL the browser can fetch.
   *
   * Centralised here so every endpoint on this controller stays
   * consistent; no controller should hand back a raw `User` with the
   * stored object name in the profilePicture field.
   */
  private toDto(user: User | null | undefined): UserResponseDto | null {
    if (!user) return null;
    return plainToInstance(
      UserResponseDto,
      { ...user, profilePicture: this.media.resolveUrl(user.profilePicture) },
      { excludeExtraneousValues: true },
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkEnvelope(UserResponseDto, {
    description: 'User profile returned successfully',
  })
  async getMe(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<UserResponseDto>> {
    const foundUser = await this.usersService.findByEmail(user.email);
    return {
      ok: true,
      message: 'User profile returned successfully',
      data: this.toDto(foundUser) as UserResponseDto,
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
      data: this.toDto(updatedUser),
    };
  }

  @Patch('me/profile-picture')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', buildMulterOptions(AvatarPolicy)),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: "Upload / update user's profile picture" })
  @ApiOkEnvelope(UserResponseDto, {
    description: 'Profile picture updated successfully',
  })
  async uploadProfilePicture(
    @CurrentUser() user: IUser,
    @UploadedFile() file: UploadedMediaFile | undefined,
  ): Promise<ResponseDto<UserResponseDto | null>> {
    if (!file) {
      throw new MediaValidationException(
        MediaErrorCode.MISSING_FILE,
        'File is required',
      );
    }

    // 1. Validate + normalise (sharp: strip EXIF, resize to 512, WebP).
    //    On failure the storage layer is never touched.
    const uploaded = await this.media.uploadAvatar(
      user.id,
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // 2. Read the previous stored value so we can delete the old blob
    //    on success. Best-effort — a stale object costs a few KB and
    //    we'd rather ship the new avatar than roll back on cleanup fail.
    // We persist the absolute public URL rather than the raw object
    // name, so downstream code that reads `user.profilePicture` (study-
    // set cards, comments) can render it directly without knowing about
    // the storage layout. MediaService.resolveUrl on read is still a
    // safe passthrough for absolute URLs.
    const before = await this.usersService.findById(user.id);
    const updatedUser = await this.usersService.setProfilePicture(
      user.id,
      uploaded.url,
    );
    if (before.profilePicture && before.profilePicture !== uploaded.url) {
      await this.media.delete(before.profilePicture);
    }

    return {
      ok: true,
      message: 'Profile picture updated successfully',
      data: this.toDto(updatedUser),
    };
  }

  @Delete('me/profile-picture')
  @HttpCode(200)
  @ApiOperation({ summary: "Remove the current user's profile picture" })
  @ApiOkEnvelope(UserResponseDto, {
    description: 'Profile picture removed successfully',
  })
  async removeProfilePicture(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<UserResponseDto | null>> {
    const before = await this.usersService.findById(user.id);
    const updatedUser = await this.usersService.setProfilePicture(user.id, null);
    if (before.profilePicture) {
      await this.media.delete(before.profilePicture);
    }
    return {
      ok: true,
      message: 'Profile picture removed successfully',
      data: this.toDto(updatedUser),
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
    // Clean up the avatar object too — the DB row is gone, so nothing
    // else will ever reference it.
    if (deletedUser?.profilePicture) {
      await this.media.delete(deletedUser.profilePicture);
    }
    return {
      ok: true,
      message: 'User deleted successfully',
      data: this.toDto(deletedUser),
    };
  }
}

