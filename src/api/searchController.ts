import { Request, Response, NextFunction } from 'express';
import { EmbeddingService } from '../embedding/embeddingService';
import { EmbeddingCache } from '../cache/embeddingCache';
import { HybridRanker } from '../ranking/hybridRanker';
import { parseQuery } from '../preprocessing/textNormalizer';
import { Job } from '../ingestion/types';
import { logger } from '../utils/logger';

interface SearchRequestBody {
  query?: string;
  topK?: number;
}

interface SearchResponseItem {
  rank: number;
  job: Job;
  scores: {
    total: number;
    semantic: number;
    keyword: number;
    structured: number;
  };
  explanation: string;
}

interface SearchResponse {
  query: string;
  parsed: ReturnType<typeof parseQuery>;
  results: SearchResponseItem[];
  totalResults: number;
  searchTime: number;
}

export function createSearchController(
  jobs: Job[],
  embeddingService: EmbeddingService,
  embeddingCache: EmbeddingCache,
  hybridRanker: HybridRanker,
  model: string,
) {
  return async function searchHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const body = req.body as SearchRequestBody;
      const rawQuery = body.query;
      const topK = typeof body.topK === 'number' ? Math.min(body.topK, 50) : 20;

      if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
        res.status(400).json({ error: 'query field is required and must be a non-empty string' });
        return;
      }

      logger.info(`Search request: "${rawQuery}"`);

      const parsed = parseQuery(rawQuery.trim());

      // Get or compute query embedding
      const cacheKey = embeddingCache.generateKey(rawQuery.trim(), model);
      let queryEmbedding = await embeddingCache.get(cacheKey);
      if (!queryEmbedding) {
        queryEmbedding = await embeddingService.embed(rawQuery.trim());
        await embeddingCache.set(cacheKey, queryEmbedding);
      }

      const searchResults = hybridRanker.rank(parsed, queryEmbedding, jobs, topK);

      const response: SearchResponse = {
        query: rawQuery,
        parsed,
        results: searchResults.map((r, idx) => ({
          rank: idx + 1,
          job: r.job,
          scores: {
            total: parseFloat(r.score.toFixed(4)),
            semantic: parseFloat(r.semanticScore.toFixed(4)),
            keyword: parseFloat(r.keywordScore.toFixed(4)),
            structured: parseFloat(r.structuredScore.toFixed(4)),
          },
          explanation: r.explanation,
        })),
        totalResults: searchResults.length,
        searchTime: Date.now() - startTime,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  };
}

export function healthHandler(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
