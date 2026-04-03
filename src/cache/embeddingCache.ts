import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

interface CacheStore {
  [key: string]: number[];
}

export class EmbeddingCache {
  private readonly cacheDir: string;
  private readonly cacheFile: string;
  private store: CacheStore = {};
  private dirty = false;

  constructor() {
    this.cacheDir = process.env['CACHE_DIR'] ?? './cache';
    this.cacheFile = path.join(this.cacheDir, 'embeddings.json');
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf-8');
        this.store = JSON.parse(raw) as CacheStore;
        logger.info(`Loaded ${Object.keys(this.store).length} cached embeddings`);
      }
    } catch (err) {
      logger.warn(`Failed to load embedding cache: ${String(err)}`);
      this.store = {};
    }
  }

  async get(key: string): Promise<number[] | null> {
    return this.store[key] ?? null;
  }

  async set(key: string, embedding: number[]): Promise<void> {
    this.store[key] = embedding;
    this.dirty = true;
    await this.flush();
  }

  async has(key: string): Promise<boolean> {
    return key in this.store;
  }

  generateKey(text: string, model: string): string {
    return crypto.createHash('sha256').update(`${model}::${text}`).digest('hex');
  }

  private async flush(): Promise<void> {
    if (!this.dirty) return;
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.store), 'utf-8');
      this.dirty = false;
    } catch (err) {
      logger.warn(`Failed to flush embedding cache: ${String(err)}`);
    }
  }

  size(): number {
    return Object.keys(this.store).length;
  }
}
