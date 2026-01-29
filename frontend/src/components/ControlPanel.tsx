import { useStore } from '../store/useStore';
import {
  Search,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Palette,
  Network,
  Maximize,
  RefreshCw,
  Image,
  FileCode,
} from 'lucide-react';
import { useState } from 'react';
import { analyzeRisks } from '../api/client';
import { downloadSVG, downloadPNG, getDeckCanvas } from '../utils/exportGraph';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label className="text-xs text-muted whitespace-nowrap">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-blue-400"
      />
      <span className="text-xs text-muted w-12 text-right">{value}</span>
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label className="text-xs text-muted">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-6 border border-white/10 rounded bg-transparent cursor-pointer"
      />
    </div>
  );
}

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxRow({ label, checked, onChange }: CheckboxRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label className="text-xs text-muted">{label}</label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-blue-400"
      />
    </div>
  );
}

export function ControlPanel() {
  const {
    nodes,
    edges,
    clusters,
    metadata,
    rawRisks,
    displaySettings,
    forceSettings,
    analysisSettings,
    colorTheme,
    simulationRunning,
    loading,
    updateDisplaySettings,
    updateForceSettings,
    updateAnalysisSettings,
    updateColorTheme,
    setSimulationRunning,
    setData,
    setLoading,
    setError,
  } = useStore();

  const [expandedSection, setExpandedSection] = useState<string | null>('grouping');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const similarityEdgeCount = edges.filter((e) => e.edgeType === 'similarity').length;

  const handleRebuildClustering = async () => {
    if (rawRisks.length === 0) return;

    setLoading(true);
    try {
      const result = await analyzeRisks(rawRisks, {
        clustering: {
          minClusterSize: analysisSettings.minClusterSize,
          clusterSelectionEpsilon: 0.0,
          metric: 'euclidean',
        },
        similarity: {
          threshold: analysisSettings.similarityThreshold,
          maxEdgesPerNode: analysisSettings.maxLinksPerRisk,
        },
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
    setLoading(false);
  };

  const handleResetLayout = () => {
    // Reset simulation with fresh alpha
    setSimulationRunning(true);
  };

  return (
    <aside className="w-96 bg-panel border-r border-border p-3 overflow-y-auto">
      <h1 className="text-base font-semibold mb-1">Risk Network Analyzer</h1>
      <p className="text-xs text-muted mb-3">
        Semantic clustering and similarity visualization for risk registers.
      </p>

      {/* Stats */}
      {nodes.length > 0 && (
        <div className="bg-white/5 rounded-lg p-3 mb-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted">Risks:</span>{' '}
              <span className="font-medium">{nodes.length}</span>
            </div>
            <div>
              <span className="text-muted">Clusters:</span>{' '}
              <span className="font-medium">{clusters.filter((c) => c.id !== -1).length}</span>
            </div>
            <div>
              <span className="text-muted">Similarity links:</span>{' '}
              <span className="font-medium">{similarityEdgeCount}</span>
            </div>
            <div>
              <span className="text-muted">Noise points:</span>{' '}
              <span className="font-medium">{Number(metadata.nNoisePoints ?? 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="Search risks..."
          value={displaySettings.searchQuery}
          onChange={(e) => updateDisplaySettings({ searchQuery: e.target.value })}
          className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-text placeholder:text-muted focus:outline-none focus:border-blue-400/50"
        />
      </div>

      {/* Simulation controls */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setSimulationRunning(!simulationRunning)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors"
        >
          {simulationRunning ? (
            <>
              <Pause className="w-4 h-4" /> Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Resume
            </>
          )}
        </button>
        <button
          onClick={handleResetLayout}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors"
          title="Reset layout"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            // Fit view - would need to calculate bounds
            console.log('Fit view');
          }}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors"
          title="Fit to screen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Grouping & Relevance Section */}
      <div className="border border-white/10 rounded-lg mb-2 overflow-hidden">
        <button
          onClick={() => toggleSection('grouping')}
          className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Network className="w-4 h-4" />
            Grouping & Relevance
          </div>
          <span className="text-muted">{expandedSection === 'grouping' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'grouping' && (
          <div className="p-3 space-y-1">
            <SliderRow
              label="Min cluster size"
              value={analysisSettings.minClusterSize}
              min={2}
              max={10}
              step={1}
              onChange={(value) => updateAnalysisSettings({ minClusterSize: value })}
            />
            <SliderRow
              label="Similarity threshold"
              value={analysisSettings.similarityThreshold}
              min={0.1}
              max={0.9}
              step={0.05}
              onChange={(value) => updateAnalysisSettings({ similarityThreshold: value })}
            />
            <SliderRow
              label="Max links per risk"
              value={analysisSettings.maxLinksPerRisk}
              min={1}
              max={15}
              step={1}
              onChange={(value) => updateAnalysisSettings({ maxLinksPerRisk: value })}
            />
            <CheckboxRow
              label="Show membership edges"
              checked={displaySettings.showMembershipEdges}
              onChange={(checked) => updateDisplaySettings({ showMembershipEdges: checked })}
            />
            <CheckboxRow
              label="Show similarity links"
              checked={displaySettings.showSimilarityEdges}
              onChange={(checked) => updateDisplaySettings({ showSimilarityEdges: checked })}
            />
            <div className="pt-2">
              <button
                onClick={handleRebuildClustering}
                disabled={loading || rawRisks.length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Rebuild clustering
              </button>
            </div>
            <p className="text-xs text-muted pt-2 border-t border-white/10 mt-2">
              <strong>Membership edges:</strong> Connect risks to their cluster centers (thin, faint).
              <br />
              <strong>Similarity links:</strong> Connect semantically similar risks (thick, bright).
              <br /><br />
              Tip: Raise threshold to reduce clutter; lower min cluster size to merge groups.
            </p>
          </div>
        )}
      </div>

      {/* Layout Controls Section */}
      <div className="border border-white/10 rounded-lg mb-2 overflow-hidden">
        <button
          onClick={() => toggleSection('layout')}
          className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings className="w-4 h-4" />
            Layout Controls
          </div>
          <span className="text-muted">{expandedSection === 'layout' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'layout' && (
          <div className="p-3 space-y-1">
            <SliderRow
              label="Risk node size"
              value={displaySettings.nodeSize}
              min={4}
              max={24}
              step={1}
              onChange={(value) => updateDisplaySettings({ nodeSize: value })}
            />
            <SliderRow
              label="Cluster node size"
              value={displaySettings.clusterNodeSize}
              min={10}
              max={40}
              step={1}
              onChange={(value) => updateDisplaySettings({ clusterNodeSize: value })}
            />
            <SliderRow
              label="Label size"
              value={displaySettings.labelSize}
              min={8}
              max={18}
              step={1}
              onChange={(value) => updateDisplaySettings({ labelSize: value })}
            />
            <SliderRow
              label="Label offset"
              value={displaySettings.labelOffset}
              min={0}
              max={20}
              step={1}
              onChange={(value) => updateDisplaySettings({ labelOffset: value })}
            />
            <SliderRow
              label="Repulsion"
              value={forceSettings.repulsion}
              min={10}
              max={500}
              step={10}
              onChange={(value) => updateForceSettings({ repulsion: value })}
            />
            <SliderRow
              label="Member spring"
              value={forceSettings.memberSpring}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(value) => updateForceSettings({ memberSpring: value })}
            />
            <SliderRow
              label="Relevance spring"
              value={forceSettings.relevanceSpring}
              min={0.01}
              max={0.5}
              step={0.01}
              onChange={(value) => updateForceSettings({ relevanceSpring: value })}
            />
            <SliderRow
              label="Damping"
              value={forceSettings.damping}
              min={0.1}
              max={0.95}
              step={0.05}
              onChange={(value) => updateForceSettings({ damping: value })}
            />
            <SliderRow
              label="Collision padding"
              value={forceSettings.collisionPadding}
              min={0}
              max={20}
              step={1}
              onChange={(value) => updateForceSettings({ collisionPadding: value })}
            />
            <CheckboxRow
              label="Show labels"
              checked={displaySettings.showLabels}
              onChange={(checked) => updateDisplaySettings({ showLabels: checked })}
            />
            <CheckboxRow
              label="Show membership edges"
              checked={displaySettings.showMembershipEdges}
              onChange={(checked) => updateDisplaySettings({ showMembershipEdges: checked })}
            />
          </div>
        )}
      </div>

      {/* Colors Section */}
      <div className="border border-white/10 rounded-lg mb-2 overflow-hidden">
        <button
          onClick={() => toggleSection('colors')}
          className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette className="w-4 h-4" />
            Colors
          </div>
          <span className="text-muted">{expandedSection === 'colors' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'colors' && (
          <div className="p-3 space-y-1">
            <ColorRow
              label="Background"
              value={colorTheme.background}
              onChange={(value) => updateColorTheme({ background: value })}
            />
            <ColorRow
              label="Risk nodes"
              value={colorTheme.riskNode}
              onChange={(value) => updateColorTheme({ riskNode: value })}
            />
            <ColorRow
              label="Cluster nodes"
              value={colorTheme.clusterNode}
              onChange={(value) => updateColorTheme({ clusterNode: value })}
            />
            <ColorRow
              label="Membership edges"
              value={colorTheme.membershipEdge}
              onChange={(value) => updateColorTheme({ membershipEdge: value })}
            />
            <ColorRow
              label="Similarity edges"
              value={colorTheme.similarityEdge}
              onChange={(value) => updateColorTheme({ similarityEdge: value })}
            />
            <ColorRow
              label="Labels"
              value={colorTheme.label}
              onChange={(value) => updateColorTheme({ label: value })}
            />
          </div>
        )}
      </div>

      {/* Clusters list */}
      {clusters.length > 0 && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('clusters')}
            className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              Clusters ({clusters.filter((c) => c.id !== -1).length})
            </div>
            <span className="text-muted">{expandedSection === 'clusters' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'clusters' && (
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
              {clusters
                .filter((c) => c.id !== -1)
                .sort((a, b) => b.size - a.size)
                .map((cluster) => (
                  <div
                    key={cluster.id}
                    className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded text-xs"
                  >
                    <div className="flex-1 truncate">
                      <span className="text-muted">#{cluster.id + 1}</span>{' '}
                      <span>{cluster.label}</span>
                    </div>
                    <span className="text-muted ml-2">{cluster.size}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            const canvas = getDeckCanvas();
            if (canvas) {
              downloadPNG(canvas, `risk-network-${Date.now()}.png`);
            } else {
              alert('Could not find canvas for PNG export. Try SVG instead.');
            }
          }}
          disabled={nodes.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Image className="w-4 h-4" />
          PNG
        </button>
        <button
          onClick={() => {
            downloadSVG(
              {
                nodes,
                edges,
                clusters,
                colorTheme,
                displaySettings,
                width: 1200,
                height: 800,
              },
              `risk-network-${Date.now()}.svg`
            );
          }}
          disabled={nodes.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FileCode className="w-4 h-4" />
          SVG
        </button>
      </div>
    </aside>
  );
}
