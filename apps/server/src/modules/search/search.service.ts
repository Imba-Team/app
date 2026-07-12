import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Prisma, StudySetVisibility } from '@prisma/client';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

import { SearchSetsQueryDto } from './dto/search-sets.dto';
import {
  SearchSetHitDto,
  SearchSetsResponseDto,
} from './dto/search-result.dto';

export const STUDY_SETS_INDEX = 'mimir_sets';

interface IndexedSet {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  language: string | null;
  tags: string[];
  ownerId: string;
  ownerUsername: string | null;
  visibility: StudySetVisibility;
  cardCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SearchService implements OnModuleInit {
  constructor(
    private readonly logger: LoggerService,
    private readonly es: ElasticsearchService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext(SearchService.name);
  }

  /**
   * Best-effort index bootstrap. If Elasticsearch is unreachable at boot
   * (common in dev when the cluster hasn't started yet) we log and move
   * on — the BullMQ sync jobs will retry, and a later request will surface
   * a clearer error to the caller.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex();
    } catch (err) {
      this.logger.warn(
        `Elasticsearch bootstrap failed: ${
          err instanceof Error ? err.message : String(err)
        }. The app will keep running; search will be unavailable until ES is reachable.`,
      );
    }
  }

  async ensureIndex(): Promise<void> {
    const exists = await this.es.indices.exists({ index: STUDY_SETS_INDEX });
    if (exists) return;

    await this.es.indices.create({
      index: STUDY_SETS_INDEX,
      settings: {
        analysis: {
          analyzer: {
            edge_ngram_analyzer: {
              type: 'custom',
              tokenizer: 'edge_ngram_tokenizer',
              filter: ['lowercase'],
            },
          },
          tokenizer: {
            edge_ngram_tokenizer: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 20,
              token_chars: ['letter', 'digit'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          slug: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'standard',
            fields: {
              autocomplete: {
                type: 'text',
                analyzer: 'edge_ngram_analyzer',
                search_analyzer: 'standard',
              },
            },
          },
          description: { type: 'text', analyzer: 'standard' },
          language: { type: 'keyword' },
          tags: { type: 'keyword' },
          ownerId: { type: 'keyword' },
          ownerUsername: { type: 'keyword' },
          visibility: { type: 'keyword' },
          cardCount: { type: 'integer' },
          likeCount: { type: 'integer' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
    });

    this.logger.log(`Created Elasticsearch index "${STUDY_SETS_INDEX}"`);
  }

  /**
   * Public-set search. Always filtered to visibility=PUBLIC so private
   * documents never leak even if they were accidentally indexed.
   */
  async searchSets(query: SearchSetsQueryDto): Promise<SearchSetsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;

    const must: Record<string, unknown>[] = [];
    if (query.q && query.q.trim().length) {
      must.push({
        multi_match: {
          query: query.q.trim(),
          fields: ['title^3', 'title.autocomplete^2', 'description', 'tags^2'],
          fuzziness: 'AUTO',
        },
      });
    } else {
      must.push({ match_all: {} });
    }

    const filter: Record<string, unknown>[] = [
      { term: { visibility: StudySetVisibility.PUBLIC } },
    ];
    if (query.language) {
      filter.push({ term: { language: query.language } });
    }

    const result = await this.es.search<IndexedSet>({
      index: STUDY_SETS_INDEX,
      from,
      size: limit,
      query: { bool: { must, filter } },
      sort: [{ _score: { order: 'desc' } }, { likeCount: { order: 'desc' } }],
      highlight: { fields: { title: {}, description: {} } },
    });

    const items: SearchSetHitDto[] = result.hits.hits.map((hit) => {
      const src = hit._source as IndexedSet;
      return {
        id: src.id,
        slug: src.slug,
        title: src.title,
        description: src.description,
        language: src.language,
        tags: src.tags,
        ownerId: src.ownerId,
        ownerUsername: src.ownerUsername,
        cardCount: src.cardCount,
        likeCount: src.likeCount,
        score: hit._score ?? null,
        highlights: hit.highlight,
      };
    });

    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : (result.hits.total?.value ?? items.length);

    return { items, total, page, limit };
  }

  /**
   * Pulls the canonical row from Postgres and (re)indexes it. Called by
   * the BullMQ sync processor — never invoke directly from a request path,
   * always go through SearchSyncService so retries + backoff apply.
   */
  async indexSet(setId: string): Promise<void> {
    const doc = await this.loadIndexableSet(setId);
    if (!doc) {
      // Set was deleted between enqueue and consume — drop the index entry
      // to converge with Postgres.
      await this.deleteSet(setId);
      return;
    }

    await this.es.index({
      index: STUDY_SETS_INDEX,
      id: doc.id,
      document: doc,
      refresh: false,
    });
  }

  async deleteSet(setId: string): Promise<void> {
    try {
      await this.es.delete({ index: STUDY_SETS_INDEX, id: setId });
    } catch (err) {
      // 404s on delete are fine — the document is already absent.
      const status = (err as { meta?: { statusCode?: number } })?.meta
        ?.statusCode;
      if (status !== 404) throw err;
    }
  }

  private async loadIndexableSet(setId: string): Promise<IndexedSet | null> {
    const set = await this.prisma.studySet.findUnique({
      where: { id: setId },
      include: {
        owner: { select: { username: true } },
        tags: { include: { tag: { select: { name: true } } } },
        _count: {
          select: { flashcards: true, favourites: true },
        },
      },
    });

    if (!set) return null;

    return {
      id: set.id,
      slug: set.slug,
      title: set.title,
      description: set.description,
      language: set.language,
      tags: set.tags.map((t) => t.tag.name),
      ownerId: set.ownerId,
      ownerUsername: set.owner?.username ?? null,
      visibility: set.visibility,
      cardCount: set._count.flashcards,
      likeCount: set._count.favourites,
      createdAt: set.createdAt.toISOString(),
      updatedAt: set.updatedAt.toISOString(),
    };
  }
}

// Re-export so test fixtures and the backfill script (when added) share the
// same Prisma include shape if they need it.
export type { IndexedSet };
export type StudySetInclude = Prisma.StudySetInclude;
