import { useState } from 'react';
import type { Room } from '../types/room';
import type { CsvRow, CsvResult } from '../lib/csv';
import { parseCsv, processCsvRows, generateResultsCsv, generateLabelsCsv } from '../lib/csv';

interface CsvImportProps {
  rooms: Room[];
  onResultsLoaded: (results: CsvResult[]) => void;
}

export default function CsvImport({ rooms, onResultsLoaded }: CsvImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [results, setResults] = useState<CsvResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        try {
          const parsed = parseCsv(content);
          setPreview(parsed.slice(0, 5)); // Show first 5 rows
          setResults([]);
        } catch (err) {
          setError('Failed to parse CSV file');
          console.error(err);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleProcessAll = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const allRows = parseCsv(content);
        const processed = processCsvRows(allRows, rooms);
        setResults(processed);
        onResultsLoaded(processed);
      } catch (err) {
        setError('Failed to process CSV rows');
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadResults = () => {
    const csv = generateResultsCsv(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crossconnect_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadLabels = () => {
    const csv = generateLabelsCsv(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crossconnect_labels.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorCount = results.filter(r => r.status === 'ERROR').length;
  const successCount = results.filter(r => r.status === 'OK').length;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">CSV Import</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Select CSV file
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Format: Start,End,CableType,Slack (e.g., AB123,CD456,fiber,0)
        </p>
      </div>

      {preview.length > 0 && results.length === 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">Preview (first 5 rows)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Start</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">End</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Slack</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {preview.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{row.start}</td>
                    <td className="px-3 py-2">{row.end}</td>
                    <td className="px-3 py-2">{row.cableType}</td>
                    <td className="px-3 py-2">{row.slack}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleProcessAll}
            disabled={isProcessing}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isProcessing ? 'Processing...' : 'Process All'}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Results ({successCount} OK, {errorCount} errors)
            </h3>
            <div className="space-x-2">
              <button
                onClick={handleDownloadResults}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Download Results
              </button>
              <button
                onClick={handleDownloadLabels}
                className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Download Labels
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Start</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">End</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Ft</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">M</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Room</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Path</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {results.map((row, i) => (
                  <tr key={i} className={row.status === 'ERROR' ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2">{row.start}</td>
                    <td className="px-3 py-2">{row.end}</td>
                    <td className="px-3 py-2">{row.feet?.toFixed(2) ?? '-'}</td>
                    <td className="px-3 py-2">{row.meters?.toFixed(2) ?? '-'}</td>
                    <td className="px-3 py-2">{row.room ?? '-'}</td>
                    <td className="px-3 py-2">{row.path ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 text-xs font-medium ${
                        row.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{row.errorMessage ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}
