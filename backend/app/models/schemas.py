from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ============ Risk Schemas ============

class RiskBase(BaseModel):
    external_id: str = Field(..., alias="id", description="External risk ID like RFT-001")
    title: Optional[str] = None
    description: str
    cause: Optional[str] = None
    url: Optional[str] = None
    cost: Optional[float] = None
    likelihood: Optional[float] = None
    impact: Optional[float] = None
    phase: Optional[str] = None
    status: Optional[str] = None

    class Config:
        populate_by_name = True


class RiskCreate(RiskBase):
    pass


class RiskResponse(RiskBase):
    db_id: Optional[int] = Field(None, alias="dbId")
    cluster: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None

    class Config:
        from_attributes = True
        populate_by_name = True


# ============ Analysis Schemas ============

class ClusteringParams(BaseModel):
    min_cluster_size: int = Field(3, ge=2, le=50)
    min_samples: Optional[int] = None
    cluster_selection_epsilon: float = Field(0.0, ge=0.0)
    metric: str = "euclidean"


class SimilarityParams(BaseModel):
    threshold: float = Field(0.4, ge=0.0, le=1.0)
    max_edges_per_node: int = Field(5, ge=1, le=20)


class LayoutParams(BaseModel):
    iterations: int = Field(100, ge=10, le=500)
    gravity: float = Field(1.0, ge=0.1, le=10.0)
    scaling_ratio: float = Field(2.0, ge=0.1, le=10.0)


class AnalysisRequest(BaseModel):
    risks: list[RiskCreate]
    clustering: ClusteringParams = Field(default_factory=ClusteringParams)
    similarity: SimilarityParams = Field(default_factory=SimilarityParams)
    layout: LayoutParams = Field(default_factory=LayoutParams)


class Edge(BaseModel):
    source: str  # external_id
    target: str  # external_id
    weight: float
    edge_type: str = "similarity"  # "similarity" or "membership"


class ClusterInfo(BaseModel):
    id: int
    label: str
    keywords: list[str]
    size: int
    x: float  # Centroid position
    y: float


class AnalysisResponse(BaseModel):
    nodes: list[RiskResponse]
    edges: list[Edge]
    clusters: list[ClusterInfo]
    metadata: dict = Field(default_factory=dict)


# ============ Project Schemas ============

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    risk_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ CSV Upload ============

class CSVColumnMapping(BaseModel):
    id: str = "id"
    title: Optional[str] = "title"
    description: str = "description"
    cause: Optional[str] = "cause"
    url: Optional[str] = "url"
    cost: Optional[str] = "cost"
    likelihood: Optional[str] = "likelihood"
    impact: Optional[str] = "impact"
    phase: Optional[str] = "phase"
    status: Optional[str] = "status"
