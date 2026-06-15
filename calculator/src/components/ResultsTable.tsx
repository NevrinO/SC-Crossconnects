import { useState } from 'react';
import type { CalculationResult } from '../types/room';

interface ResultsTableProps {
  results: CalculationResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (results.length === 0) return null;

  const handleCopy = (result: CalculationResult, index: number) => {
    const tabDelimited = `${result.startCab}\t${result.endCab}\t${result.room}\t${result.cableType}\t${result.lengthFt}\t${result.lengthM}\t${result.path}`;
    navigator.clipboard.writeText(tabDelimited);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Results</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {results.map((result, index) => (
          <div key={`${result.startCab}-${result.endCab}-${result.room}-${result.path}-${index}`} className="px-4 py-3">
            <div className="flex items-start justify-between">
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
                </div>
                <div className="text-xs text-gray-400">{result.room}</div>
              </div>
              <button
                onClick={() => handleCopy(result, index)}
                className="ml-2 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                title="Copy to clipboard"
              >
                {copiedIndex === index ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
