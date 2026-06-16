import { useState, useEffect } from 'react';
import type { PathResult } from '../lib/pathfinding';
import { computeSharedTiles, getPathTiles } from '../lib/pathfinding';
import { TooltipIcon } from './TooltipIcon';

interface PathSelectorProps {
  paths: PathResult[];
  selectedPath: PathResult | null;
  onSelect: (path: PathResult) => void;
  onDiversePathSelect?: (path: PathResult | null) => void;
  isCalculating: boolean;
  error: string | null;
}

const INITIAL_LIMIT = 4;

export default function PathSelector({ paths, selectedPath, onSelect, onDiversePathSelect, isCalculating, error }: PathSelectorProps) {
  const [showAll, setShowAll] = useState(false);
  const [diversePath, setDiversePath] = useState<PathResult | null>(null);
  const [diverseMode, setDiverseMode] = useState(false);

  // Reset collapsed state when paths change (new calculation)
  // Note: usePathCalculation always creates new array references, so this triggers correctly
  useEffect(() => {
    setShowAll(false);
    setDiversePath(null);
    setDiverseMode(false);
  }, [paths]);

  // Notify parent when diverse path changes
  useEffect(() => {
    onDiversePathSelect?.(diversePath);
  }, [diversePath, onDiversePathSelect]);

  // Clear diverse path when diverse mode is disabled
  useEffect(() => {
    if (!diverseMode) {
      setDiversePath(null);
    }
  }, [diverseMode]);

  const visiblePaths = showAll ? paths : paths.slice(0, INITIAL_LIMIT);
  const hasMore = paths.length > INITIAL_LIMIT;

  // Calculate diversity score for a path relative to selected path
  const getDiversityScore = (path: PathResult): string => {
    if (!selectedPath || path === selectedPath) return '';
    
    const sharedTiles = computeSharedTiles(selectedPath, path);
    const allTiles = getPathTiles(path.nodes);
    
    // Exclude start and end tiles from total (always shared)
    const totalTiles = allTiles.size - 2; // Always subtract 2 for start and end
    
    const sharedCount = sharedTiles;
    
    if (totalTiles <= 0) return '';
    
    const sharedPercent = Math.round((sharedCount / totalTiles) * 100);
    
    if (sharedPercent === 0) return 'Fully diverse';
    if (sharedPercent > 50) return `Low diversity (${sharedPercent}% shared)`;
    return `${sharedPercent}% shared`;
  };

  const getDiversityBadgeColor = (path: PathResult): string => {
    if (!selectedPath || path === selectedPath) return '';
    
    const sharedTiles = computeSharedTiles(selectedPath, path);
    const allTiles = getPathTiles(path.nodes);
    
    // Exclude start and end tiles from total (always shared)
    const totalTiles = allTiles.size - 2; // Always subtract 2 for start and end
    
    const sharedCount = sharedTiles;
    
    if (totalTiles <= 0) return '';
    
    const sharedPercent = (sharedCount / totalTiles) * 100;
    
    if (sharedPercent === 0) return 'bg-green-100 text-green-700';
    if (sharedPercent > 50) return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  const handlePathClick = (path: PathResult) => {
    if (diverseMode) {
      // Diverse mode: clicking a path sets it as diverse (if primary is selected)
      if (diversePath === path) {
        setDiversePath(null);
        return;
      }
      
      if (path === selectedPath) {
        onSelect(path);
        setDiversePath(null);
        return;
      }
      
      if (selectedPath) {
        setDiversePath(path);
      } else {
        onSelect(path);
      }
    } else {
      // Normal mode: clicking any path sets it as primary
      onSelect(path);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700">
          Select Path (auto-calculated when cabinets entered)
        </label>
        <TooltipIcon content="Each path is a physical tray route through the room. The calculator auto-suggests ranked paths — shortest is pre-selected. Pick a different path for redundancy." />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="diverse-mode"
          checked={diverseMode}
          onChange={(e) => setDiverseMode(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="diverse-mode" className="text-sm text-gray-600">
          Enable diverse path selection (pick two paths for redundancy)
        </label>
      </div>
      {isCalculating && (
        <span className="text-xs text-gray-500">Calculating paths...</span>
      )}
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
      {!isCalculating && !error && paths.length === 0 && (
        <span className="text-xs text-gray-500">Enter both cabinets to calculate paths.</span>
      )}
      {!isCalculating && !error && paths.length > 0 && (
        <div className="rounded-md border border-gray-300 bg-white">
          {visiblePaths.map((path, index) => {
            const isSelected = selectedPath === path;
            const isDiverse = diversePath === path;
            const diversityScore = getDiversityScore(path);
            const diversityBadgeColor = getDiversityBadgeColor(path);
            return (
              <div
                key={index}
                className={`cursor-pointer border-b border-gray-200 px-3 py-2 last:border-b-0 hover:bg-gray-50 ${
                  isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''
                } ${isDiverse ? 'bg-purple-50 ring-1 ring-inset ring-purple-300' : ''}`}
                onClick={() => handlePathClick(path)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="path"
                    checked={isSelected}
                    onChange={() => handlePathClick(path)}
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    {/* Primary path identifier — start and end cabinets */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{path.nodes[0].replace('-', '')} → {path.nodes[path.nodes.length - 1].replace('-', '')}</span>
                      <span className="text-sm font-medium text-gray-700">~{Math.ceil(path.totalDistance)}ft</span>
                      {path.isShortest && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">shortest</span>
                      )}
                      {!path.isShortest && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">+{path.percentOverShortest.toFixed(0)}% longer</span>
                      )}
                      {diversityScore && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${diversityBadgeColor}`}>{diversityScore}</span>
                      )}
                    </div>
                    {/* Full route — node-level path e.g. FT132→FW132→FW185→GG185 */}
                    <div className="mt-0.5 text-xs text-gray-500">
                      Route: {path.pathName}
                    </div>
                    {/* Distance breakdown */}
                    <div className="mt-0.5 text-xs text-gray-400">
                      Tray {Math.ceil(path.totalTrayDistance)}ft + overhead {Math.ceil(path.entrySpillover)}ft = {Math.ceil(path.totalDistance)}ft
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full border-t border-gray-200 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {showAll
                ? `Show less (${INITIAL_LIMIT} of ${paths.length})`
                : `Show ${paths.length - INITIAL_LIMIT} more paths`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
