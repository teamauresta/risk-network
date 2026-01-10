# Risk Network Analyzer v2

A modern web application for visualizing risk register data as interactive force-directed graphs with semantic clustering.

![Risk Network Analyzer](docs/screenshot.png)

## Features

- **Semantic Clustering**: Uses HDBSCAN to automatically discover natural groupings in risk data based on text similarity
- **Neural Embeddings**: Sentence-transformers generate semantic embeddings for accurate similarity detection
- **Interactive Visualization**: WebGL-powered graph rendering with smooth zoom, pan, and drag interactions
- **Real-time Force Simulation**: D3-force layout with configurable physics parameters
- **CSV Import**: Drag-and-drop CSV upload with automatic column detection
- **Export**: Download visualizations as PNG (raster) or SVG (vector)
- **Customizable Appearance**: Adjust colors, node sizes, labels, and force parameters

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  FileUpload │  │ ControlPanel│  │  GraphCanvas (deck.gl)  │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         └────────────────┴──────────────────────┘               │
│                          │ REST API                             │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    Backend (FastAPI + Python)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ NLPService  │  │ Clustering  │  │   LayoutService         │ │
│  │ (embeddings)│  │  (HDBSCAN)  │  │   (NetworkX)            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Using Docker (Recommended)

```bash
# Clone and start all services
cd risk-network
docker-compose up --build

# Access the application
open http://localhost:3000
```

### Local Development

**Backend:**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Access the app at http://localhost:5173

## Usage

### 1. Upload Data
Drag and drop a CSV file onto the upload area, or click to browse.

### 2. Explore the Graph
- **Scroll** to zoom in/out
- **Drag** on empty space to pan
- **Click** a node to select it
- **Hover** over nodes to see details

### 3. Adjust Parameters

#### Grouping & Relevance
| Parameter | Description |
|-----------|-------------|
| Min cluster size | Minimum risks required to form a cluster (2-10) |
| Similarity threshold | How similar risks must be to show connections (0.1-0.9) |
| Max links per risk | Maximum similarity edges per node (1-15) |
| Show similarity links | Toggle visibility of similarity edges |

Click **Rebuild clustering** after changing these parameters.

#### Layout Controls
| Parameter | Description |
|-----------|-------------|
| Risk node size | Size of risk nodes (4-24px) |
| Cluster node size | Size of cluster centroid nodes (10-40px) |
| Label size | Font size for labels (8-18px) |
| Label offset | Distance between node and label (0-20px) |
| Repulsion | Force pushing nodes apart (10-500) |
| Member spring | Attraction between risks and their cluster (0.05-1) |
| Relevance spring | Attraction between similar risks (0.01-0.5) |
| Damping | Velocity decay / friction (0.1-0.95) |
| Collision padding | Extra space between nodes (0-20px) |

#### Colors
Customize background, node colors, edge colors, and label colors.

### 4. Export
- **PNG**: Raster screenshot of the current view
- **SVG**: Scalable vector graphic (editable in Illustrator/Inkscape)

## API Endpoints

### `POST /api/v1/analyze`
Analyze risks and return clustered graph data.

**Request body:**
```json
{
  "risks": [
    {
      "id": "RISK-001",
      "title": "Supply chain disruption",
      "description": "Critical components may be delayed...",
      "cause": "Global shipping constraints"
    }
  ],
  "clustering": {
    "min_cluster_size": 3,
    "cluster_selection_epsilon": 0.0,
    "metric": "euclidean"
  },
  "similarity": {
    "threshold": 0.4,
    "max_edges_per_node": 5
  }
}
```

**Response:**
```json
{
  "nodes": [...],
  "edges": [...],
  "clusters": [...],
  "metadata": {
    "clustering_method": "hdbscan",
    "n_noise_points": 2
  }
}
```

### `POST /api/v1/upload-csv`
Upload CSV file for analysis.

**Query parameters:**
- `min_cluster_size` (default: 3)
- `similarity_threshold` (default: 0.4)
- `max_edges_per_node` (default: 5)

### `GET /api/v1/health`
Health check endpoint.

## CSV Format

Required columns:
- `id` (or: risk id, risk_no, reference)
- `description` (or: risk description, details, summary)

Optional columns:
- `title`
- `cause`
- `url`
- `cost`
- `likelihood`
- `impact`
- `phase`
- `status`

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Enable debug mode |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `REDIS_URL` | `redis://...` | Redis connection string |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformer model |
| `MIN_CLUSTER_SIZE` | `3` | Default HDBSCAN min cluster size |
| `SIMILARITY_THRESHOLD` | `0.4` | Default similarity threshold |

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | React app served via nginx |
| backend | 8000 | FastAPI server |
| db | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |

## Technology Stack

**Backend:**
- FastAPI - Async Python web framework
- sentence-transformers - Neural text embeddings (all-MiniLM-L6-v2)
- HDBSCAN - Density-based clustering
- UMAP - Dimension reduction
- NetworkX - Graph algorithms and layout
- PostgreSQL - Data persistence
- Redis - Caching

**Frontend:**
- React 18 + TypeScript
- deck.gl - WebGL visualization
- d3-force - Force simulation
- Zustand - State management
- Tailwind CSS - Styling
- Vite - Build tool
- Lucide React - Icons

## Comparison with v1

| Feature | v1 (Single HTML) | v2 (Full Stack) |
|---------|------------------|-----------------|
| Clustering | K-means (specify K) | HDBSCAN (auto-detect) |
| Text Similarity | TF-IDF (word matching) | Neural embeddings (semantic) |
| Rendering | SVG (~500 nodes) | WebGL (~50,000 nodes) |
| Persistence | None | PostgreSQL + Redis |
| Export | None | PNG + SVG |
| Deployment | Open HTML file | Docker containers |

## Troubleshooting

### Graph is shaking
Increase the **Damping** parameter or wait for the simulation to settle. The simulation auto-stops after a few seconds.

### Nodes overlapping cluster centers
Click **Rebuild clustering** to recalculate the layout with proper node spacing.

### Port 3000 already in use
Edit `docker-compose.yml` and change the frontend port mapping (e.g., `8080:80`).

### HDBSCAN compilation error
Ensure you have the latest requirements: `hdbscan>=0.8.36`

## License

MIT
