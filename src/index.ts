import 'dotenv/config';
import { loadJobs, loadCandidates } from './ingestion/dataLoader';
import { EmbeddingService } from './embedding/embeddingService';
import { EmbeddingCache } from './cache/embeddingCache';
import { VectorIndex } from './indexing/vectorIndex';
import { KeywordRanker } from './ranking/keywordRanker';
import { StructuredRanker } from './ranking/structuredRanker';
import { HybridRanker } from './ranking/hybridRanker';
import { ExplanationEngine } from './explanation/explanationEngine';
import { createServer } from './api/server';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  const dataDir = process.env['DATA_DIR'] ?? './data';
  const model = process.env['EMBEDDING_MODEL'] ?? 'sentence-transformers/all-MiniLM-L6-v2';

  logger.info('Starting Natural Language Search & Ranking System');
  logger.info(`Data dir: ${dataDir}`);
  logger.info(`Embedding model: ${model}`);

  // Load data
  const jobs = loadJobs(dataDir);
  const candidates = loadCandidates(dataDir);
  logger.info(`Loaded ${jobs.length} jobs, ${candidates.length} candidates`);

  if (jobs.length === 0) {
    logger.warn('No jobs loaded — search results will be empty');
  }

  // Initialize services
  const embeddingService = new EmbeddingService();
  const embeddingCache = new EmbeddingCache();

  // Build vector index for jobs
  logger.info('Building vector index for jobs...');
  const vectorIndex = new VectorIndex();

  for (const job of jobs) {
    let embedding = job.embedding;
    if (!embedding) {
      const cacheKey = embeddingCache.generateKey(job.rawText, model);
      const cached = await embeddingCache.get(cacheKey);
      if (cached) {
        embedding = cached;
      } else {
        logger.debug(`Computing embedding for job ${job.id}: ${job.title}`);
        embedding = await embeddingService.embed(job.rawText);
        await embeddingCache.set(cacheKey, embedding);
      }
    }
    vectorIndex.add(job.id, embedding, job);
  }
  logger.info(`Vector index built with ${vectorIndex.size()} entries`);

  // Build keyword index
  logger.info('Building BM25 keyword index...');
  const keywordRanker = new KeywordRanker();
  keywordRanker.buildIndex(jobs.map((j) => j.rawText));

  // Initialize rankers
  const structuredRanker = new StructuredRanker();
  const explanationEngine = new ExplanationEngine();
  const hybridRanker = new HybridRanker(
    keywordRanker,
    structuredRanker,
    vectorIndex,
    explanationEngine,
  );

  // Create and start server
  const app = createServer(jobs, embeddingService, embeddingCache, hybridRanker, model);
  app.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Health: GET  http://localhost:${port}/health`);
    logger.info(`Search: POST http://localhost:${port}/search`);
  });
}

main().catch((err) => {
  logger.error(`Fatal error: ${String(err)}`);
  process.exit(1);
});
