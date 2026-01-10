# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Risk Network Analyzer v2 - A full-stack application for visualizing risk register data as interactive force-directed graphs with semantic clustering. Uses HDBSCAN for automatic cluster discovery and neural embeddings for semantic similarity detection.

## Development Commands

### Full Stack with Docker (Recommended)
```bash
docker-compose up --build        # Production mode (http://localhost)
docker-compose -f docker-compose.dev.yml up --build  # Dev mode with hot reload
```

### Local Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Local Frontend Development
```bash
cd frontend
npm install
npm run dev          # Dev server at http://localhost:5173
npm run build        # Build with TypeScript check
npm run lint         # ESLint
npm run type-check   # TypeScript type checking only
```

## Architecture

**Backend (FastAPI + Python)**
- `app/main.py` - FastAPI app initialization, CORS, startup events
- `app/api/routes.py` - REST endpoints (`/api/v1/analyze`, `/api/v1/upload-csv`)
- `app/services/nlp.py` - Sentence-transformer embeddings (all-MiniLM-L6-v2)
- `app/services/clustering.py` - HDBSCAN clustering with UMAP dimension reduction
- `app/services/layout.py` - NetworkX graph algorithms, force-directed layout
- `app/services/analyzer.py` - Orchestrates NLP, clustering, and layout services

**Frontend (React + TypeScript + Vite)**
- `src/App.tsx` - Main app component, state coordination
- `src/components/GraphCanvas.tsx` - deck.gl WebGL visualization with d3-force simulation
- `src/components/ControlPanel.tsx` - Clustering/similarity parameter controls
- `src/components/FileUpload.tsx` - CSV drag-and-drop with column detection
- `src/store/` - Zustand state management
- `src/api/` - Backend API client

**Data Flow**
1. CSV uploaded → parsed in FileUpload → sent to `/api/v1/upload-csv`
2. Backend: NLPService embeds text → ClusteringService runs HDBSCAN → LayoutService computes positions
3. Response: nodes (with cluster assignments), edges (similarity connections), cluster metadata
4. Frontend: d3-force simulation refines layout → deck.gl renders WebGL layers

## Key Technologies

- **Clustering**: HDBSCAN (density-based, auto-detects K) vs v1's K-means
- **Embeddings**: sentence-transformers (semantic) vs v1's TF-IDF (lexical)
- **Rendering**: deck.gl WebGL (~50K nodes) vs v1's SVG (~500 nodes)
- **State**: Zustand for frontend state management
