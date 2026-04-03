# Natural Language Search & Ranking System

A production-ready search engine that lets you find jobs using plain English queries. Powered by semantic embeddings from HuggingFace, BM25 keyword ranking, and structured field matching — all combined into a single hybrid score.

---

## Architecture

```
User Query (natural language)
        │
        ▼
┌───────────────────┐
│  Text Normalizer  │  ← parseQuery(): extract skills, location,
│  (preprocessing)  │    experience, salary, remote, jobType
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Embedding Service │  ← HuggingFace API (all-MiniLM-L6-v2)
│  + Cache Layer    │    or TF-IDF char n-gram fallback
└────────┬──────────┘
         │  query vector
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Hybrid Ranker                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Vector Index │  │ BM25 Keyword │  │  Structured   │ │
│  │ (cosine sim) │  │   Ranker     │  │   Ranker      │ │
│  │    × 0.50    │  │    × 0.30    │  │    × 0.20     │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
│                                                         │
│   score = 0.5·semantic + 0.3·keyword + 0.2·structured   │
└────────┬────────────────────────────────────────────────┘
         │  ranked results
         ▼
┌───────────────────┐
│ Explanation Engine│  ← generates human-readable match reason
└────────┬──────────┘
         │
         ▼
     JSON Response
```

### Components

| Component | Description |
|---|---|
| `textNormalizer` | Parses natural language queries into structured fields (skills, location, salary, experience, etc.) |
| `embeddingService` | Calls HuggingFace Inference API for 384-dim semantic embeddings; falls back to TF-IDF char n-gram vectors |
| `embeddingCache` | SHA256-keyed file-based JSON cache to avoid redundant API calls |
| `vectorIndex` | In-memory cosine similarity index over all job embeddings |
| `keywordRanker` | BM25 (k1=1.5, b=0.75) term-frequency scoring with IDF |
| `structuredRanker` | Explicit field matching: location, experience range, salary, remote preference, skill Jaccard |
| `hybridRanker` | Combines all three signals: 50% semantic + 30% keyword + 20% structured |
| `explanationEngine` | Generates per-result natural language explanation of why the job matched |

---

## Setup

### 1. Clone & install

```bash
git clone <repo>
cd search-engine
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
HUGGINGFACE_API_KEY=hf_your_key_here   # Get free key at huggingface.co
PORT=3000
DATA_DIR=./data
CACHE_DIR=./cache
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

> **Note**: If no API key is set, the system falls back to TF-IDF character n-gram embeddings automatically. Semantic search quality will be lower, but the server is fully functional.

### 3. Build

```bash
npm run build
```

---

## Precompute Embeddings (recommended)

Pre-generate and cache embeddings for all jobs so the server starts instantly:

```bash
npm run precompute
```

Output:
```
Loading jobs from ./data...
Loaded 40 jobs
Already cached: 0 jobs
To compute: 40 jobs
Processing batch 1/4 (10 jobs)...
  [1/40] Cached embedding for job-001 (dim=384)
  ...
Done! Computed 40 new embeddings.
```

---

## Start the Server

```bash
# Production (after build)
npm start

# Development (with ts-node)
npm run dev
```

Output:
```
[INFO] Starting Natural Language Search & Ranking System
[INFO] Loaded 40 jobs, 15 candidates
[INFO] Building vector index for jobs...
[INFO] Vector index built with 40 entries
[INFO] Building BM25 keyword index...
[INFO] Server running on http://localhost:3000
```

---

## API Reference

### `GET /health`

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 42.5
}
```

---

### `POST /search`

**Request:**

```json
{
  "query": "string (required)",
  "topK": 20
}
```

**Response:**

```json
{
  "query": "backend engineer Go payments Bangalore 5 years",
  "parsed": {
    "skills": ["Go"],
    "location": "Bangalore",
    "experienceMin": 5,
    "experienceMax": 10,
    "salaryMax": null,
    "keywords": ["backend", "engineer", "payments", "bangalore"],
    "remote": null,
    "jobType": null
  },
  "results": [
    {
      "rank": 1,
      "job": {
        "id": "job-001",
        "title": "Senior Backend Engineer",
        "company": "Razorpay",
        ...
      },
      "scores": {
        "total": 0.8234,
        "semantic": 0.9102,
        "keyword": 0.7456,
        "structured": 0.6500
      },
      "explanation": "This job matches because:\n- Strong skill overlap: Go (1/10 skills matched)\n- Location match: Bangalore\n- Role similarity: Senior Backend Engineer at Razorpay (semantic score: 0.91)\n- Experience range matches: 5-9 years required, query asks for 5-10 years\n- Keyword matches: backend, engineer, payments\n- Overall: Semantic 91% | Keyword 74% | Structured 65%"
    }
  ],
  "totalResults": 20,
  "searchTime": 145
}
```

---

## Sample Queries

```bash
# Find a backend Go role in payments
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "backend engineer Go payments Bangalore 5 years"}' | jq '.results[0]'

# ML engineer looking for remote work
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "remote ML engineer Python PyTorch deep learning"}' | jq '.results[:3]'

# Frontend developer with salary constraint
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "React frontend engineer under 30 LPA Bangalore 3 years"}' | jq '.'

# Entry-level internship
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "software engineering internship Python JavaScript fresher"}' | jq '.results[:5]'

# Data engineering with specific stack
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "data engineer Spark Kafka Airflow dbt 3-5 years"}' | jq '.'

# DevOps/Platform role
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "DevOps engineer Kubernetes Terraform AWS CI/CD"}' | jq '.results[:3]'

# Startup founding engineer
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "founding engineer startup TypeScript Node.js full-stack equity"}' | jq '.'

# Contract remote work
curl -s -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "contract remote Node.js backend developer"}' | jq '.results[:3]'
```

---

## Tech Decisions

### Why hybrid ranking?
Pure semantic search misses exact keyword matches ("Kafka", "gRPC", "Databricks"). Pure keyword search misses semantic equivalence ("backend developer" vs "software engineer"). Pure structured matching ignores nuanced query intent. The hybrid approach combines all three for best results.

### Why HuggingFace `all-MiniLM-L6-v2`?
- Free inference API
- 384-dim vectors — fast cosine similarity at scale  
- Strong performance on semantic textual similarity benchmarks
- Specifically designed for sentence-level semantics

### Why TF-IDF char n-gram fallback?
Makes the system work without any API key while maintaining deterministic, reasonable results. Character n-grams capture subword similarity (e.g., "Kubernetes" and "k8s" share overlapping bigrams).

### Why file-based cache?
No Redis or database required. SHA256 hash keys ensure cache correctness. For production, swap `EmbeddingCache` for a Redis-backed implementation with no other code changes needed.

### Scoring weights
```
final = 0.50 × semantic + 0.30 × keyword + 0.20 × structured
```
Semantic gets highest weight because embedding models understand query intent best. Keyword scoring ensures exact technology mentions are respected. Structured scoring gives a boost for explicitly specified constraints (location, salary, experience).

