import { ElasticsearchService } from '@nestjs/elasticsearch';
import { StudySetVisibility } from '@prisma/client';
import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SearchService } from './search.service';

const noopLogger = () =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as LoggerService;

const build = () => {
  const es = {
    search: jest
      .fn()
      .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
  };
  const svc = new SearchService(
    noopLogger(),
    es as unknown as ElasticsearchService,
    {} as PrismaService,
  );
  return { svc, es };
};

type EsSearchArgs = { query: { bool: { must_not: unknown; filter: unknown } } };
const lastQuery = (es: { search: jest.Mock }) =>
  (es.search.mock.calls[0] as [EsSearchArgs])[0].query;

describe('SearchService.searchSets', () => {
  it("excludes the caller's own sets from community results", async () => {
    const { svc, es } = build();

    await svc.searchSets({ q: 'biology' }, 'u-1');

    const query = lastQuery(es);
    expect(query.bool.must_not).toEqual([{ term: { ownerId: 'u-1' } }]);
  });

  it('keeps the public-only and tag/language filters alongside the exclusion', async () => {
    const { svc, es } = build();

    await svc.searchSets({ tag: 'bio', language: 'English' }, 'u-1');

    const query = lastQuery(es);
    expect(query.bool.filter).toEqual([
      { term: { visibility: StudySetVisibility.PUBLIC } },
      { term: { language: 'English' } },
      { term: { tags: 'bio' } },
    ]);
  });

  it('asks Elasticsearch to HTML-escape highlight fragments', async () => {
    const { svc, es } = build();

    await svc.searchSets({ q: 'biology' }, 'u-1');

    const args = (es.search.mock.calls[0] as [{ highlight: unknown }])[0];
    expect(args.highlight).toMatchObject({ encoder: 'html' });
  });
});

describe('SearchService.syncSet (MIM-45)', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 's-1',
    slug: 'spanish',
    title: 'Spanish',
    description: null,
    language: 'Spanish',
    ownerId: 'u-1',
    owner: { username: 'emin' },
    visibility: StudySetVisibility.PUBLIC,
    tags: [{ tag: { name: 'languages' } }],
    _count: { flashcards: 12, favourites: 3 },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  });

  const buildSync = (found: unknown) => {
    const es = {
      index: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };
    const prisma = {
      studySet: { findUnique: jest.fn().mockResolvedValue(found) },
    };
    const svc = new SearchService(
      noopLogger(),
      es as unknown as ElasticsearchService,
      prisma as unknown as PrismaService,
    );
    return { svc, es };
  };

  it('indexes a public set with fresh card and save counts', async () => {
    const { svc, es } = buildSync(row());

    expect(await svc.syncSet('s-1')).toBe('indexed');

    expect(es.index).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 's-1',
        document: expect.objectContaining({
          cardCount: 12,
          likeCount: 3,
          tags: ['languages'],
          ownerUsername: 'emin',
        }) as unknown,
      }),
    );
    expect(es.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['deleted', null],
    ['private', row({ visibility: StudySetVisibility.PRIVATE })],
    ['unlisted', row({ visibility: StudySetVisibility.UNLISTED })],
  ])('drops a %s set from the index', async (_label, found) => {
    const { svc, es } = buildSync(found);

    expect(await svc.syncSet('s-1')).toBe('deleted');

    expect(es.delete).toHaveBeenCalledWith({ index: 'mimir_sets', id: 's-1' });
    expect(es.index).not.toHaveBeenCalled();
  });

  it('treats an already-missing document as deleted', async () => {
    const { svc, es } = buildSync(null);
    es.delete.mockRejectedValue({ meta: { statusCode: 404 } });

    await expect(svc.syncSet('s-1')).resolves.toBe('deleted');
  });
});
