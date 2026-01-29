# Backend Fixes for Risk Network Analyzer

## Summary of Issues Found and Fixed

This document outlines the issues identified in the Risk Network Analyzer backend and the fixes applied to improve visualization quality and semantic clustering.

---

## Issues Identified

### 1. CSV Parsing Issues (`backend/app/api/routes.py`)

**Problem:**
- Empty rows at the end of CSV (ECI-074 through ECI-094) were not being properly filtered
- The check `risk_id == "nan"` only caught pandas NaN values, not empty strings
- Multi-line text in description and cause fields contained newlines that weren't normalized
- No logging to indicate how many rows were skipped

**Impact:**
- Empty or invalid risks could potentially be included in analysis
- Poor visibility into data quality issues

**Fix:**
- Enhanced empty row detection with comprehensive checks for:
  - Empty strings
  - "nan" string values
  - pandas NaN values
  - Whitespace-only values
- Added detailed logging showing total rows, valid risks, and skipped count
- Improved data validation before analysis

---

### 2. Text Preprocessing Issues (`backend/app/services/nlp.py` - `combine_risk_text`)

**Problem:**
- Multi-line text with newlines wasn't normalized (newlines from CSV cells were preserved)
- "NA" values were treated as actual text content
- No cleaning or normalization of text before embedding
- Text like "NA", "n/a", "none" was being embedded as meaningful content

**Impact:**
- Embeddings were affected by formatting artifacts (newlines, spacing)
- Semantically empty values polluted the embedding space
- Similar risks with different formatting appeared dissimilar

**Fix:**
- Added `clean_text()` helper function that:
  - Filters out "NA", "N/A", "nan", "none" values
  - Normalizes whitespace (replaces multiple spaces/newlines with single space)
  - Strips leading/trailing whitespace
- Applied cleaning to title, cause, and description fields
- Only include fields with meaningful content after cleaning

---

### 3. Similarity Edge Creation Logic Issues (`backend/app/services/nlp.py` - `find_similar_pairs`)

**Problem:**
- Edge creation had an asymmetry bug:
  - Algorithm counted edges per node but only added edges when `i < j`
  - This meant a node could "spend" its edge budget on nodes with higher indices
  - But those higher-index nodes wouldn't reciprocate the edge
  - Result: uneven edge distribution and missing connections
- No logging of edge statistics

**Impact:**
- Some semantically similar risks weren't connected
- Edge distribution was imbalanced across nodes
- Graph appeared sparse or disconnected

**Fix:**
- Changed to use a set-based approach:
  - Tracks unique edges in canonical form (min, max)
  - Each node selects top k similar neighbors
  - Edges are deduplicated automatically via set
  - More balanced edge distribution
- Added logging to show number of edges created with parameters

---

### 4. Clustering Parameter Issues (`backend/app/services/clustering.py`)

**Problem:**
- Fixed `min_cluster_size=3` was too small for large datasets (289 risks)
- Small clusters led to noisy or fragmented groupings
- K-means fallback used fixed k_range=(3, 15) regardless of dataset size
- No scaling based on dataset size

**Impact:**
- Too many small, meaningless clusters
- Semantically related risks split across multiple clusters
- Poor cluster quality

**Fix:**
- **Dynamic min_cluster_size adjustment:**
  - For datasets > 100: scale to 3% of dataset size (min 5, max 15)
  - For 289 risks: adjusts to ~8-9 minimum cluster size
  - Creates more meaningful, substantive clusters

- **Improved K-means fallback:**
  - Scales max_k based on dataset size:
    - Small (<100): max 15 clusters (n/5)
    - Medium (100-200): max 20 clusters (n/8)
    - Large (>200): max 25 clusters (n/10)
  - For 289 risks: searches up to 25 clusters
  - Better cluster granularity for large datasets

- **Better noise tolerance:**
  - Large datasets (>100): allow up to 30% noise before fallback
  - Small datasets: allow up to 50% noise before fallback
  - More appropriate for real-world data

---

### 5. Embedding Validation Issues (`backend/app/services/nlp.py` - `embed_risks`)

**Problem:**
- No visibility into which risks had empty text
- Risks with no valid text got zero vectors silently
- Hard to debug text preprocessing issues

**Impact:**
- Zero vectors could create artificial similarity clusters
- No way to identify data quality issues

**Fix:**
- Added logging for risks with empty text content
- Shows count and IDs of empty risks (first 10 if many)
- Helps identify data quality issues in source CSV
- Clearer error messages

---

### 6. Analysis Pipeline Logging (`backend/app/services/analyzer.py`)

**Problem:**
- Minimal logging during analysis pipeline
- Hard to debug issues or understand results
- No visibility into intermediate results

**Impact:**
- Difficult to troubleshoot when results don't make sense
- No insight into pipeline execution

**Fix:**
- Added detailed logging after each pipeline step:
  - Embedding shape after generation
  - Cluster count and noise point count after clustering
  - Number of similarity edges found
- Better visibility into analysis process

---

## Testing Recommendations

### 1. Test with the HL01.csv file

```bash
# Start backend
cd backend
docker-compose -f docker-compose.dev.yml up

# Or locally
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Upload the HL01.csv file and verify:
- 289 valid risks are parsed (21 empty rows skipped)
- Check logs for:
  - "Parsed 289 valid risks from 310 total rows (skipped 21 empty/invalid rows)"
  - Embedding generation count
  - Cluster count (should be reasonable, ~10-20 clusters)
  - Similarity edge count

### 2. Check visualization quality

- Nodes should form clear, meaningful clusters
- Similar risks (e.g., all "inclement weather" risks) should be close together
- Edges should connect semantically related risks
- Filtering by keywords should show rational groupings

### 3. Test similarity threshold adjustment

Try different similarity thresholds:
- `0.3`: More edges, denser graph
- `0.4`: Default, balanced
- `0.5`: Fewer edges, only very similar risks

### 4. Check cluster labels

Cluster labels should be meaningful:
- Labels should reflect the common theme
- Keywords should be representative
- No generic or meaningless labels

---

## Expected Improvements

After these fixes, you should see:

1. **Better data quality**: Empty rows filtered, "NA" values ignored
2. **Cleaner embeddings**: Normalized text, no formatting artifacts
3. **More rational edges**: Balanced distribution, semantic similarity
4. **Better clusters**: Appropriately sized, meaningful groupings
5. **Better visibility**: Detailed logs for debugging

---

## Files Modified

- `/Users/auresta/Projects/risk-network/backend/app/api/routes.py`
- `/Users/auresta/Projects/risk-network/backend/app/services/nlp.py`
- `/Users/auresta/Projects/risk-network/backend/app/services/clustering.py`
- `/Users/auresta/Projects/risk-network/backend/app/services/analyzer.py`

---

## Next Steps

1. Test with the HL01.csv file
2. Review backend logs for the detailed information
3. Inspect the visualization for semantic clustering quality
4. If clustering is still not optimal, consider:
   - Adjusting similarity threshold (0.3-0.5)
   - Adjusting min_cluster_size (5-15)
   - Adjusting max_edges_per_node (3-10)
5. Monitor the frontend for proper rendering of nodes and edges
