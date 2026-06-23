import { Module } from '@nestjs/common';
import { SrsController } from './srs.controller';

@Module({
  controllers: [SrsController],
})
export class SrsModule {}
