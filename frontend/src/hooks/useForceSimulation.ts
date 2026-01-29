import { useEffect, useRef, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { RiskNode, Edge, ClusterInfo } from '../types';

interface SimNode extends SimulationNodeDatum {
  id: string;
  cluster: number;
  isCluster?: boolean;
  radius: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
  edgeType: string;
}

interface UseForceSimulationOptions {
  nodes: RiskNode[];
  edges: Edge[];
  clusters: ClusterInfo[];
  width: number;
  height: number;
  running: boolean;
  nodeSize: number;
  clusterNodeSize: number;
  repulsion: number;
  memberSpring: number;
  relevanceSpring: number;
  damping: number;
  collisionPadding: number;
  onTick: (positions: Map<string, { x: number; y: number }>) => void;
}

export function useForceSimulation({
  nodes,
  edges,
  clusters,
  width,
  height,
  running,
  nodeSize,
  clusterNodeSize,
  repulsion,
  memberSpring,
  relevanceSpring,
  damping,
  collisionPadding,
  onTick,
}: UseForceSimulationOptions) {
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  // Initialize simulation
  useEffect(() => {
    if (nodes.length === 0) {
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      return;
    }

    // Create simulation nodes (including cluster centroids)
    const simNodes: SimNode[] = [
      // Cluster centroid nodes
      ...clusters
        .filter((c) => c.id !== -1)
        .map((c) => ({
          id: `cluster_${c.id}`,
          x: c.x,
          y: c.y,
          cluster: c.id,
          isCluster: true,
          radius: clusterNodeSize,
        })),
      // Risk nodes
      ...nodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        cluster: n.cluster,
        isCluster: false,
        radius: nodeSize,
        fx: n.fx,
        fy: n.fy,
      })),
    ];

    // Create links
    const nodeIdSet = new Set(simNodes.map((n) => n.id));
    const simLinks: SimLink[] = edges
      .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        edgeType: e.edgeType,
      }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    // Create simulation
    const simulation = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .strength((d) => {
            // Membership edges use memberSpring
            if (d.edgeType === 'membership') {
              return memberSpring;
            }
            // Similarity edges use relevanceSpring proportional to weight
            return d.weight * relevanceSpring;
          })
          .distance((d) => {
            if (d.edgeType === 'membership') {
              return 60;
            }
            return 100 - d.weight * 40;
          })
      )
      .force(
        'charge',
        forceManyBody<SimNode>()
          .strength((d) => (d.isCluster ? -repulsion * 12 : -repulsion))
          .distanceMax(500)
      )
      .force('center', forceCenter(width / 2, height / 2).strength(0.02))
      .force(
        'collision',
        forceCollide<SimNode>()
          .radius((d) => d.radius + collisionPadding)
          .strength(1.0)
      )
      .velocityDecay(damping)
      .alphaDecay(0.1)
      .alphaMin(0.01);

    simulation.on('tick', () => {
      const positions = new Map<string, { x: number; y: number }>();
      for (const node of nodesRef.current) {
        if (node.x !== undefined && node.y !== undefined) {
          positions.set(node.id, { x: node.x, y: node.y });
        }
      }
      onTick(positions);
    });

    simulationRef.current = simulation;

    // Run simulation briefly then stop (let it settle)
    simulation.alpha(1).restart();
    setTimeout(() => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    }, 3000); // Stop after 3 seconds

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, clusters, width, height, nodeSize, clusterNodeSize, repulsion, memberSpring, relevanceSpring, damping, collisionPadding, onTick]);

  // Start/stop simulation based on user control
  useEffect(() => {
    if (!simulationRef.current) return;

    if (running) {
      simulationRef.current.alpha(0.5).restart();
      // Auto-stop after a short time
      const timer = setTimeout(() => {
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      simulationRef.current.stop();
    }
  }, [running]);

  // Drag handling
  const dragStart = useCallback((nodeId: string) => {
    if (!simulationRef.current) return;

    simulationRef.current.alphaTarget(0.1).restart();

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  const drag = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, []);

  const dragEnd = useCallback((nodeId: string) => {
    if (!simulationRef.current) return;

    simulationRef.current.alphaTarget(0);

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }, []);

  const reheat = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.5).restart();
    }
  }, []);

  return {
    dragStart,
    drag,
    dragEnd,
    reheat,
  };
}
