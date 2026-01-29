from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import JSONResponse
import pandas as pd
import io
import logging
from typing import Optional

from app.models.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    RiskCreate,
    CSVColumnMapping,
    ClusteringParams,
    SimilarityParams,
    LayoutParams,
)
from app.services.analyzer import RiskAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter()

# Singleton analyzer instance
_analyzer: Optional[RiskAnalyzer] = None


def get_analyzer() -> RiskAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = RiskAnalyzer()
    return _analyzer


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_risks(
    request: AnalysisRequest,
    analyzer: RiskAnalyzer = Depends(get_analyzer),
):
    """
    Analyze risks and return clustered graph data.

    This endpoint:
    1. Generates semantic embeddings for risk text
    2. Clusters risks using HDBSCAN
    3. Finds similarity edges between risks
    4. Computes force-directed layout positions
    """
    try:
        return analyzer.analyze(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/upload-csv", response_model=AnalysisResponse)
async def upload_and_analyze_csv(
    file: UploadFile = File(...),
    # Optional query params for analysis settings
    min_cluster_size: int = 3,
    similarity_threshold: float = 0.4,
    max_edges_per_node: int = 5,
    analyzer: RiskAnalyzer = Depends(get_analyzer),
):
    """
    Upload CSV file, parse it, and return analyzed graph data.

    The CSV should have at minimum 'id' and 'description' columns.
    Optional columns: title, cause, url, cost, likelihood, impact, phase, status
    """
    if not file.filename.endswith((".csv", ".CSV")):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file",
        )

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {str(e)}",
        )

    # Normalize column names
    df.columns = df.columns.str.strip().str.lower()

    # Column aliases
    aliases = {
        "id": ["id", "risk id", "riskid", "risk_no", "risk no", "risk number", "ref", "reference"],
        "title": ["title", "risk title", "name"],
        "description": ["description", "risk description", "desc", "details", "summary"],
        "cause": ["cause", "causes", "driver", "root cause"],
        "url": ["url", "link", "hyperlink"],
        "cost": ["cost", "value", "exposure"],
        "likelihood": ["likelihood", "probability"],
        "impact": ["impact", "consequence"],
        "phase": ["phase", "stage"],
        "status": ["status"],
    }

    def find_column(df, aliases_list):
        for alias in aliases_list:
            if alias in df.columns:
                return alias
        return None

    # Map columns
    col_map = {key: find_column(df, aliases_list) for key, aliases_list in aliases.items()}

    if col_map["id"] is None:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must have an 'id' column. Found columns: {list(df.columns)}",
        )
    if col_map["description"] is None:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must have a 'description' column. Found columns: {list(df.columns)}",
        )

    # Convert to risks
    risks = []
    skipped_count = 0
    total_rows = len(df)

    for idx, row in df.iterrows():
        risk_id = str(row[col_map["id"]]).strip()
        description = str(row[col_map["description"]]).strip()

        # Skip empty rows, NaN values, or rows with only whitespace
        if (not risk_id or not description or
            risk_id == "nan" or description == "nan" or
            risk_id == "" or description == "" or
            pd.isna(row[col_map["id"]]) or pd.isna(row[col_map["description"]])):
            skipped_count += 1
            continue

        risk = RiskCreate(
            id=risk_id,
            description=description,
            title=str(row[col_map["title"]]).strip() if col_map["title"] and pd.notna(row[col_map["title"]]) else None,
            cause=str(row[col_map["cause"]]).strip() if col_map["cause"] and pd.notna(row[col_map["cause"]]) else None,
            url=str(row[col_map["url"]]).strip() if col_map["url"] and pd.notna(row[col_map["url"]]) else None,
            cost=float(row[col_map["cost"]]) if col_map["cost"] and pd.notna(row[col_map["cost"]]) else None,
            likelihood=float(row[col_map["likelihood"]]) if col_map["likelihood"] and pd.notna(row[col_map["likelihood"]]) else None,
            impact=float(row[col_map["impact"]]) if col_map["impact"] and pd.notna(row[col_map["impact"]]) else None,
            phase=str(row[col_map["phase"]]).strip() if col_map["phase"] and pd.notna(row[col_map["phase"]]) else None,
            status=str(row[col_map["status"]]).strip() if col_map["status"] and pd.notna(row[col_map["status"]]) else None,
        )
        risks.append(risk)

    if not risks:
        raise HTTPException(
            status_code=400,
            detail="No valid risks found in CSV",
        )

    logger.info(f"Parsed {len(risks)} valid risks from {total_rows} total rows (skipped {skipped_count} empty/invalid rows)")

    # Analyze
    request = AnalysisRequest(
        risks=risks,
        clustering=ClusteringParams(min_cluster_size=min_cluster_size),
        similarity=SimilarityParams(
            threshold=similarity_threshold,
            max_edges_per_node=max_edges_per_node,
        ),
        layout=LayoutParams(),
    )

    try:
        return analyzer.analyze(request)
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@router.post("/similarity-matrix")
async def get_similarity_matrix(
    request: AnalysisRequest,
    analyzer: RiskAnalyzer = Depends(get_analyzer),
):
    """
    Get the full similarity matrix for risks.
    Useful for debugging and advanced analysis.
    """
    try:
        risks = [r.model_dump(by_alias=True) for r in request.risks]
        matrix = analyzer.get_similarity_matrix(risks)
        return {
            "risk_ids": [r["id"] for r in risks],
            "matrix": matrix.tolist(),
        }
    except Exception as e:
        logger.exception("Failed to compute similarity matrix")
        raise HTTPException(status_code=500, detail=str(e))
