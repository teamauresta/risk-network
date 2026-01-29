import { create } from 'zustand';
import type {
  RiskNode,
  Edge,
  ClusterInfo,
  DisplaySettings,
  ForceSettings,
  AnalysisSettings,
  ColorTheme,
  ViewState,
} from '../types';

interface GraphState {
  // Data
  nodes: RiskNode[];
  edges: Edge[];
  clusters: ClusterInfo[];
  metadata: Record<string, unknown>;
  rawRisks: Array<Record<string, unknown>>; // Original uploaded data for re-clustering

  // UI State
  loading: boolean;
  error: string | null;
  selectedNode: RiskNode | null;
  hoveredNode: RiskNode | null;

  // Settings
  displaySettings: DisplaySettings;
  forceSettings: ForceSettings;
  analysisSettings: AnalysisSettings;
  colorTheme: ColorTheme;
  viewState: ViewState;

  // Simulation running
  simulationRunning: boolean;

  // Actions
  setData: (data: {
    nodes: RiskNode[];
    edges: Edge[];
    clusters: ClusterInfo[];
    metadata?: Record<string, unknown>;
  }) => void;
  setRawRisks: (risks: Array<Record<string, unknown>>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedNode: (node: RiskNode | null) => void;
  setHoveredNode: (node: RiskNode | null) => void;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;
  updateForceSettings: (settings: Partial<ForceSettings>) => void;
  updateAnalysisSettings: (settings: Partial<AnalysisSettings>) => void;
  updateColorTheme: (theme: Partial<ColorTheme>) => void;
  setViewState: (viewState: Partial<ViewState>) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  updateAllPositions: (positions: Map<string, { x: number; y: number }>) => void;
  setSimulationRunning: (running: boolean) => void;
  reset: () => void;
}

const defaultDisplaySettings: DisplaySettings = {
  showLabels: false,  // Hide by default for large datasets - users can enable
  showSimilarityEdges: true,
  showMembershipEdges: false,  // Hide membership edges by default - less clutter
  nodeSize: 8,
  clusterNodeSize: 20,
  labelSize: 10,
  labelOffset: 4,
  searchQuery: '',
};

const defaultForceSettings: ForceSettings = {
  repulsion: 150,  // Higher repulsion for better separation
  memberSpring: 0.4,
  relevanceSpring: 0.15,
  damping: 0.75,
  collisionPadding: 10,
};

const defaultAnalysisSettings: AnalysisSettings = {
  minClusterSize: 3,
  similarityThreshold: 0.6,
  maxLinksPerRisk: 5,
};

const defaultColorTheme: ColorTheme = {
  background: '#0b1020',
  clusterNode: '#ffb478',
  riskNode: '#78b4ff',
  membershipEdge: '#ffffff',
  similarityEdge: '#ffffff',
  label: '#e8ecff',
};

const defaultViewState: ViewState = {
  zoom: 1,
  target: [500, 400],
};

export const useStore = create<GraphState>((set) => ({
  // Initial state
  nodes: [],
  edges: [],
  clusters: [],
  metadata: {},
  rawRisks: [],
  loading: false,
  error: null,
  selectedNode: null,
  hoveredNode: null,
  displaySettings: defaultDisplaySettings,
  forceSettings: defaultForceSettings,
  analysisSettings: defaultAnalysisSettings,
  colorTheme: defaultColorTheme,
  viewState: defaultViewState,
  simulationRunning: false,

  // Actions
  setData: (data) =>
    set({
      nodes: data.nodes,
      edges: data.edges,
      clusters: data.clusters,
      metadata: data.metadata ?? {},
      error: null,
    }),

  setRawRisks: (rawRisks) => set({ rawRisks }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  setSelectedNode: (selectedNode) => set({ selectedNode }),

  setHoveredNode: (hoveredNode) => set({ hoveredNode }),

  updateDisplaySettings: (settings) =>
    set((state) => ({
      displaySettings: { ...state.displaySettings, ...settings },
    })),

  updateForceSettings: (settings) =>
    set((state) => ({
      forceSettings: { ...state.forceSettings, ...settings },
    })),

  updateAnalysisSettings: (settings) =>
    set((state) => ({
      analysisSettings: { ...state.analysisSettings, ...settings },
    })),

  updateColorTheme: (theme) =>
    set((state) => ({
      colorTheme: { ...state.colorTheme, ...theme },
    })),

  setViewState: (viewState) =>
    set((state) => ({
      viewState: { ...state.viewState, ...viewState },
    })),

  updateNodePosition: (nodeId, x, y) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, x, y } : node
      ),
    })),

  updateAllPositions: (positions) =>
    set((state) => ({
      nodes: state.nodes.map((node) => {
        const pos = positions.get(node.id);
        return pos ? { ...node, x: pos.x, y: pos.y } : node;
      }),
      clusters: state.clusters.map((cluster) => {
        const pos = positions.get(`cluster_${cluster.id}`);
        return pos ? { ...cluster, x: pos.x, y: pos.y } : cluster;
      }),
    })),

  setSimulationRunning: (simulationRunning) => set({ simulationRunning }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      clusters: [],
      metadata: {},
      rawRisks: [],
      loading: false,
      error: null,
      selectedNode: null,
      hoveredNode: null,
      displaySettings: defaultDisplaySettings,
      forceSettings: defaultForceSettings,
      analysisSettings: defaultAnalysisSettings,
      viewState: defaultViewState,
      simulationRunning: false,
    }),
}));
