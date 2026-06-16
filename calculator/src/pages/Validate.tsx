import { useState } from 'react';
import { Link } from 'react-router-dom';
import roomsData from '../data/rooms.json';
import type { Room } from '../types/room';
import { validateRooms } from '../lib/validation';
import { generateTestCases } from '../lib/test-generator';
import { calculateShortestPath } from '../lib/calculation';
import type { TestCase, ValidationResult } from '../lib/test-generator';

export default function Validate() {
  const [rooms] = useState<Room[]>(() => {
    try { return validateRooms(roomsData); }
    catch { return []; }
  });
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleGenerateTests = () => {
    const generated = generateTestCases(rooms, 20);
    setTestCases(generated);
    setResults([]);
  };

  const handleRunValidation = async () => {
    if (testCases.length === 0) return;
    
    setIsRunning(true);
    const validationResults: ValidationResult[] = [];

    for (const testCase of testCases) {
      const room = rooms.find(r => r.id === testCase.room);
      if (!room) continue;

      const shortestResult = calculateShortestPath(testCase.start, testCase.end, room, testCase.cableType, 0);

      validationResults.push({
        testCase,
        newToolResult: shortestResult?.lengthFt || 0,
        match: false // Would compare with old tool results
      });
    }

    setResults(validationResults);
    setIsRunning(false);
  };

  const handleExportResults = () => {
    const csv = 'Test Case,Start,End,New Tool (ft),Old Tool (ft),Match,Difference\n' +
      results.map((r, i) => {
        const diff = r.oldToolResult !== undefined 
          ? Math.abs(r.newToolResult - r.oldToolResult).toFixed(2)
          : 'N/A';
        const match = r.match ? '✓' : '✗';
        return `"Test ${i + 1}","${r.testCase.start}","${r.testCase.end}",${r.newToolResult.toFixed(2)},${r.oldToolResult?.toFixed(2) || 'N/A'},${match},${diff}`;
      }).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Validation: Old vs New Tool</h1>
        <Link
          to="/"
          className="text-sm text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Back to Calculator
        </Link>
      </div>

      <div className="mb-6 space-y-4">
        <button
          onClick={handleGenerateTests}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Generate 20 Random Test Cases
        </button>

        {testCases.length > 0 && (
          <button
            onClick={handleRunValidation}
            disabled={isRunning}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-400 dark:bg-green-500 dark:hover:bg-green-600 dark:disabled:bg-gray-600"
          >
            {isRunning ? 'Running...' : 'Run Validation'}
          </button>
        )}

        {results.length > 0 && (
          <button
            onClick={handleExportResults}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
          >
            Export Results
          </button>
        )}
      </div>

      {testCases.length > 0 && results.length === 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/50">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">Generated Test Cases ({testCases.length})</h3>
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 sticky top-0 dark:bg-gray-700/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Room</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Start</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">End</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {testCases.map((tc, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{tc.room}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{tc.start}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{tc.end}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{tc.cableType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-900/50">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-100">Validation Results</h3>
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 sticky top-0 dark:bg-gray-700/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Test Case</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Start</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">End</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">New Tool</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Old Tool</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Match?</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Test {i + 1}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.testCase.start}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.testCase.end}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.newToolResult.toFixed(2)}ft</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.oldToolResult?.toFixed(2) || 'N/A'}ft</td>
                    <td className="px-3 py-2">
                      {r.match ? (
                        <span className="text-green-600 dark:text-green-400">✓</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">✗</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.difference !== undefined && r.difference !== null ? (
                        <span className={r.difference > 1 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                          {r.difference > 0 ? `+${r.difference.toFixed(2)}ft` : '0ft'}
                        </span>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
