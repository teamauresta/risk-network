import logging
from typing import Optional
import numpy as np

from app.services.nlp import NLPService
from app.services.clustering import ClusteringService, ClusteringResult
from app.services.layout import LayoutService, LayoutResult
from app.models.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    RiskResponse,
    Edge,
    ClusterInfo,
    ClusteringParams,
    SimilarityParams,
    LayoutParams,
)

logger = logging.getLogger(__name__)


class RiskAnalyzer:
    """
    Main orchestrator for risk network analysis.
    Combines NLP, clustering, and layout services.
    """

    def __init__(self):
        self.nlp = NLPService()
        self._clustering_service: Optional[ClusteringService] = None
        self._layout_service: Optional[LayoutService] = None

    def _get_clustering_service(self, params: ClusteringParams) -> ClusteringService:
        """Get clustering service with specified parameters."""
        return ClusteringService(
            min_cluster_size=params.min_cluster_size,
            min_samples=params.min_samples,
            cluster_selection_epsilon=params.cluster_selection_epsilon,
            metric=params.metric,
        )

    def _get_layout_service(self, params: LayoutParams) -> LayoutService:
        """Get layout service with specified parameters."""
        return LayoutService(
            iterations=params.iterations,
            gravity=params.gravity,
            scaling_ratio=params.scaling_ratio,
        )

    def analyze(self, request: AnalysisRequest) -> AnalysisResponse:
        """
        Perform full analysis pipeline on risks.

        Pipeline:
        1. Generate embeddings from risk text
        2. Cluster risks by semantic similarity
        3. Find similar risk pairs for edges
        4. Compute force-directed layout
        5. Return structured response
        """
        risks = [r.model_dump(by_alias=True) for r in request.risks]
        n_risks = len(risks)

        logger.info(f"Starting analysis for {n_risks} risks")

        if n_risks == 0:
            return AnalysisResponse(nodes=[], edges=[], clusters=[])

        # Step 1: Generate embeddings
        logger.info("Step 1: Generating embeddings")
        embeddings = self.nlp.embed_risks(risks)
        logger.info(f"Generated embeddings with shape {embeddings.shape}")

        # Step 2: Cluster
        logger.info("Step 2: Clustering")
        clustering_service = self._get_clustering_service(request.clustering)
        cluster_result = clustering_service.cluster(embeddings)
        logger.info(
            f"Clustering complete: {cluster_result.n_clusters} clusters, "
            f"{(cluster_result.labels == -1).sum()} noise points"
        )

        # Step 3: Find similar pairs
        logger.info("Step 3: Finding similar pairs")
        similar_pairs = self.nlp.find_similar_pairs(
            embeddings,
            threshold=request.similarity.threshold,
            max_per_node=request.similarity.max_edges_per_node,
        )
        logger.info(f"Found {len(similar_pairs)} similarity edges")

        # Convert to edges
        edges = [
            Edge(
                source=risks[i]["id"],
                target=risks[j]["id"],
                weight=weight,
                edge_type="similarity",
            )
            for i, j, weight in similar_pairs
        ]

        # Step 4: Compute layout
        logger.info("Step 4: Computing layout")
        layout_service = self._get_layout_service(request.layout)

        edge_tuples = [(e.source, e.target, e.weight) for e in edges]
        layout_result = layout_service.compute_layout(
            nodes=risks,
            edges=edge_tuples,
            cluster_labels=cluster_result.labels.tolist(),
        )

        # Step 5: Build response
        logger.info("Step 5: Building response")

        # Extract cluster keywords
        texts = [self.nlp.combine_risk_text(r) for r in risks]
        keywords = self.nlp.extract_keywords(
            texts,
            cluster_result.labels.tolist(),
            top_n=4,
        )

        # Build cluster info
        cluster_counts = {}
        for label in cluster_result.labels:
            cluster_counts[label] = cluster_counts.get(label, 0) + 1

        clusters = []
        for cluster_id in sorted(set(cluster_result.labels)):
            if cluster_id == -1:
                label = "Unclustered"
            else:
                kw = keywords.get(cluster_id, [])
                label = " / ".join(kw[:3]) if kw else f"Cluster {cluster_id + 1}"

            pos = layout_result.cluster_positions.get(cluster_id, (500, 400))
            clusters.append(
                ClusterInfo(
                    id=int(cluster_id),
                    label=label,
                    keywords=keywords.get(cluster_id, []),
                    size=cluster_counts.get(cluster_id, 0),
                    x=pos[0],
                    y=pos[1],
                )
            )

        # Build node responses
        nodes = []
        for i, risk in enumerate(risks):
            pos = layout_result.positions.get(risk["id"], (500, 400))
            nodes.append(
                RiskResponse(
                    id=risk["id"],
                    title=risk.get("title"),
                    description=risk["description"],
                    cause=risk.get("cause"),
                    url=risk.get("url"),
                    cost=risk.get("cost"),
                    likelihood=risk.get("likelihood"),
                    impact=risk.get("impact"),
                    phase=risk.get("phase"),
                    status=risk.get("status"),
                    cluster=int(cluster_result.labels[i]),
                    x=pos[0],
                    y=pos[1],
                )
            )

        # Add membership edges (cluster -> risk)
        for node in nodes:
            if node.cluster is not None and node.cluster != -1:
                cluster_info = next(
                    (c for c in clusters if c.id == node.cluster), None
                )
                if cluster_info:
                    edges.append(
                        Edge(
                            source=f"cluster_{node.cluster}",
                            target=node.external_id,
                            weight=0.3,
                            edge_type="membership",
                        )
                    )

        logger.info(
            f"Analysis complete: {len(nodes)} nodes, {len(edges)} edges, "
            f"{len(clusters)} clusters"
        )

        return AnalysisResponse(
            nodes=nodes,
            edges=edges,
            clusters=clusters,
            metadata={
                "embedding_model": self.nlp._model.get_sentence_embedding_dimension(),
                "clustering_method": "hdbscan",
                "n_noise_points": int((cluster_result.labels == -1).sum()),
            },
        )

    def get_embeddings(self, risks: list[dict]) -> np.ndarray:
        """Get embeddings for risks (for caching/debugging)."""
        return self.nlp.embed_risks(risks)

    def get_similarity_matrix(self, risks: list[dict]) -> np.ndarray:
        """Get full similarity matrix for risks."""
        embeddings = self.nlp.embed_risks(risks)
        return self.nlp.compute_similarity_matrix(embeddings)
