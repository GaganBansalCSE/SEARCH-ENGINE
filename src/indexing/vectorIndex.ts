interface IndexEntry {
  vector: number[];
  data: unknown;
}

export class VectorIndex {
  private readonly items: Map<string, IndexEntry> = new Map();

  add(id: string, vector: number[], data: unknown): void {
    this.items.set(id, { vector, data });
  }

  search(
    queryVector: number[],
    topK: number,
  ): Array<{ id: string; score: number; data: unknown }> {
    const scores: Array<{ id: string; score: number; data: unknown }> = [];

    for (const [id, entry] of this.items.entries()) {
      const score = this.cosineSimilarity(queryVector, entry.vector);
      scores.push({ id, score, data: entry.data });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;

    // Clamp to [0, 1] - cosine similarity is in [-1, 1] but sentence embeddings are positive
    return Math.max(0, Math.min(1, dot / denom));
  }

  size(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }
}
