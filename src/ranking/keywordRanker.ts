// BM25 keyword ranker
// Parameters: k1=1.5, b=0.75
const BM25_K1 = 1.5;
const BM25_B = 0.75;

export class KeywordRanker {
  private readonly idf: Map<string, number> = new Map();
  private readonly docFreq: Map<string, number> = new Map();
  private avgDocLen = 0;
  private docCount = 0;

  buildIndex(documents: string[]): void {
    this.docFreq.clear();
    this.idf.clear();
    this.docCount = documents.length;

    if (documents.length === 0) return;

    let totalLen = 0;
    const termSets: Set<string>[] = [];

    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      totalLen += tokens.length;
      const termSet = new Set(tokens);
      termSets.push(termSet);
      for (const term of termSet) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }

    this.avgDocLen = totalLen / documents.length;

    // IDF = log((N - df + 0.5) / (df + 0.5) + 1)  — Robertson-Sparck Jones variant
    for (const [term, df] of this.docFreq.entries()) {
      const idf =
        Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);
      this.idf.set(term, Math.max(0, idf));
    }
  }

  score(query: string, document: string): number {
    const queryTokens = this.tokenize(query);
    const docTokens = this.tokenize(document);
    const docLen = docTokens.length;

    if (queryTokens.length === 0 || docLen === 0) return 0;

    // Term frequency map for document
    const tf = new Map<string, number>();
    for (const token of docTokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    let rawScore = 0;
    for (const term of queryTokens) {
      const termTf = tf.get(term) ?? 0;
      if (termTf === 0) continue;
      const idf = this.idf.get(term) ?? Math.log(this.docCount / 1 + 1);
      const tfNorm =
        (termTf * (BM25_K1 + 1)) /
        (termTf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / (this.avgDocLen || 1))));
      rawScore += idf * tfNorm;
    }

    // Normalize to [0, 1]: divide by max possible score (every query term has tf=docLen)
    const maxScore = queryTokens.reduce((acc, term) => {
      const idf = this.idf.get(term) ?? Math.log(this.docCount / 1 + 1);
      const maxTf = BM25_K1 + 1; // when tf >> docLen
      return acc + idf * maxTf;
    }, 0);

    if (maxScore === 0) return 0;
    return Math.min(1, rawScore / maxScore);
  }

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }
}
