import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

import { cleanTextDeep } from './clean-text';

/**
 * Global pipe that runs {@link cleanTextDeep} over request bodies and
 * query strings before validation, so every DTO gets the same input
 * hygiene without per-field decorators. Route params are left alone
 * (they are IDs/slugs and validated separately).
 */
@Injectable()
export class CleanTextPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' && metadata.type !== 'query') return value;
    return cleanTextDeep(value);
  }
}
