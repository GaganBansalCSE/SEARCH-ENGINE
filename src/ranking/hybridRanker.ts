import { Job, SearchQuery, SearchResult } from '../ingestion/types';
import { KeywordRanker } from './keywordRanker';
import { StructuredRanker } from './structuredRanker';
import { VectorIndex } from '../indexing/vectorIndex';
import { ExplanationEngine } from '../explanation/explanationEngine';

export class HybridRanker {
  private readonly keywordRanker: KeywordRanker;
  private readonly structuredRanker: StructuredRanker;
  private readonly vectorIndex: VectorIndex;
  private readonly explanationEngine: ExplanationEngine;

  constructor(
    keywordRanker: KeywordRanker,
    structuredRanker: StructuredRanker,
    vectorIndex: VectorIndex,
    explanationEngine: ExplanationEngine,
  ) {
    this.keywordRanker = keywordRanker;
    this.structuredRanker = structuredRanker;
    this.vectorIndex = vectorIndex;
    this.explanationEngine = explanationEngine;
  }

  rank(
    query: SearchQuery,
    queryEmbedding: number[],
    jobs: Job[],
    topK: number,
  ): SearchResult[] {
    if (jobs.length === 0) return [];

    // Get semantic scores for all jobs
    const semanticResults = this.vectorIndex.search(queryEmbedding, jobs.length);
    const semanticMap = new Map<string, number>(
      semanticResults.map((r) => [r.id, r.score]),
    );

    const results: SearchResult[] = [];

    for (const job of jobs) {
      const semanticScore = semanticMap.get(job.id) ?? 0;
      const keywordScore = this.keywordRanker.score(query.raw, job.rawText);
      const structuredResult = this.structuredRanker.score(query, job);
      const structuredScore = structuredResult.total;

      // Hybrid formula: 50% semantic + 30% keyword + 20% structured
      const score = 0.5 * semanticScore + 0.3 * keywordScore + 0.2 * structuredScore;

      const partial: Omit<SearchResult, 'explanation'> = {
        job,
        score,
        semanticScore,
        keywordScore,
        structuredScore,
      };

      const explanation = this.explanationEngine.generate(job, query, partial);

      results.push({ ...partial, explanation });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}
