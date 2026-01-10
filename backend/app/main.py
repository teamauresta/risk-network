from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import sys

from app.config import get_settings
from app.api.routes import router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="""
    Risk Network Analyzer API

    This API provides endpoints for:
    - Analyzing risk register data using NLP and clustering
    - Generating force-directed graph layouts
    - Finding semantic similarities between risks

    ## Features
    - **Semantic Embeddings**: Uses sentence-transformers for understanding risk text
    - **Automatic Clustering**: HDBSCAN finds natural groupings without specifying K
    - **Similarity Detection**: Identifies related risks based on semantic similarity
    - **Layout Computation**: Pre-computes force-directed positions server-side
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router, prefix="/api/v1", tags=["analysis"])


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info(f"Starting {settings.app_name}")
    logger.info(f"Debug mode: {settings.debug}")

    # Pre-load the NLP model to avoid first-request latency
    logger.info("Pre-loading NLP model...")
    try:
        from app.services.nlp import NLPService
        nlp = NLPService()
        logger.info("NLP model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load NLP model: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down...")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "2.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
