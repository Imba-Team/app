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
});
