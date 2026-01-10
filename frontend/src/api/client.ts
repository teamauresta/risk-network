import type { AnalysisResponse, AnalysisParams, RiskNode } from '../types';

const API_BASE = '/api/v1';

interface RiskInput {
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
}

export async function analyzeRisks(
  risks: RiskInput[] | Array<Record<string, unknown>>,
  params?: Partial<AnalysisParams>
): Promise<AnalysisResponse> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      risks,
      clustering: params?.clustering ?? {
        min_cluster_size: 3,
        cluster_selection_epsilon: 0.0,
        metric: 'euclidean',
      },
      similarity: params?.similarity ?? {
        threshold: 0.4,
        max_edges_per_node: 5,
      },
      layout: params?.layout ?? {
        iterations: 100,
        gravity: 1.0,
        scaling_ratio: 2.0,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Analysis failed');
  }

  const data = await response.json();

  // Convert snake_case to camelCase
  return {
    nodes: data.nodes.map((n: Record<string, unknown>) => ({
      id: n.id || n.external_id,
      title: n.title,
      description: n.description,
      cause: n.cause,
      url: n.url,
      cost: n.cost,
      likelihood: n.likelihood,
      impact: n.impact,
      phase: n.phase,
      status: n.status,
      cluster: n.cluster,
      x: n.x,
      y: n.y,
    })) as RiskNode[],
    edges: data.edges.map((e: Record<string, unknown>) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      edgeType: e.edge_type,
    })),
    clusters: data.clusters.map((c: Record<string, unknown>) => ({
      id: c.id,
      label: c.label,
      keywords: c.keywords,
      size: c.size,
      x: c.x,
      y: c.y,
    })),
    metadata: {
      embeddingModel: data.metadata?.embedding_model,
      clusteringMethod: data.metadata?.clustering_method,
      nNoisePoints: data.metadata?.n_noise_points,
    },
  };
}

export async function uploadAndAnalyzeCSV(
  file: File,
  params?: {
    minClusterSize?: number;
    similarityThreshold?: number;
    maxEdgesPerNode?: number;
  }
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const queryParams = new URLSearchParams();
  if (params?.minClusterSize) {
    queryParams.append('min_cluster_size', String(params.minClusterSize));
  }
  if (params?.similarityThreshold) {
    queryParams.append('similarity_threshold', String(params.similarityThreshold));
  }
  if (params?.maxEdgesPerNode) {
    queryParams.append('max_edges_per_node', String(params.maxEdgesPerNode));
  }

  const url = `${API_BASE}/upload-csv${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Upload failed');
  }

  const data = await response.json();

  // Convert snake_case to camelCase (same as above)
  return {
    nodes: data.nodes.map((n: Record<string, unknown>) => ({
      id: n.id || n.external_id,
      title: n.title,
      description: n.description,
      cause: n.cause,
      url: n.url,
      cost: n.cost,
      likelihood: n.likelihood,
      impact: n.impact,
      phase: n.phase,
      status: n.status,
      cluster: n.cluster,
      x: n.x,
      y: n.y,
    })) as RiskNode[],
    edges: data.edges.map((e: Record<string, unknown>) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      edgeType: e.edge_type,
    })),
    clusters: data.clusters.map((c: Record<string, unknown>) => ({
      id: c.id,
      label: c.label,
      keywords: c.keywords,
      size: c.size,
      x: c.x,
      y: c.y,
    })),
    metadata: {
      embeddingModel: data.metadata?.embedding_model,
      clusteringMethod: data.metadata?.clustering_method,
      nNoisePoints: data.metadata?.n_noise_points,
    },
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
