import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { UsersService } from './user.service';
import { PublicProfileDto } from './dtos/public-profile.dto';

/**
 * Anonymous, read-only profile endpoint.
 *
 * Kept in a dedicated controller so the class-level @UseGuards on
 * UsersController (which forces JwtGuard + RolesGuard) does not apply.
 *
 * Route ordering: this controller MUST be declared after UsersController
 * in user.module.ts so that /users/me resolves to the authenticated
 * handler before the wildcard /users/:username could match "me".
 */
@ApiTags('Users')
@Controller('users')
export class PublicUserController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  @ApiOperation({ summary: 'Get a public user profile by username' })
  @ApiResponse({ status: 200, type: PublicProfileDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getByUsername(
    @Param('username') username: string,
  ): Promise<ResponseDto<PublicProfileDto>> {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new NotFoundException({
        ok: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return {
      ok: true,
      message: 'Profile retrieved',
      data: plainToInstance(PublicProfileDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }
}
