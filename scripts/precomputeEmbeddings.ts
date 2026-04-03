import 'dotenv/config';
import * as path from 'path';
import { loadJobs } from '../src/ingestion/dataLoader';
import { EmbeddingService } from '../src/embedding/embeddingService';
import { EmbeddingCache } from '../src/cache/embeddingCache';

const BATCH_SIZE = 10;

async function precomputeEmbeddings(): Promise<void> {
  const dataDir = process.env['DATA_DIR'] ?? './data';
  const model = process.env['EMBEDDING_MODEL'] ?? 'sentence-transformers/all-MiniLM-L6-v2';

  console.log(`Loading jobs from ${path.resolve(dataDir)}...`);
  const jobs = loadJobs(dataDir);
  console.log(`Loaded ${jobs.length} jobs`);

  const embeddingService = new EmbeddingService();
  const embeddingCache = new EmbeddingCache();

  let cached = 0;
  let computed = 0;
  const toCompute: Array<{ id: string; rawText: string }> = [];

  // Check which jobs already have cached embeddings
  for (const job of jobs) {
    const key = embeddingCache.generateKey(job.rawText, model);
    if (await embeddingCache.has(key)) {
      cached++;
    } else {
      toCompute.push({ id: job.id, rawText: job.rawText });
    }
  }

  console.log(`Already cached: ${cached} jobs`);
  console.log(`To compute: ${toCompute.length} jobs`);

  if (toCompute.length === 0) {
    console.log('All embeddings already cached. Done!');
    return;
  }

  // Process in batches
  for (let i = 0; i < toCompute.length; i += BATCH_SIZE) {
    const batch = toCompute.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toCompute.length / BATCH_SIZE);
    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} jobs)...`);

    const texts = batch.map((j) => j.rawText);
    const embeddings = await embeddingService.embedBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const embedding = embeddings[j];
      if (item && embedding) {
        const key = embeddingCache.generateKey(item.rawText, model);
        await embeddingCache.set(key, embedding);
        computed++;
        console.log(`  [${computed + cached}/${jobs.length}] Cached embedding for job ${item.id} (dim=${embedding.length})`);
      }
    }
  }

  console.log(`\nDone! Computed ${computed} new embeddings.`);
  console.log(`Total cached: ${cached + computed}/${jobs.length} jobs`);
}

precomputeEmbeddings().catch((err) => {
  console.error('Failed to precompute embeddings:', err);
  process.exit(1);
});
