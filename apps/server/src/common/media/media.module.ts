import { Global, Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ImageProcessor } from './image.processor';
import { MediaService } from './media.service';

/**
 * Global module — exposes MediaService (+ ImageProcessor for direct
 * injection where a controller needs to run the pipeline without going
 * through the upload path, e.g. background thumbnail generation).
 *
 * StorageModule is imported explicitly even though it's already global,
 * so a partial-import test setup (e.g. `TestingModule.createNestApplication`
 * that skips AppModule) still resolves the dependency.
 */
@Global()
@Module({
  imports: [StorageModule],
  providers: [ImageProcessor, MediaService],
  exports: [MediaService, ImageProcessor],
})
export class MediaModule {}
