import {
  Controller,
  Get,
  UseGuards,
  Query,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './user.service';

import { UserStatus } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { User } from '@prisma/client';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    schema: {
      example: {
        ok: true,
        message: 'Users fetched successfully',
        data: {
          items: [{ id: 'uuid', email: 'user@example.com', status: 'ACTIVE' }],
          total: 50,
          page: 1,
          limit: 10,
        },
      },
    },
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: UserStatus,
  ): Promise<
    ResponseDto<{
      data: User[];
      total: number;
      page: number;
      limit: number;
    }>
  > {
    const users = await this.usersService.findAll(+page, +limit, { status });

    return {
      ok: true,
      message: 'Users fetched successfully',
      data: users,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    schema: {
      example: {
        ok: true,
        message: 'User fetched successfully',
        data: {
          id: 'uuid',
          email: 'user@example.com',
          status: 'ACTIVE',
        },
      },
    },
  })
  async findOne(@Param('id') id: string): Promise<ResponseDto<User>> {
    const user = await this.usersService.findById(id);

    return {
      ok: true,
      message: 'User fetched successfully',
      data: user,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiQuery({ name: 'status', enum: UserStatus, required: true })
  @ApiResponse({
    status: 200,
    description: 'User updated',
    schema: {
      example: {
        ok: true,
        message: 'User updated successfully',
        data: {
          id: 'uuid',
          email: 'user@example.com',
          status: 'BANNED',
        },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Query('status') status: UserStatus,
  ): Promise<ResponseDto<User>> {
    const updatedUser = await this.usersService.update(id, { status });

    return {
      ok: true,
      message: 'User updated successfully',
      data: updatedUser,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User deleted',
    schema: {
      example: {
        ok: true,
        message: 'User deleted successfully',
        data: null,
      },
    },
  })
  async delete(@Param('id') id: string): Promise<ResponseDto<null>> {
    await this.usersService.delete(id);

    return {
      ok: true,
      message: 'User deleted successfully',
      data: null,
    };
  }
}
