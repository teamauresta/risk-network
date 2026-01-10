// Risk node from API
export interface RiskNode {
  id: string;
  title?: string;
  description: string;
  cause?: string;
  url?: string;
  cost?: number;
  likelihood?: number;
  impact?: number;
  phase?: string;
  status?: string;
  cluster: number;
  x: number;
  y: number;
  // Runtime properties for force simulation
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

// Edge between nodes
export interface Edge {
  source: string;
  target: string;
  weight: number;
  edgeType: 'similarity' | 'membership';
}

// Cluster info
export interface ClusterInfo {
  id: number;
  label: string;
  keywords: string[];
  size: number;
  x: number;
  y: number;
}

// API response
export interface AnalysisResponse {
  nodes: RiskNode[];
  edges: Edge[];
  clusters: ClusterInfo[];
  metadata: {
    embeddingModel?: number;
    clusteringMethod?: string;
    nNoisePoints?: number;
  };
}

// Analysis parameters
export interface ClusteringParams {
  minClusterSize: number;
  minSamples?: number;
  clusterSelectionEpsilon: number;
  metric: string;
}

export interface SimilarityParams {
  threshold: number;
  maxEdgesPerNode: number;
}

export interface LayoutParams {
  iterations: number;
  gravity: number;
  scalingRatio: number;
}

export interface AnalysisParams {
  clustering: ClusteringParams;
  similarity: SimilarityParams;
  layout: LayoutParams;
}

// UI state
export interface ViewState {
  zoom: number;
  target: [number, number];
}

export interface DisplaySettings {
  showLabels: boolean;
  showSimilarityEdges: boolean;
  showMembershipEdges: boolean;
  nodeSize: number;
  clusterNodeSize: number;
  labelSize: number;
  labelOffset: number;
  searchQuery: string;
}

// Force simulation settings
export interface ForceSettings {
  repulsion: number;
  memberSpring: number;
  relevanceSpring: number;
  damping: number;
  collisionPadding: number;
}

// Analysis settings for re-clustering
export interface AnalysisSettings {
  minClusterSize: number;
  similarityThreshold: number;
  maxLinksPerRisk: number;
}

// Color theme
export interface ColorTheme {
  background: string;
  clusterNode: string;
  riskNode: string;
  membershipEdge: string;
  similarityEdge: string;
  label: string;
}
