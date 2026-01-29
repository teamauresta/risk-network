import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { uploadAndAnalyzeCSV } from '../api/client';
import { useStore } from '../store/useStore';

export function FileUpload() {
  const { setData, setRawRisks, setLoading, setError, loading, setSimulationRunning, analysisSettings } = useStore();
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (!file.name.endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await uploadAndAnalyzeCSV(file, {
          minClusterSize: analysisSettings.minClusterSize,
          similarityThreshold: analysisSettings.similarityThreshold,
          maxEdgesPerNode: analysisSettings.maxLinksPerRisk,
        });

        setData({
          nodes: result.nodes,
          edges: result.edges,
          clusters: result.clusters,
          metadata: result.metadata,
        });

        // Store raw risks for rebuilding - extract from nodes
        const rawRisks = result.nodes.map(n => ({
          id: n.id,
          title: n.title,
          description: n.description,
          cause: n.cause,
          url: n.url,
          cost: n.cost,
          likelihood: n.likelihood,
          impact: n.impact,
          phase: n.phase,
          status: n.status,
        }));
        setRawRisks(rawRisks);

        setSimulationRunning(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze file');
      } finally {
        setLoading(false);
      }
    },
    [setData, setRawRisks, setLoading, setError, setSimulationRunning, analysisSettings]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragActive || dragActive
            ? 'border-blue-400 bg-blue-400/10'
            : 'border-white/20 hover:border-white/40 hover:bg-white/5'
        }
      `}
    >
      <input {...getInputProps()} />

      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          <p className="text-sm text-muted">Analyzing risks...</p>
          <p className="text-xs text-muted">
            This may take a moment for large files
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
            {isDragActive ? (
              <FileText className="w-7 h-7 text-blue-400" />
            ) : (
              <Upload className="w-7 h-7 text-muted" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop your CSV file here' : 'Drag & drop a CSV file'}
            </p>
            <p className="text-xs text-muted mt-1">
              or click to browse
            </p>
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-muted">
              id
            </span>
            <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-muted">
              description
            </span>
            <span className="text-xs px-2 py-0.5 bg-white/5 rounded-full text-muted/60">
              title
            </span>
            <span className="text-xs px-2 py-0.5 bg-white/5 rounded-full text-muted/60">
              cause
            </span>
            <span className="text-xs px-2 py-0.5 bg-white/5 rounded-full text-muted/60">
              url
            </span>
          </div>
          <p className="text-xs text-muted">
            Required: id, description • Optional: title, cause, url, cost, likelihood, impact
          </p>
        </div>
      )}
    </div>
  );
}

export function ErrorBanner() {
  const { error, setError } = useStore();

  if (!error) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <p className="flex-1 text-red-200">{error}</p>
      <button
        onClick={() => setError(null)}
        className="text-red-400 hover:text-red-300"
      >
        ×
      </button>
    </div>
  );
}
