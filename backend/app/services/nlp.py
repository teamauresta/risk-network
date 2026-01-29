import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import logging
from typing import Optional
import hashlib
import json

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class NLPService:
    """
    Natural Language Processing service for risk text analysis.
    Uses sentence-transformers for semantic embeddings.
    """

    _instance: Optional["NLPService"] = None
    _model: Optional[SentenceTransformer] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._model is None:
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            self._model = SentenceTransformer(settings.embedding_model)
            self._tfidf = TfidfVectorizer(
                max_features=1000,
                stop_words="english",
                ngram_range=(1, 2),
                min_df=1,
                max_df=0.95,
            )
            logger.info("NLP Service initialized")

    def combine_risk_text(self, risk: dict) -> str:
        """Combine risk fields into a single text for embedding."""
        parts = []

        def clean_text(text: str) -> str:
            """Clean and normalize text."""
            if not text or text.lower() in ["na", "n/a", "nan", "none"]:
                return ""
            # Replace multiple newlines/whitespace with single space
            text = " ".join(text.split())
            return text.strip()

        # Weight title more heavily by repeating
        if risk.get("title"):
            cleaned_title = clean_text(risk["title"])
            if cleaned_title:
                parts.append(cleaned_title)
                parts.append(cleaned_title)  # Double weight

        if risk.get("cause"):
            cleaned_cause = clean_text(risk["cause"])
            if cleaned_cause:
                parts.append(cleaned_cause)

        if risk.get("description"):
            cleaned_desc = clean_text(risk["description"])
            if cleaned_desc:
                parts.append(cleaned_desc)

        return " ".join(parts).strip()

    def embed_risks(self, risks: list[dict]) -> np.ndarray:
        """
        Generate semantic embeddings for a list of risks.

        Args:
            risks: List of risk dictionaries with text fields

        Returns:
            numpy array of shape (n_risks, embedding_dim)
        """
        texts = [self.combine_risk_text(r) for r in risks]

        # Filter empty texts and log issues
        valid_indices = [i for i, t in enumerate(texts) if t.strip()]
        valid_texts = [texts[i] for i in valid_indices]

        empty_count = len(risks) - len(valid_texts)
        if empty_count > 0:
            logger.warning(f"Found {empty_count} risks with no valid text content (will be assigned zero vectors)")
            # Log IDs of empty risks for debugging
            empty_ids = [risks[i].get('id', f'index_{i}') for i in range(len(risks)) if i not in valid_indices]
            if len(empty_ids) <= 10:
                logger.warning(f"Empty risk IDs: {empty_ids}")
            else:
                logger.warning(f"Empty risk IDs (first 10): {empty_ids[:10]}")

        if not valid_texts:
            raise ValueError("No valid text content found in risks")

        logger.info(f"Generating embeddings for {len(valid_texts)}/{len(risks)} risks with valid text")
        embeddings = self._model.encode(
            valid_texts,
            show_progress_bar=len(valid_texts) > 50,
            convert_to_numpy=True,
            normalize_embeddings=True,  # L2 normalize for cosine similarity
        )

        # Create full array with zeros for invalid texts
        full_embeddings = np.zeros((len(risks), embeddings.shape[1]))
        for idx, valid_idx in enumerate(valid_indices):
            full_embeddings[valid_idx] = embeddings[idx]

        return full_embeddings

    def compute_similarity_matrix(self, embeddings: np.ndarray) -> np.ndarray:
        """
        Compute pairwise cosine similarity matrix.

        Args:
            embeddings: L2-normalized embeddings

        Returns:
            Similarity matrix of shape (n, n)
        """
        # Since embeddings are normalized, dot product = cosine similarity
        return embeddings @ embeddings.T

    def find_similar_pairs(
        self,
        embeddings: np.ndarray,
        threshold: float = 0.4,
        max_per_node: int = 5,
    ) -> list[tuple[int, int, float]]:
        """
        Find pairs of similar risks above threshold.

        Args:
            embeddings: Risk embeddings
            threshold: Minimum similarity to create an edge
            max_per_node: Maximum edges per node

        Returns:
            List of (source_idx, target_idx, similarity) tuples
        """
        sim_matrix = self.compute_similarity_matrix(embeddings)
        n = len(embeddings)

        # Use a set to track unique edges
        edge_set = set()

        for i in range(n):
            # Get similarities for this node (excluding self)
            sims = [(j, sim_matrix[i, j]) for j in range(n) if i != j]
            # Sort by similarity descending
            sims.sort(key=lambda x: x[1], reverse=True)

            # Take top k above threshold
            count = 0
            for j, sim in sims:
                if sim < threshold:
                    break
                if count >= max_per_node:
                    break

                # Add edge in canonical form (smaller index first) to avoid duplicates
                edge = (min(i, j), max(i, j), float(sim))
                edge_set.add(edge)
                count += 1

        # Convert set to list
        edges = list(edge_set)

        logger.info(f"Found {len(edges)} similarity edges (threshold={threshold}, max_per_node={max_per_node})")
        return edges

    def extract_keywords(
        self,
        texts: list[str],
        labels: list[int],
        top_n: int = 5,
    ) -> dict[int, list[str]]:
        """
        Extract top keywords for each cluster using TF-IDF.

        Args:
            texts: List of combined risk texts
            labels: Cluster labels for each text
            top_n: Number of keywords per cluster

        Returns:
            Dict mapping cluster_id -> list of keywords
        """
        # Fit TF-IDF on all texts
        tfidf_matrix = self._tfidf.fit_transform(texts)
        feature_names = self._tfidf.get_feature_names_out()

        # Get unique cluster labels (excluding noise = -1)
        unique_labels = sorted(set(labels))

        keywords = {}
        for label in unique_labels:
            if label == -1:
                keywords[-1] = ["unclustered"]
                continue

            # Get indices of risks in this cluster
            indices = [i for i, l in enumerate(labels) if l == label]

            if not indices:
                keywords[label] = []
                continue

            # Average TF-IDF scores for this cluster
            cluster_tfidf = tfidf_matrix[indices].mean(axis=0).A1

            # Get top terms
            top_indices = cluster_tfidf.argsort()[::-1][:top_n]
            keywords[label] = [feature_names[i] for i in top_indices]

        return keywords

    def get_embedding_hash(self, risks: list[dict]) -> str:
        """Generate a hash for cache key based on risk content."""
        content = json.dumps(
            [self.combine_risk_text(r) for r in risks],
            sort_keys=True,
        )
        return hashlib.sha256(content.encode()).hexdigest()[:16]
