import { useCallback, useState, useRef, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer, LineLayer, TextLayer } from '@deck.gl/layers';
import { useStore } from '../store/useStore';
import { useForceSimulation } from '../hooks/useForceSimulation';
import type { RiskNode, ClusterInfo } from '../types';

// Color utility
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128];
}

// Cluster color palette
const CLUSTER_COLORS: [number, number, number][] = [
  [255, 180, 120], // orange
  [120, 180, 255], // blue
  [180, 255, 120], // green
  [255, 120, 180], // pink
  [180, 120, 255], // purple
  [255, 255, 120], // yellow
  [120, 255, 255], // cyan
  [255, 150, 150], // salmon
  [150, 255, 150], // mint
  [150, 150, 255], // lavender
];

function getClusterColor(clusterId: number): [number, number, number, number] {
  if (clusterId === -1) return [100, 100, 100, 180]; // noise/unclustered
  const color = CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
  return [...color, 200];
}

interface GraphCanvasProps {
  width: number;
  height: number;
}

export function GraphCanvas({ width, height }: GraphCanvasProps) {
  const {
    nodes,
    edges,
    clusters,
    displaySettings,
    forceSettings,
    colorTheme,
    hoveredNode,
    selectedNode,
    simulationRunning,
    setHoveredNode,
    setSelectedNode,
    updateAllPositions,
  } = useStore();

  const [viewState, setViewState] = useState({
    target: [width / 2, height / 2] as [number, number],
    zoom: 0,
    minZoom: -2,
    maxZoom: 4,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Update view when container size changes
  useEffect(() => {
    setViewState((prev) => ({
      ...prev,
      target: [width / 2, height / 2] as [number, number],
    }));
  }, [width, height]);

  // Handle position updates from force simulation
  const handleTick = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      updateAllPositions(positions);
    },
    [updateAllPositions]
  );

  // Force simulation
  const { dragStart, drag, dragEnd } = useForceSimulation({
    nodes,
    edges,
    clusters,
    width,
    height,
    running: simulationRunning,
    nodeSize: displaySettings.nodeSize,
    clusterNodeSize: displaySettings.clusterNodeSize,
    repulsion: forceSettings.repulsion,
    memberSpring: forceSettings.memberSpring,
    relevanceSpring: forceSettings.relevanceSpring,
    damping: forceSettings.damping,
    collisionPadding: forceSettings.collisionPadding,
    onTick: handleTick,
  });

  // Filter nodes by search
  const filteredNodes = nodes.filter((node) => {
    if (!displaySettings.searchQuery) return true;
    const query = displaySettings.searchQuery.toLowerCase();
    return (
      node.id.toLowerCase().includes(query) ||
      node.title?.toLowerCase().includes(query) ||
      node.description.toLowerCase().includes(query) ||
      node.cause?.toLowerCase().includes(query)
    );
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Filter edges
  const filteredEdges = edges.filter((edge) => {
    if (edge.edgeType === 'similarity' && !displaySettings.showSimilarityEdges) {
      return false;
    }
    if (edge.edgeType === 'membership' && !displaySettings.showMembershipEdges) {
      return false;
    }
    // Only show edges connected to visible nodes
    const sourceVisible =
      filteredNodeIds.has(edge.source) || edge.source.startsWith('cluster_');
    const targetVisible =
      filteredNodeIds.has(edge.target) || edge.target.startsWith('cluster_');
    return sourceVisible && targetVisible;
  });

  // Build position lookup
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodePositions.set(node.id, { x: node.x, y: node.y });
  }
  for (const cluster of clusters) {
    nodePositions.set(`cluster_${cluster.id}`, { x: cluster.x, y: cluster.y });
  }

  // Create layers
  const layers = [
    // Edges layer (rendered first, behind nodes)
    new LineLayer({
      id: 'edges',
      data: filteredEdges,
      getSourcePosition: (d) => {
        const pos = nodePositions.get(d.source);
        return pos ? [pos.x, pos.y] : [0, 0];
      },
      getTargetPosition: (d) => {
        const pos = nodePositions.get(d.target);
        return pos ? [pos.x, pos.y] : [0, 0];
      },
      getColor: (d) => {
        const baseColor =
          d.edgeType === 'membership'
            ? hexToRgb(colorTheme.membershipEdge)
            : hexToRgb(colorTheme.similarityEdge);
        const alpha = d.edgeType === 'membership' ? 40 : Math.floor(30 + d.weight * 60);
        return [...baseColor, alpha];
      },
      getWidth: (d) => (d.edgeType === 'membership' ? 1 : 1 + d.weight * 2),
      pickable: false,
    }),

    // Cluster nodes layer
    new ScatterplotLayer<ClusterInfo>({
      id: 'cluster-nodes',
      data: clusters.filter((c) => c.id !== -1),
      getPosition: (d) => [d.x, d.y],
      getRadius: displaySettings.clusterNodeSize,
      getFillColor: (d) => getClusterColor(d.id),
      getLineColor: [255, 255, 255, 80],
      getLineWidth: 2,
      stroked: true,
      pickable: true,
      onClick: ({ object }) => {
        if (object) {
          // Could filter to show only this cluster
          console.log('Clicked cluster:', object.label);
        }
      },
      onHover: () => {
        // Cluster hover - could show tooltip
      },
    }),

    // Risk nodes layer
    new ScatterplotLayer<RiskNode>({
      id: 'risk-nodes',
      data: filteredNodes,
      getPosition: (d) => [d.x, d.y],
      getRadius: (d) => {
        if (d.id === selectedNode?.id) return displaySettings.nodeSize * 1.5;
        if (d.id === hoveredNode?.id) return displaySettings.nodeSize * 1.3;
        return displaySettings.nodeSize;
      },
      getFillColor: (d) => {
        if (d.id === selectedNode?.id) return [255, 255, 255, 255];
        return getClusterColor(d.cluster);
      },
      getLineColor: [255, 255, 255, 100],
      getLineWidth: 1,
      stroked: true,
      pickable: true,
      onClick: ({ object }) => {
        if (object) {
          setSelectedNode(object.id === selectedNode?.id ? null : object);
          if (object.url) {
            window.open(object.url, '_blank', 'noopener,noreferrer');
          }
        }
      },
      onHover: ({ object }) => {
        setHoveredNode(object || null);
      },
      onDragStart: ({ object }) => {
        if (object) dragStart(object.id);
      },
      onDrag: ({ object, coordinate }) => {
        if (object && coordinate) {
          drag(object.id, coordinate[0], coordinate[1]);
        }
      },
      onDragEnd: ({ object }) => {
        if (object) dragEnd(object.id);
      },
    }),

    // Labels layer
    displaySettings.showLabels &&
      new TextLayer<RiskNode>({
        id: 'labels',
        data: filteredNodes,
        getPosition: (d) => [d.x + displaySettings.nodeSize + displaySettings.labelOffset, d.y],
        getText: (d) => d.id,
        getColor: hexToRgb(colorTheme.label).concat(220) as [number, number, number, number],
        getSize: displaySettings.labelSize,
        getAngle: 0,
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 'normal',
        pickable: false,
        sizeUnits: 'pixels',
        characterSet: 'auto',
      }),

    // Cluster labels
    displaySettings.showLabels &&
      new TextLayer<ClusterInfo>({
        id: 'cluster-labels',
        data: clusters.filter((c) => c.id !== -1),
        getPosition: (d) => [d.x + displaySettings.clusterNodeSize + displaySettings.labelOffset + 2, d.y],
        getText: (d) => d.label,
        getColor: hexToRgb(colorTheme.label).concat(255) as [number, number, number, number],
        getSize: displaySettings.labelSize + 2,
        getAngle: 0,
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 'bold',
        pickable: false,
        sizeUnits: 'pixels',
        characterSet: 'auto',
      }),
  ].filter(Boolean);

  return (
    <div
      ref={containerRef}
      id="graph-canvas-container"
      style={{
        width: '100%',
        height: '100%',
        background: colorTheme.background,
        position: 'relative',
      }}
    >
      <DeckGL
        views={new OrthographicView({ id: 'main', flipY: true })}
        viewState={viewState}
        onViewStateChange={({ viewState: newState }) => setViewState(newState as typeof viewState)}
        controller={{ dragPan: true, scrollZoom: true, doubleClickZoom: true }}
        layers={layers}
        getCursor={({ isDragging, isHovering }) =>
          isDragging ? 'grabbing' : isHovering ? 'pointer' : 'default'
        }
      />

      {/* Tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            background: 'rgba(17, 24, 51, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 10,
            padding: '10px 14px',
            maxWidth: 400,
            color: '#e8ecff',
            fontSize: 12,
            lineHeight: 1.4,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            {hoveredNode.id}
            <span style={{ color: '#aab3d6', fontWeight: 'normal', marginLeft: 8 }}>
              Cluster {hoveredNode.cluster + 1}
            </span>
          </div>
          {hoveredNode.title && (
            <div style={{ color: '#aab3d6' }}>
              <b>Title:</b> {hoveredNode.title}
            </div>
          )}
          {hoveredNode.cause && (
            <div style={{ color: '#aab3d6' }}>
              <b>Cause:</b> {hoveredNode.cause}
            </div>
          )}
          <div style={{ color: '#aab3d6' }}>
            <b>Description:</b> {hoveredNode.description}
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          color: '#aab3d6',
          fontSize: 11,
        }}
      >
        Scroll to zoom • Drag to pan • Click node to select
      </div>
    </div>
  );
}
