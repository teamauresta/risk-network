# Quick Reference: Backend Fixes

## What Was Fixed

### 1. CSV Parsing (`routes.py`)
- **Before**: Empty rows and "NA" values were processed
- **After**: Comprehensive validation filters out empty/invalid rows
- **Log Output**: "Parsed X valid risks from Y total rows (skipped Z empty/invalid rows)"

### 2. Text Cleaning (`nlp.py`)
- **Before**: "NA", newlines, and extra spaces in embeddings
- **After**: Text normalized, "NA" filtered, whitespace cleaned
- **Impact**: Better quality embeddings, more accurate similarity

### 3. Similarity Edges (`nlp.py`)
- **Before**: Asymmetric edge creation, uneven distribution
- **After**: Set-based deduplication, balanced edge distribution
- **Impact**: More complete graph connectivity

### 4. Clustering (`clustering.py`)
- **Before**: Fixed min_cluster_size=3 for all datasets
- **After**: Dynamic sizing (3% of dataset, min 5, max 15)
- **Impact**: More meaningful cluster sizes (~8-9 for 289 risks)

### 5. K-means Fallback (`clustering.py`)
- **Before**: Fixed max_k=15 regardless of dataset size
- **After**: Scales to dataset (up to 25 clusters for 289 risks)
- **Impact**: Better granularity for large datasets

### 6. Logging (`analyzer.py`, `nlp.py`, `clustering.py`)
- **Before**: Minimal logging
- **After**: Detailed stats at each pipeline stage
- **Impact**: Easy debugging and quality monitoring

---

## Key Parameters You Can Adjust

Upload endpoint: `POST /api/v1/upload-csv`

**Query Parameters:**
```
min_cluster_size: int = 3     # Minimum risks per cluster (auto-adjusted for large datasets)
similarity_threshold: float = 0.4   # Edge creation threshold (0.3-0.5 recommended)
max_edges_per_node: int = 5   # Max similarity edges per risk (3-10 recommended)
```

**Example with curl:**
```bash
curl -X POST "http://localhost:8000/api/v1/upload-csv?similarity_threshold=0.35&max_edges_per_node=7" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@HL01.csv"
```

---

## What to Look For in Logs

### Good Signs:
```
INFO: Parsed 289 valid risks from 310 total rows (skipped 21 empty/invalid rows)
INFO: Generating embeddings for 289/289 risks with valid text
INFO: Generated embeddings with shape (289, 384)
INFO: Adjusting min_cluster_size from 3 to 8 for dataset size 289
INFO: HDBSCAN found 12 clusters, 15 noise points
INFO: Clustering complete: 12 clusters, 15 noise points
INFO: Found 487 similarity edges (threshold=0.4, max_per_node=5)
```

### Warning Signs:
```
WARNING: Found 50 risks with no valid text content
WARNING: HDBSCAN produced 1 clusters with 200 noise points (69.2%). Falling back to K-Means.
```

---

## Expected Results with HL01.csv

**Dataset:**
- 310 total rows
- 289 valid risks (21 empty rows filtered)

**Clustering:**
- ~8-12 meaningful clusters
- <20% noise points
- Cluster labels with relevant keywords

**Similarity Edges:**
- ~400-600 edges (with threshold=0.4, max_per_node=5)
- Connections between semantically related risks

**Semantic Groups (expected):**
- Weather-related risks (RFT-080, RFT-081, RFT-082, RFT-083, RFT-087, CTAN-C05)
- Contamination risks (RFT-001, RFT-070, RFT-062, RFT-065, ECI-045-051)
- Approval/delay risks (RFT-100, RFT-054, RFT-032, RFT-044, ECI-072)
- Pavement/construction risks (RFT-011, RFT-052, CTAN-C06, CTAN-C07, CTAN-C11)
- Utility/infrastructure risks (RFT-002, RFT-003, RFT-013, RFT-027)
- Safety risks (RFT-110, RFT-111, RFT-112, RFT-113)

---

## Testing Checklist

- [ ] CSV uploads successfully
- [ ] Logs show correct number of parsed risks (289)
- [ ] Logs show skipped empty rows (21)
- [ ] Embeddings generated for all valid risks
- [ ] Clustering produces reasonable number of clusters (8-15)
- [ ] Similarity edges created (check count in logs)
- [ ] Visualization shows clear clusters
- [ ] Related risks are connected by edges
- [ ] Filtering shows semantic groupings
- [ ] Cluster labels are meaningful

---

## Troubleshooting

### Too many clusters / fragmented
- Increase `min_cluster_size` (try 8-12)
- Decrease `similarity_threshold` (try 0.35)

### Too few clusters / everything grouped together
- Decrease `min_cluster_size` (try 4-6)
- Increase `similarity_threshold` (try 0.45)

### Graph too dense (too many edges)
- Increase `similarity_threshold` (try 0.45-0.5)
- Decrease `max_edges_per_node` (try 3-4)

### Graph too sparse (few edges)
- Decrease `similarity_threshold` (try 0.3-0.35)
- Increase `max_edges_per_node` (try 7-10)

### Nodes not semantically related
- Check logs for "NA" filtering
- Verify text cleaning is working
- Check embedding quality (look for warnings)

---

## Files Changed

All changes are in `/Users/auresta/Projects/risk-network/backend/`:

- `app/api/routes.py` - CSV parsing and validation
- `app/services/nlp.py` - Text cleaning and similarity edges
- `app/services/clustering.py` - Dynamic cluster sizing
- `app/services/analyzer.py` - Enhanced logging

View changes: `git diff backend/`
