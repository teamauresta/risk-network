import numpy as np
import hdbscan
import umap
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ClusteringResult:
    labels: np.ndarray  # Cluster assignment for each point (-1 = noise)
    probabilities: np.ndarray  # Confidence of cluster assignment
    n_clusters: int
    reduced_embeddings: Optional[np.ndarray] = None  # UMAP reduced for visualization


class ClusteringService:
    """
    Clustering service using HDBSCAN for automatic cluster detection.
    Falls back to K-Means if HDBSCAN produces poor results.
    """

    def __init__(
        self,
        min_cluster_size: int = 3,
        min_samples: Optional[int] = None,
        cluster_selection_epsilon: float = 0.0,
        metric: str = "euclidean",
    ):
        self.min_cluster_size = min_cluster_size
        self.min_samples = min_samples or min_cluster_size
        self.cluster_selection_epsilon = cluster_selection_epsilon
        self.metric = metric

    def reduce_dimensions(
        self,
        embeddings: np.ndarray,
        n_components: int = 10,
        n_neighbors: int = 15,
    ) -> np.ndarray:
        """
        Reduce embedding dimensions using UMAP for better clustering.

        Args:
            embeddings: High-dimensional embeddings
            n_components: Target dimensions
            n_neighbors: UMAP neighborhood size

        Returns:
            Reduced embeddings
        """
        n_samples = embeddings.shape[0]

        # Skip UMAP for very small datasets
        if n_samples < 5:
            logger.info(f"Dataset too small ({n_samples} samples), skipping UMAP")
            return embeddings

        # Adjust parameters for small datasets
        n_neighbors = min(n_neighbors, n_samples - 1)
        n_neighbors = max(2, n_neighbors)
        n_components = min(n_components, n_samples - 2)
        n_components = max(2, n_components)

        logger.info(f"Reducing dimensions from {embeddings.shape[1]} to {n_components} (n_neighbors={n_neighbors})")

        try:
            reducer = umap.UMAP(
                n_components=n_components,
                n_neighbors=n_neighbors,
                min_dist=0.0,
                metric="cosine",
                random_state=42,
            )
            return reducer.fit_transform(embeddings)
        except Exception as e:
            logger.warning(f"UMAP failed: {e}. Using original embeddings.")
            return embeddings

    def cluster_hdbscan(self, embeddings: np.ndarray) -> ClusteringResult:
        """
        Cluster using HDBSCAN algorithm.

        HDBSCAN advantages:
        - No need to specify number of clusters
        - Handles noise points (outliers)
        - Finds clusters of varying density
        """
        # Reduce dimensions first for better performance
        if embeddings.shape[1] > 50:
            reduced = self.reduce_dimensions(embeddings, n_components=15)
        else:
            reduced = embeddings

        logger.info(
            f"Running HDBSCAN with min_cluster_size={self.min_cluster_size}, "
            f"min_samples={self.min_samples}"
        )

        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=self.min_cluster_size,
            min_samples=self.min_samples,
            cluster_selection_epsilon=self.cluster_selection_epsilon,
            metric=self.metric,
            cluster_selection_method="eom",  # Excess of Mass
            prediction_data=True,
        )
        labels = clusterer.fit_predict(reduced)
        probabilities = clusterer.probabilities_

        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = list(labels).count(-1)

        logger.info(f"HDBSCAN found {n_clusters} clusters, {n_noise} noise points")

        return ClusteringResult(
            labels=labels,
            probabilities=probabilities,
            n_clusters=n_clusters,
            reduced_embeddings=reduced,
        )

    def cluster_kmeans(
        self,
        embeddings: np.ndarray,
        k: Optional[int] = None,
    ) -> ClusteringResult:
        """
        Cluster using K-Means algorithm.
        Used as fallback or when user specifies K.

        Args:
            embeddings: Risk embeddings
            k: Number of clusters (auto-determined if None)
        """
        if k is None:
            k = self._find_optimal_k(embeddings)

        logger.info(f"Running K-Means with k={k}")

        kmeans = KMeans(
            n_clusters=k,
            init="k-means++",
            n_init=10,
            max_iter=300,
            random_state=42,
        )
        labels = kmeans.fit_predict(embeddings)

        # Calculate pseudo-probabilities based on distance to centroid
        distances = kmeans.transform(embeddings)
        min_distances = distances.min(axis=1)
        max_dist = min_distances.max() + 1e-10
        probabilities = 1 - (min_distances / max_dist)

        return ClusteringResult(
            labels=labels,
            probabilities=probabilities,
            n_clusters=k,
            reduced_embeddings=None,
        )

    def _find_optimal_k(
        self,
        embeddings: np.ndarray,
        k_range: tuple[int, int] = (3, 15),
    ) -> int:
        """
        Find optimal K using silhouette score.
        """
        n_samples = embeddings.shape[0]
        min_k, max_k = k_range
        max_k = min(max_k, n_samples - 1)

        if max_k <= min_k:
            return min_k

        best_k = min_k
        best_score = -1

        for k in range(min_k, max_k + 1):
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=5)
            labels = kmeans.fit_predict(embeddings)

            if len(set(labels)) < 2:
                continue

            score = silhouette_score(embeddings, labels)
            if score > best_score:
                best_score = score
                best_k = k

        logger.info(f"Optimal K determined: {best_k} (silhouette={best_score:.3f})")
        return best_k

    def cluster(
        self,
        embeddings: np.ndarray,
        method: str = "auto",
        k: Optional[int] = None,
    ) -> ClusteringResult:
        """
        Main clustering method.

        Args:
            embeddings: Risk embeddings
            method: "hdbscan", "kmeans", or "auto"
            k: Number of clusters (only for kmeans)

        Returns:
            ClusteringResult with labels and metadata
        """
        n_samples = embeddings.shape[0]

        if n_samples < 3:
            # Too few samples, put all in one cluster
            return ClusteringResult(
                labels=np.zeros(n_samples, dtype=int),
                probabilities=np.ones(n_samples),
                n_clusters=1,
            )

        # Adjust min_cluster_size for small datasets
        if n_samples < self.min_cluster_size * 2:
            self.min_cluster_size = max(2, n_samples // 2)
            self.min_samples = self.min_cluster_size

        if method == "kmeans" or (method == "auto" and k is not None):
            return self.cluster_kmeans(embeddings, k)

        # Try HDBSCAN first
        result = self.cluster_hdbscan(embeddings)

        # Fall back to K-Means if HDBSCAN produces poor results
        if result.n_clusters < 2 or (result.labels == -1).sum() > n_samples * 0.5:
            logger.warning(
                f"HDBSCAN produced {result.n_clusters} clusters with "
                f"{(result.labels == -1).sum()} noise points. Falling back to K-Means."
            )
            return self.cluster_kmeans(embeddings)

        return result

    def get_cluster_centroids(
        self,
        embeddings: np.ndarray,
        labels: np.ndarray,
    ) -> dict[int, np.ndarray]:
        """Calculate centroid for each cluster."""
        centroids = {}
        for label in set(labels):
            if label == -1:
                continue
            mask = labels == label
            centroids[label] = embeddings[mask].mean(axis=0)
        return centroids
