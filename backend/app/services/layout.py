import numpy as np
import networkx as nx
from typing import Optional
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class LayoutResult:
    positions: dict[str, tuple[float, float]]  # node_id -> (x, y)
    cluster_positions: dict[int, tuple[float, float]]  # cluster_id -> (x, y)


class LayoutService:
    """
    Graph layout service using force-directed algorithms.
    Uses NetworkX for layout computation.
    """

    def __init__(
        self,
        iterations: int = 100,
        gravity: float = 1.0,
        scaling_ratio: float = 2.0,
    ):
        self.iterations = iterations
        self.gravity = gravity
        self.scaling_ratio = scaling_ratio

    def compute_layout(
        self,
        nodes: list[dict],
        edges: list[tuple[str, str, float]],
        cluster_labels: list[int],
        width: float = 1000,
        height: float = 800,
    ) -> LayoutResult:
        """
        Compute force-directed layout for the risk network.

        Args:
            nodes: List of node dicts with 'id' field
            edges: List of (source_id, target_id, weight) tuples
            cluster_labels: Cluster assignment for each node
            width: Canvas width
            height: Canvas height

        Returns:
            LayoutResult with node and cluster positions
        """
        if not nodes:
            return LayoutResult(positions={}, cluster_positions={})

        # Build NetworkX graph
        G = nx.Graph()

        # Add nodes
        for i, node in enumerate(nodes):
            G.add_node(
                node["id"],
                cluster=cluster_labels[i] if i < len(cluster_labels) else -1,
            )

        # Add edges with weights
        for source, target, weight in edges:
            if G.has_node(source) and G.has_node(target):
                G.add_edge(source, target, weight=weight)

        # Add cluster centroid nodes (virtual nodes to pull clusters together)
        unique_clusters = set(cluster_labels)
        cluster_nodes = {}
        for cluster_id in unique_clusters:
            if cluster_id == -1:
                continue
            cluster_node = f"__cluster_{cluster_id}__"
            cluster_nodes[cluster_id] = cluster_node
            G.add_node(cluster_node, is_cluster=True)

            # Connect cluster members to cluster node with weak spring
            for i, node in enumerate(nodes):
                if cluster_labels[i] == cluster_id:
                    G.add_edge(node["id"], cluster_node, weight=0.1)  # Weaker connection

        # Compute layout
        logger.info(
            f"Computing layout for {len(nodes)} nodes, {len(edges)} edges, "
            f"{len(unique_clusters)} clusters"
        )

        try:
            # Use larger k value to spread nodes further apart
            k_value = self.scaling_ratio * 3 / np.sqrt(len(G.nodes()))
            pos = nx.spring_layout(
                G,
                k=k_value,
                iterations=self.iterations,
                weight="weight",
                scale=min(width, height) * 0.4,
                center=(width / 2, height / 2),
                seed=42,
            )
        except Exception as e:
            logger.warning(f"Spring layout failed: {e}, using random layout")
            pos = nx.random_layout(G, seed=42)
            # Scale to canvas
            for node_id in pos:
                x, y = pos[node_id]
                pos[node_id] = (
                    x * width * 0.8 + width * 0.1,
                    y * height * 0.8 + height * 0.1,
                )

        # Extract positions
        node_positions = {}
        cluster_positions = {}

        for node_id, (x, y) in pos.items():
            if str(node_id).startswith("__cluster_"):
                cluster_id = int(str(node_id).replace("__cluster_", "").replace("__", ""))
                cluster_positions[cluster_id] = (float(x), float(y))
            else:
                node_positions[str(node_id)] = (float(x), float(y))

        # Calculate cluster centroids from member positions if virtual nodes weren't used
        for cluster_id in unique_clusters:
            if cluster_id not in cluster_positions and cluster_id != -1:
                member_positions = [
                    node_positions[nodes[i]["id"]]
                    for i in range(len(nodes))
                    if cluster_labels[i] == cluster_id and nodes[i]["id"] in node_positions
                ]
                if member_positions:
                    cx = sum(p[0] for p in member_positions) / len(member_positions)
                    cy = sum(p[1] for p in member_positions) / len(member_positions)
                    cluster_positions[cluster_id] = (cx, cy)

        # Post-process: spread risk nodes around their cluster centroids
        # to prevent them from overlapping with the cluster node
        min_distance = 40  # Minimum distance from cluster center
        for i, node in enumerate(nodes):
            cluster_id = cluster_labels[i] if i < len(cluster_labels) else -1
            if cluster_id == -1:
                continue  # Skip noise points

            node_id = node["id"]
            if node_id not in node_positions:
                continue

            cluster_pos = cluster_positions.get(cluster_id)
            if not cluster_pos:
                continue

            node_pos = node_positions[node_id]
            dx = node_pos[0] - cluster_pos[0]
            dy = node_pos[1] - cluster_pos[1]
            dist = np.sqrt(dx * dx + dy * dy)

            if dist < min_distance:
                # Push node outward to minimum distance
                if dist < 0.1:
                    # Node is at cluster center, place in circular pattern
                    angle = (i * 2.39996)  # Golden angle for even distribution
                    dx = np.cos(angle)
                    dy = np.sin(angle)
                    dist = 1

                scale = min_distance / dist
                node_positions[node_id] = (
                    cluster_pos[0] + dx * scale,
                    cluster_pos[1] + dy * scale,
                )

        return LayoutResult(
            positions=node_positions,
            cluster_positions=cluster_positions,
        )

    def compute_layout_2d_umap(
        self,
        embeddings: np.ndarray,
        node_ids: list[str],
        width: float = 1000,
        height: float = 800,
    ) -> dict[str, tuple[float, float]]:
        """
        Alternative layout using UMAP to 2D.
        Places semantically similar nodes close together.
        """
        import umap

        n_samples = len(embeddings)

        if n_samples < 4:
            # Too few points for UMAP
            np.random.seed(42)
            return {
                node_id: (
                    width / 2 + np.random.randn() * 100,
                    height / 2 + np.random.randn() * 100,
                )
                for node_id in node_ids
            }

        n_neighbors = min(15, n_samples - 1)
        n_neighbors = max(2, n_neighbors)

        try:
            reducer = umap.UMAP(
                n_components=2,
                n_neighbors=n_neighbors,
                min_dist=0.1,
                metric="cosine",
                random_state=42,
            )
            coords_2d = reducer.fit_transform(embeddings)
        except Exception as e:
            logger.warning(f"UMAP layout failed: {e}, using random layout")
            np.random.seed(42)
            return {
                node_id: (
                    width / 2 + np.random.randn() * 100,
                    height / 2 + np.random.randn() * 100,
                )
                for node_id in node_ids
            }

        # Normalize to canvas
        x_min, x_max = coords_2d[:, 0].min(), coords_2d[:, 0].max()
        y_min, y_max = coords_2d[:, 1].min(), coords_2d[:, 1].max()

        padding = 0.1
        positions = {}
        for i, node_id in enumerate(node_ids):
            x = (coords_2d[i, 0] - x_min) / (x_max - x_min + 1e-10)
            y = (coords_2d[i, 1] - y_min) / (y_max - y_min + 1e-10)
            positions[node_id] = (
                x * width * (1 - 2 * padding) + width * padding,
                y * height * (1 - 2 * padding) + height * padding,
            )

        return positions

    def refine_layout(
        self,
        positions: dict[str, tuple[float, float]],
        edges: list[tuple[str, str, float]],
        iterations: int = 50,
    ) -> dict[str, tuple[float, float]]:
        """
        Refine layout with additional force simulation.
        Can be called incrementally from frontend.
        """
        # Convert to numpy for faster computation
        node_ids = list(positions.keys())
        n = len(node_ids)
        node_index = {nid: i for i, nid in enumerate(node_ids)}

        pos = np.array([positions[nid] for nid in node_ids], dtype=float)
        vel = np.zeros_like(pos)

        # Build edge list with weights
        edge_list = []
        for source, target, weight in edges:
            if source in node_index and target in node_index:
                edge_list.append((node_index[source], node_index[target], weight))

        # Simple force simulation
        repulsion = 5000
        attraction = 0.01
        damping = 0.9

        for _ in range(iterations):
            forces = np.zeros_like(pos)

            # Repulsion (all pairs - could optimize with quadtree)
            for i in range(n):
                for j in range(i + 1, n):
                    diff = pos[i] - pos[j]
                    dist = np.linalg.norm(diff) + 0.1
                    force = repulsion / (dist * dist) * (diff / dist)
                    forces[i] += force
                    forces[j] -= force

            # Attraction (edges)
            for i, j, weight in edge_list:
                diff = pos[j] - pos[i]
                dist = np.linalg.norm(diff) + 0.1
                force = attraction * weight * diff
                forces[i] += force
                forces[j] -= force

            # Update
            vel = vel * damping + forces * 0.1
            pos += vel

        return {nid: (float(pos[i, 0]), float(pos[i, 1])) for i, nid in enumerate(node_ids)}
