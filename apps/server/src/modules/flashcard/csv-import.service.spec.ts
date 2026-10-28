import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { textLimits } from 'src/common/text/text-limits';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import { CsvImportService } from './csv-import.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

const build = () => {
  const prisma = {
    flashcard: {
      findFirst: jest.fn().mockResolvedValue(null),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const studySets = { canEdit: jest.fn().mockResolvedValue(true) };
  const svc = new CsvImportService(
    noopLogger(),
    prisma as unknown as PrismaService,
    studySets as unknown as StudySetService,
  );
  return { svc, prisma };
};

const mapping = { term: 0, definition: 1, example: 2, phonetic: 3, hint: 4 };
const csv = (rows: string[][]) =>
  Buffer.from(rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n'));

describe('CsvImportService.import (MIM-49)', () => {
  it('applies the card DTO limits to every text column', async () => {
    const { svc, prisma } = build();
    const long = (n: number) => 'x'.repeat(n + 1);

    const result = await svc.import(
      'u-1',
      's-1',
      csv([
        ['ok', 'fine', '', '', ''],
        ['a', 'b', long(textLimits.cardExample), '', ''],
        ['a', 'b', '', long(textLimits.cardPhonetic), ''],
        ['a', 'b', '', '', long(textLimits.cardHint)],
        [long(textLimits.cardTerm), 'b', '', '', ''],
      ]),
      { mapping, hasHeader: false, delimiter: ',' },
    );

    expect(result.importedCount).toBe(1);
    expect(result.errors.map((e) => [e.row, e.message])).toEqual([
      [2, `example exceeds ${textLimits.cardExample} characters`],
      [3, `phonetic exceeds ${textLimits.cardPhonetic} characters`],
      [4, `hint exceeds ${textLimits.cardHint} characters`],
      [5, `term exceeds ${textLimits.cardTerm} characters`],
    ]);
    expect(prisma.flashcard.createMany).toHaveBeenCalledTimes(1);
  });

  it('cleans cells like the global text pipe, keeping angle brackets', async () => {
    const { svc, prisma } = build();

    await svc.import(
      'u-1',
      's-1',
      csv([['List<String>\u0000', ' cafe\u0301\u202E ', '', '', '']]),
      { mapping, hasHeader: false, delimiter: ',' },
    );

    const [{ data }] = prisma.flashcard.createMany.mock.calls[0] as [
      { data: { term: string; definition: string }[] },
    ];
    expect(data[0]).toMatchObject({ term: 'List<String>', definition: 'café' });
  });
});
