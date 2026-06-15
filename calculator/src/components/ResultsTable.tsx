import { useState, useEffect } from 'react';
import type { CalculationResult } from '../types/room';

interface ResultsTableProps {
  results: CalculationResult[];
  onEditRow?: (index: number) => void;
  onQtyChange?: (index: number, qty: number) => void;
  onDeleteSelected?: (indices: number[]) => void;
  onClearAll?: () => void;
}

export default function ResultsTable({ results, onEditRow, onQtyChange, onDeleteSelected, onClearAll }: ResultsTableProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [localQtys, setLocalQtys] = useState<Record<number, number>>({});
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [invalidQtyIndex, setInvalidQtyIndex] = useState<number | null>(null);

  if (results.length === 0) return null;

  // Clear localQtys when results change externally to avoid stale indices
  useEffect(() => {
    setLocalQtys({});
  }, [results]);

  // Clear selection when results change externally to avoid selecting wrong rows
  useEffect(() => {
    setSelectedIndices(new Set());
  }, [results]);

  const handleCopy = (result: CalculationResult, index: number) => {
    const tabDelimited = `${result.startCab}\t${result.endCab}\t${result.room}\t${result.cableType}\t${result.lengthFt}\t${result.lengthM}\t${result.path}`;
    navigator.clipboard.writeText(tabDelimited);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleQtyChange = (index: number, value: string) => {
    const qty = parseInt(value, 10);
    // Validate quantity: must be between 1 and 99
    if (isNaN(qty) || qty < 1 || qty > 99) {
      setInvalidQtyIndex(index);
      setTimeout(() => setInvalidQtyIndex(null), 2000);
      return;
    }
    setInvalidQtyIndex(null);
    setLocalQtys(prev => ({ ...prev, [index]: qty }));
    onQtyChange?.(index, qty);
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === results.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(results.map((_, i) => i)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIndices.size > 0) {
      onDeleteSelected?.(Array.from(selectedIndices));
      setSelectedIndices(new Set());
    }
  };

  const handleExportCSV = () => {
    const date = new Date().toISOString().split('T')[0];
    const filename = `crossconnect_results_${date}.csv`;
    
    const headers = ['Start', 'End', 'Room', 'Cable Type', 'Qty', 'Feet', 'Meters', 'Path'];
    const rows = results.map(r => [
      r.startCab,
      r.endCab,
      r.room,
      r.cableType,
      r.qty ?? 1,
      r.lengthFt,
      r.lengthM,
      r.path
    ]);
    
    // Proper CSV escaping per RFC 4180: escape embedded quotes by doubling them
    const escapeCsv = (value: string | number) => {
      const str = String(value);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportLabels = () => {
    const date = new Date().toISOString().split('T')[0];
    const filename = `labels_${date}.txt`;
    
    const labelsContent = results
      .map(r => `${r.startCab}\n${r.endCab}`)
      .join('\n\n');
    
    const blob = new Blob([labelsContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIndices.size === results.length && results.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <h3 className="text-sm font-semibold text-gray-900">Results</h3>
          </div>
          <div className="flex gap-2">
            {selectedIndices.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Delete selected ({selectedIndices.size})
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportLabels}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Export Labels
            </button>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {results.map((result, index) => (
          <div key={`${result.startCab}-${result.endCab}-${result.room}-${result.path}-${index}`} className="px-4 py-3">
            <div className="flex items-start justify-between">
              <input
                type="checkbox"
                checked={selectedIndices.has(index)}
                onChange={() => handleToggleSelect(index)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
              />
              <div className="flex-1">
                <div className="text-sm text-gray-900">
                  {result.startCab} → {result.endCab}
                  {!result.sameX && <span className="text-gray-500"> via {result.path}</span>}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-blue-700">{result.lengthFt} ft</span>
                  <span className="text-sm text-gray-500">({result.lengthM} m)</span>
                  {result.turnCount !== undefined && (
                    <span className="text-xs text-gray-400">({result.turnCount} turns)</span>
                  )}
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={localQtys[index] ?? result.qty ?? 1}
                    onChange={(e) => handleQtyChange(index, e.target.value)}
                    className={`w-16 rounded border px-1 py-0.5 text-xs text-center ${
                      invalidQtyIndex === index ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    title="Quantity (1-99)"
                  />
                </div>
                <div className="text-xs text-gray-400">{result.room}</div>
              </div>
              <div className="ml-2 flex gap-1">
                {onEditRow && (
                  <button
                    onClick={() => onEditRow(index)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    title="Edit row"
                  >
                    ✏️
                  </button>
                )}
                <button
                  onClick={() => handleCopy(result, index)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  title="Copy to clipboard"
                >
                  {copiedIndex === index ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {results.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="mt-4 text-sm text-gray-500 underline hover:text-gray-700"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
