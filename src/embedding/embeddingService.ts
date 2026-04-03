import axios from 'axios';
import { logger } from '../utils/logger';

const FALLBACK_DIM = 256;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fallback TF-IDF-inspired embedding using character n-gram frequency vectors.
 * Produces a deterministic FALLBACK_DIM-dimensional float vector.
 */
function tfidfFallbackEmbed(text: string): number[] {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const vector = new Array<number>(FALLBACK_DIM).fill(0);

  // Character bi-grams and tri-grams
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= normalized.length - n; i++) {
      const gram = normalized.slice(i, i + n);
      let hash = 5381;
      for (let c = 0; c < gram.length; c++) {
        hash = ((hash << 5) + hash + gram.charCodeAt(c)) >>> 0;
      }
      vector[hash % FALLBACK_DIM] += 1;
    }
  }

  // Word uni-grams
  const words = normalized.split(/\s+/);
  for (const word of words) {
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = ((hash << 5) - hash + word.charCodeAt(c)) >>> 0;
    }
    vector[((hash * 2654435761) >>> 0) % FALLBACK_DIM] += 2;
  }

  // L2 normalize
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

export class EmbeddingService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly hasApiKey: boolean;

  constructor() {
    this.apiKey = process.env['HUGGINGFACE_API_KEY'] ?? '';
    this.model =
      process.env['EMBEDDING_MODEL'] ?? 'sentence-transformers/all-MiniLM-L6-v2';
    this.baseUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`;
    this.hasApiKey =
      this.apiKey.length > 0 &&
      this.apiKey !== 'hf_your_key_here';
  }

  async embed(text: string): Promise<number[]> {
    if (!this.hasApiKey) {
      logger.debug('No HuggingFace API key set, using TF-IDF fallback embedding');
      return tfidfFallbackEmbed(text);
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.post<number[] | number[][]>(
          this.baseUrl,
          { inputs: text, options: { wait_for_model: true } },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        );

        const data = response.data;
        // API may return number[] or number[][]
        if (Array.isArray(data) && data.length > 0) {
          if (Array.isArray(data[0])) {
            return (data as number[][])[0];
          }
          return data as number[];
        }

        throw new Error('Unexpected response shape from HuggingFace API');
      } catch (err) {
        const isLast = attempt === 3;
        if (isLast) {
          logger.warn(
            `HuggingFace API failed after ${attempt} attempts, falling back to TF-IDF: ${String(err)}`,
          );
          return tfidfFallbackEmbed(text);
        }
        const delay = 500 * Math.pow(2, attempt - 1);
        logger.warn(`HuggingFace API attempt ${attempt} failed, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }

    return tfidfFallbackEmbed(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.hasApiKey) {
      logger.debug('No HuggingFace API key set, using TF-IDF fallback for batch');
      return texts.map(tfidfFallbackEmbed);
    }

    const results: number[][] = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.post<number[][]>(
          this.baseUrl,
          { inputs: texts, options: { wait_for_model: true } },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          },
        );

        const data = response.data;
        if (Array.isArray(data) && data.length === texts.length) {
          results.push(...data);
          await sleep(100); // rate limit
          return results;
        }

        throw new Error('Unexpected batch response shape from HuggingFace API');
      } catch (err) {
        const isLast = attempt === 3;
        if (isLast) {
          logger.warn(
            `HuggingFace batch API failed after ${attempt} attempts, falling back to TF-IDF: ${String(err)}`,
          );
          return texts.map(tfidfFallbackEmbed);
        }
        const delay = 1000 * Math.pow(2, attempt - 1);
        logger.warn(`HuggingFace batch API attempt ${attempt} failed, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }

    return texts.map(tfidfFallbackEmbed);
  }
}
