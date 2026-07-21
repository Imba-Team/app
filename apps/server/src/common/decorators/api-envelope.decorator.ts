import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { ResponseDto } from '../interfaces/response.dto';

type Envelope = 'ok' | 'created';

interface EnvelopeOptions {
  /** true = the endpoint returns an array of `dto` */
  isArray?: boolean;
  /** override description */
  description?: string;
}

/**
 * Produce a Swagger response schema that mirrors the shape controllers
 * actually return: `{ ok, message, data: <dto | dto[]> }`. Emitted as
 * `allOf` so `openapi-typescript` will inline the outer envelope and the
 * inner `data` payload with the concrete DTO reference — giving the
 * generated frontend types real shape safety on the `data` field.
 */
function envelope(
  kind: Envelope,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dto: Type<any> | null,
  options: EnvelopeOptions = {},
): MethodDecorator & ClassDecorator {
  const dataSchema = dto
    ? options.isArray
      ? { type: 'array' as const, items: { $ref: getSchemaPath(dto) } }
      : { $ref: getSchemaPath(dto) }
    : { type: 'null' as const, nullable: true };

  const responseSchema = {
    allOf: [
      { $ref: getSchemaPath(ResponseDto) },
      { properties: { data: dataSchema } },
    ],
  };

  const responseDecorator =
    kind === 'ok'
      ? ApiOkResponse({ description: options.description, schema: responseSchema })
      : ApiCreatedResponse({
          description: options.description,
          schema: responseSchema,
        });

  return applyDecorators(
    ApiExtraModels(ResponseDto, ...(dto ? [dto] : [])),
    responseDecorator,
  );
}

/** `@ApiOkEnvelope(FooDto)` → 200 with `{ ok, message, data: FooDto }`. */
export function ApiOkEnvelope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dto: Type<any> | null = null,
  options: EnvelopeOptions = {},
) {
  return envelope('ok', dto, options);
}

/** `@ApiCreatedEnvelope(FooDto)` → 201 with `{ ok, message, data: FooDto }`. */
export function ApiCreatedEnvelope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dto: Type<any> | null = null,
  options: EnvelopeOptions = {},
) {
  return envelope('created', dto, options);
}
