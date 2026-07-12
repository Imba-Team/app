import { Module } from '@nestjs/common';
import { ClassroomController } from './classroom.controller';

@Module({
  controllers: [ClassroomController],
})
export class ClassroomModule {}
