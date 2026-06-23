import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { IUser } from 'src/common/interfaces/user.interface';
import { JwtGuard } from 'src/guards/jwt.guard';

import { LibraryItemDto } from './dto/library-item.dto';
import { LibraryService } from './library.service';

@ApiTags('Library')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('me/library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get my library' })
  async getLibrary(
    @CurrentUser() user: IUser,
  ): Promise<ResponseDto<LibraryItemDto[]>> {
    const data = await this.libraryService.getLibrary(user.id);
    return { ok: true, message: 'Library retrieved', data };
  }
}
