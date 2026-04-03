import express, { Request, Response, NextFunction } from 'express';
import { createSearchController, healthHandler } from './searchController';
import { Job } from '../ingestion/types';
import { EmbeddingService } from '../embedding/embeddingService';
import { EmbeddingCache } from '../cache/embeddingCache';
import { HybridRanker } from '../ranking/hybridRanker';
import { logger } from '../utils/logger';

export function createServer(
  jobs: Job[],
  embeddingService: EmbeddingService,
  embeddingCache: EmbeddingCache,
  hybridRanker: HybridRanker,
  model: string,
): express.Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '1mb' }));

  // CORS headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  app.options('*', (_req: Request, res: Response) => {
    res.sendStatus(204);
  });

  // Routes
  app.get('/health', healthHandler);

  const searchController = createSearchController(
    jobs,
    embeddingService,
    embeddingCache,
    hybridRanker,
    model,
  );
  app.post('/search', searchController);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(`Unhandled error: ${String(err)}`);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
