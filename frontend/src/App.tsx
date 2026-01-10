import { useEffect, useState, useRef } from 'react';
import { useStore } from './store/useStore';
import { GraphCanvas } from './components/GraphCanvas';
import { ControlPanel } from './components/ControlPanel';
import { FileUpload, ErrorBanner } from './components/FileUpload';
import { healthCheck } from './api/client';
import { AlertCircle, RefreshCw } from 'lucide-react';

function App() {
  const { nodes, loading } = useStore();
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const mainRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Check API health on mount
  useEffect(() => {
    const checkApi = async () => {
      const healthy = await healthCheck();
      setApiStatus(healthy ? 'online' : 'offline');
    };
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => clearInterval(interval);
  }, []);

  // Track container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (mainRef.current) {
        setDimensions({
          width: mainRef.current.clientWidth,
          height: mainRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const hasData = nodes.length > 0;

  return (
    <div className="h-screen flex bg-background text-text">
      {/* Sidebar */}
      {hasData && <ControlPanel />}

      {/* Main content */}
      <main ref={mainRef} className="flex-1 relative overflow-hidden">
        {/* API status indicator */}
        {apiStatus === 'offline' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-200">API server offline</span>
            <button
              onClick={async () => {
                setApiStatus('checking');
                const healthy = await healthCheck();
                setApiStatus(healthy ? 'online' : 'offline');
              }}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error banner */}
        <div className="absolute top-4 left-4 right-4 z-40">
          <ErrorBanner />
        </div>

        {/* Graph or upload prompt */}
        {hasData ? (
          <GraphCanvas width={dimensions.width} height={dimensions.height} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="max-w-lg w-full space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Risk Network Analyzer</h1>
                <p className="text-muted">
                  Upload a CSV file containing risk register data to visualize
                  semantic clusters and relationships.
                </p>
              </div>

              <FileUpload />

              {/* Demo data button */}
              <div className="text-center">
                <button
                  onClick={async () => {
                    // Load demo data
                    const demoRisks = [
                      { id: 'RFT-001', title: 'Unknown services', description: 'Unknown services may be encountered causing rework and delays', cause: 'Incomplete as-builts and congested corridors' },
                      { id: 'RFT-002', title: 'Surface water treatment', description: 'High volumes of surface water require treatment and storage capacity', cause: 'Rainfall events and limited treatment capacity' },
                      { id: 'RFT-003', title: 'Stakeholder availability', description: 'Stakeholder availability limits approvals and testing windows', cause: 'Competing operational priorities and limited windows' },
                      { id: 'RFT-004', title: 'Rock excavation', description: 'Unexpected rock increases excavation effort and reduces productivity', cause: 'Geotechnical variability and blasting restrictions' },
                      { id: 'RFT-005', title: 'Lighting integration', description: 'Lighting systems integration and commissioning delays night works', cause: 'Interface issues and incomplete data' },
                      { id: 'RFT-006', title: 'Industrial relations', description: 'Industrial action reduces productivity and increases costs', cause: 'Labour market conditions and bargaining' },
                      { id: 'RFT-007', title: 'Overseas procurement', description: 'Long lead items delayed due to logistics and shipping constraints', cause: 'Overseas suppliers and lead times' },
                      { id: 'RFT-008', title: 'Contaminated groundwater', description: 'Contaminated groundwater requires dewatering and treatment', cause: 'Existing contamination and uncertain volumes' },
                      { id: 'RFT-009', title: 'Approvals delays', description: 'Regulatory reviews delay permits and cause redesign cycles', cause: 'Reviewer availability and RFI cycles' },
                      { id: 'RFT-010', title: 'Operational windows', description: 'Operational closures constrain production and force resequencing', cause: 'Limited night windows and weather risk' },
                      { id: 'RFT-011', title: 'Pavement quality', description: 'Material quality variability requires rework and retesting', cause: 'Supply chain variability and specification tightness' },
                      { id: 'RFT-012', title: 'Utility isolations', description: 'Service isolations delayed leading to tie-in delays', cause: 'Operational constraints and stakeholder coordination' },
                    ];

                    const { analyzeRisks } = await import('./api/client');
                    const { useStore } = await import('./store/useStore');
                    const store = useStore.getState();

                    store.setLoading(true);
                    try {
                      const result = await analyzeRisks(demoRisks);
                      store.setData({
                        nodes: result.nodes,
                        edges: result.edges,
                        clusters: result.clusters,
                        metadata: result.metadata,
                      });
                      store.setSimulationRunning(true);
                    } catch (err) {
                      store.setError(err instanceof Error ? err.message : 'Failed to load demo');
                    } finally {
                      store.setLoading(false);
                    }
                  }}
                  disabled={loading || apiStatus === 'offline'}
                  className="text-sm text-blue-400 hover:text-blue-300 disabled:text-muted disabled:cursor-not-allowed"
                >
                  Load demo data
                </button>
              </div>

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 text-center text-xs text-muted pt-4 border-t border-white/10">
                <div>
                  <div className="font-medium text-text mb-1">Semantic Clustering</div>
                  <p>HDBSCAN auto-detects natural risk groupings</p>
                </div>
                <div>
                  <div className="font-medium text-text mb-1">Similarity Detection</div>
                  <p>Neural embeddings find related risks</p>
                </div>
                <div>
                  <div className="font-medium text-text mb-1">Interactive Layout</div>
                  <p>Force-directed graph with drag & zoom</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
