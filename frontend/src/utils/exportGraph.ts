import type { RiskNode, Edge, ClusterInfo, ColorTheme, DisplaySettings } from '../types';

// Cluster color palette (same as GraphCanvas)
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

function getClusterColor(clusterId: number): string {
  if (clusterId === -1) return 'rgb(100, 100, 100)';
  const color = CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

interface ExportOptions {
  nodes: RiskNode[];
  edges: Edge[];
  clusters: ClusterInfo[];
  colorTheme: ColorTheme;
  displaySettings: DisplaySettings;
  width: number;
  height: number;
}

function calculateBounds(nodes: RiskNode[], clusters: ClusterInfo[], padding = 50) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }

  for (const cluster of clusters) {
    if (cluster.id === -1) continue;
    minX = Math.min(minX, cluster.x);
    minY = Math.min(minY, cluster.y);
    maxX = Math.max(maxX, cluster.x);
    maxY = Math.max(maxY, cluster.y);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function exportToSVG(options: ExportOptions): string {
  const { nodes, edges, clusters, colorTheme, displaySettings } = options;
  const bounds = calculateBounds(nodes, clusters, 100);

  // Build position lookup
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodePositions.set(node.id, { x: node.x, y: node.y });
  }
  for (const cluster of clusters) {
    nodePositions.set(`cluster_${cluster.id}`, { x: cluster.x, y: cluster.y });
  }

  // Filter edges
  const filteredEdges = edges.filter((edge) => {
    if (edge.edgeType === 'similarity' && !displaySettings.showSimilarityEdges) return false;
    if (edge.edgeType === 'membership' && !displaySettings.showMembershipEdges) return false;
    return true;
  });

  // Start SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}"
     width="${bounds.width}" height="${bounds.height}">
  <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${colorTheme.background}"/>

  <!-- Edges -->
  <g id="edges">
`;

  // Add edges
  for (const edge of filteredEdges) {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    if (!source || !target) continue;

    const color = edge.edgeType === 'membership' ? colorTheme.membershipEdge : colorTheme.similarityEdge;
    const opacity = edge.edgeType === 'membership' ? 0.15 : 0.1 + edge.weight * 0.25;
    const width = edge.edgeType === 'membership' ? 1 : 1 + edge.weight * 2;

    svg += `    <line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"
          stroke="${color}" stroke-opacity="${opacity}" stroke-width="${width}"/>
`;
  }

  svg += `  </g>

  <!-- Cluster Nodes -->
  <g id="cluster-nodes">
`;

  // Add cluster nodes
  for (const cluster of clusters) {
    if (cluster.id === -1) continue;
    const color = getClusterColor(cluster.id);
    svg += `    <circle cx="${cluster.x}" cy="${cluster.y}" r="${displaySettings.clusterNodeSize}"
            fill="${color}" fill-opacity="0.8" stroke="white" stroke-opacity="0.3" stroke-width="2"/>
`;
  }

  svg += `  </g>

  <!-- Risk Nodes -->
  <g id="risk-nodes">
`;

  // Add risk nodes
  for (const node of nodes) {
    const color = getClusterColor(node.cluster);
    svg += `    <circle cx="${node.x}" cy="${node.y}" r="${displaySettings.nodeSize}"
            fill="${color}" fill-opacity="0.8" stroke="white" stroke-opacity="0.4" stroke-width="1"/>
`;
  }

  svg += `  </g>
`;

  // Add labels if enabled
  if (displaySettings.showLabels) {
    svg += `
  <!-- Labels -->
  <g id="labels" font-family="system-ui, sans-serif">
`;

    // Risk node labels
    for (const node of nodes) {
      const labelX = node.x + displaySettings.nodeSize + displaySettings.labelOffset;
      svg += `    <text x="${labelX}" y="${node.y}"
            fill="${colorTheme.label}" fill-opacity="0.85"
            font-size="${displaySettings.labelSize}"
            dominant-baseline="middle">${escapeXml(node.id)}</text>
`;
    }

    // Cluster labels
    for (const cluster of clusters) {
      if (cluster.id === -1) continue;
      const labelX = cluster.x + displaySettings.clusterNodeSize + displaySettings.labelOffset + 2;
      svg += `    <text x="${labelX}" y="${cluster.y}"
            fill="${colorTheme.label}"
            font-size="${displaySettings.labelSize + 2}" font-weight="bold"
            dominant-baseline="middle">${escapeXml(cluster.label)}</text>
`;
    }

    svg += `  </g>
`;
  }

  svg += `</svg>`;

  return svg;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadSVG(options: ExportOptions, filename = 'risk-network.svg'): void {
  const svg = exportToSVG(options);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPNG(canvas: HTMLCanvasElement | null, filename = 'risk-network.png'): void {
  if (!canvas) {
    console.error('No canvas found for PNG export');
    return;
  }

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Get the deck.gl canvas from the DOM
export function getDeckCanvas(): HTMLCanvasElement | null {
  // Look for the canvas inside our graph container
  const container = document.getElementById('graph-canvas-container');
  if (container) {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) return canvas;
  }

  // Fallback: find any canvas in main
  const main = document.querySelector('main');
  if (main) {
    return main.querySelector('canvas') as HTMLCanvasElement;
  }

  return null;
}
