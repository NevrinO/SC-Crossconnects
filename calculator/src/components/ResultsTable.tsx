import type { CalculationResult } from '../types/room';

interface ResultsTableProps {
  results: CalculationResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  if (results.length === 0) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Results</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {results.map((result, index) => (
          <div key={`${result.startCab}-${result.endCab}-${result.room}-${result.path}-${index}`} className="px-4 py-3">
            <div className="text-sm text-gray-900">
              {result.startCab} → {result.endCab}
              {!result.sameRow && <span className="text-gray-500"> via {result.path}</span>}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-blue-700">{result.lengthFt} ft</span>
              <span className="text-sm text-gray-500">({result.lengthM} m)</span>
            </div>
            <div className="text-xs text-gray-400">{result.room}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
