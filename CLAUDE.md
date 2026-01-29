# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Risk Network Analyzer v2 - A full-stack application for visualizing risk register data as interactive force-directed graphs with semantic clustering. Uses HDBSCAN for automatic cluster discovery and neural embeddings for semantic similarity detection.

## Development Commands

### Full Stack with Docker (Recommended)
```bash
docker-compose up --build                              # Production (http://localhost:3000)
docker-compose -f docker-compose.dev.yml up --build   # Backend only with hot reload
```

### Local Backend Development
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Local Frontend Development
```bash
cd frontend
npm install
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript check + production build
npm run lint         # ESLint
npm run type-check   # TypeScript only
```

### Development Workflow
For local development with hot reload on both ends:
1. Start backend services: `docker-compose -f docker-compose.dev.yml up`
2. In another terminal: `cd frontend && npm run dev`
3. Frontend at http://localhost:5173, API at http://localhost:8000/docs

## Architecture

### Backend Service Pipeline (`backend/app/services/`)
The `RiskAnalyzer` in `analyzer.py` orchestrates a 4-step pipeline:
1. **NLPService** (`nlp.py`) - Generates 384-dim embeddings via `all-MiniLM-L6-v2`, extracts cluster keywords via TF-IDF
2. **ClusteringService** (`clustering.py`) - UMAP dimension reduction → HDBSCAN clustering (falls back to K-means if poor results)
3. **LayoutService** (`layout.py`) - NetworkX spring layout with virtual cluster nodes as attraction points
4. Response assembly with similarity edges and cluster metadata

### Hybrid Layout System
The graph uses a two-phase layout:
1. **Backend** (`layout.py`): NetworkX spring layout computes initial positions, uses virtual cluster centroid nodes to pull cluster members together
2. **Frontend** (`hooks/useForceSimulation.ts`): d3-force runs client-side physics for 3 seconds to refine positions, then auto-stops

### Frontend State & Rendering
- **Zustand store** (`store/useStore.ts`) - Holds nodes, edges, clusters, display/force/analysis settings
- **useForceSimulation hook** - d3-force simulation with configurable repulsion, springs, damping
- **GraphCanvas** - deck.gl ScatterplotLayer (nodes) + LineLayer (edges) with WebGL rendering (handles 50K+ nodes)

### API Endpoints
- `POST /api/v1/upload-csv` - Main endpoint: CSV file → analysis response
- `POST /api/v1/analyze` - JSON risks → analysis response
- `POST /api/v1/similarity-matrix` - Returns full n×n similarity matrix (useful for debugging similarity issues)
- `GET /api/v1/health` - Health check
- `GET /docs` - FastAPI auto-generated OpenAPI documentation

### Edge Types
Two edge types exist in the graph:
- `similarity` - Connects semantically similar risks (cosine similarity > threshold)
- `membership` - Connects risks to their cluster centroid nodes

## Key Implementation Details

- **Singleton NLPService** - Model loaded once at startup via `@app.on_event("startup")`, pre-downloaded during Docker build
- **HDBSCAN fallback** - Falls back to K-means if HDBSCAN produces <2 clusters or >50% noise points
- **CSV column aliases** - Routes accept multiple column name variants (e.g., "risk id", "riskid", "risk_no" all map to `id`). See `routes.py` for the full alias mapping.
- **Force simulation auto-stop** - Client-side simulation runs for 3s then stops to prevent CPU drain
- **Cluster labels** - Generated from top 3 TF-IDF keywords per cluster
- **L2 normalization** - Embeddings are L2-normalized, enabling cosine similarity via simple dot product

## Configuration

Settings in `backend/app/config.py` are loaded from environment variables (see `.env.example`):
- `EMBEDDING_MODEL` - Sentence-transformer model (default: `all-MiniLM-L6-v2`)
- `MIN_CLUSTER_SIZE` - HDBSCAN minimum cluster size (default: 3)
- `SIMILARITY_THRESHOLD` - Edge creation threshold (default: 0.4)
- `CORS_ORIGINS` - Allowed origins for CORS (defaults include localhost:3000, localhost:5173)

## Testing

No automated tests are currently configured. Manual testing workflow:
1. Use the demo data button in the UI
2. Upload CSV files to test the full pipeline
3. Use `/api/v1/similarity-matrix` to debug embedding/similarity issues
4. Check `/docs` for interactive API testing
