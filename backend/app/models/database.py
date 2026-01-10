from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    risks = relationship("Risk", back_populates="project", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="project", cascade="all, delete-orphan")


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    external_id = Column(String(100), nullable=False)  # e.g., "RFT-001"
    title = Column(String(500))
    description = Column(Text, nullable=False)
    cause = Column(Text)
    url = Column(String(1000))
    cost = Column(Float)
    likelihood = Column(Float)
    impact = Column(Float)
    phase = Column(String(100))
    status = Column(String(100))
    metadata = Column(JSON)  # For additional fields
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="risks")
    embedding = relationship("RiskEmbedding", back_populates="risk", uselist=False)


class RiskEmbedding(Base):
    __tablename__ = "risk_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id"), unique=True, nullable=False)
    embedding = Column(JSON, nullable=False)  # Store as JSON array
    model_version = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    risk = relationship("Risk", back_populates="embedding")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255))
    parameters = Column(JSON, nullable=False)  # Clustering params, thresholds, etc.
    results = Column(JSON, nullable=False)  # Cluster assignments, edges, layout
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="analyses")
