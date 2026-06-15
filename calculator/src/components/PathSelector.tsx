import { useState, useEffect } from 'react';
import type { PathResult } from '../lib/pathfinding';

interface PathSelectorProps {
  paths: PathResult[];
  selectedPath: PathResult | null;
  onSelect: (path: PathResult) => void;
  isCalculating: boolean;
  error: string | null;
}

const INITIAL_LIMIT = 4;

export default function PathSelector({ paths, selectedPath, onSelect, isCalculating, error }: PathSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  // Reset collapsed state when paths change (new calculation)
  useEffect(() => {
    setShowAll(false);
  }, [paths]);

  const visiblePaths = showAll ? paths : paths.slice(0, INITIAL_LIMIT);
  const hasMore = paths.length > INITIAL_LIMIT;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        Select Path (auto-calculated when cabinets entered)
      </label>
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
            return (
              <div
                key={index}
                className={`cursor-pointer border-b border-gray-200 px-3 py-2 last:border-b-0 hover:bg-gray-50 ${
                  isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''
                }`}
                onClick={() => onSelect(path)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="path"
                    checked={isSelected}
                    onChange={() => onSelect(path)}
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
