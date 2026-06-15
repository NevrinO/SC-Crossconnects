import { useState, useEffect } from 'react';
import type { StoredSession } from '../lib/storage';
import { loadSessions, saveSession, deleteSession, createSessionId } from '../lib/storage';
import type { CalculationResult } from '../types/room';

interface SessionsPanelProps {
  onLoadSession: (results: CalculationResult[]) => void;
  onViewOnMap: (session: StoredSession) => void;
  currentResults: CalculationResult[];
}

export default function SessionsPanel({ onLoadSession, onViewOnMap, currentResults }: SessionsPanelProps) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessionsList();
  }, []);

  const loadSessionsList = () => {
    setSessions(loadSessions());
  };

  const handleSaveSession = () => {
    if (currentResults.length === 0) return;

    const session: StoredSession = {
      id: createSessionId(),
      timestamp: new Date().toISOString(),
      name: sessionName || `Session ${new Date().toLocaleDateString()}`,
      results: currentResults.map(r => ({
        id: createSessionId(),
        timestamp: new Date().toISOString(),
        start: r.startCab,
        end: r.endCab,
        room: r.room,
        cableType: r.cableType,
        pathName: r.path,
        feet: r.lengthFt,
        meters: r.lengthM
      }))
    };

    const result = saveSession(session);
    if (!result.success) {
      setError(result.error || 'Failed to save session');
      return;
    }

    setError(null);
    setSessionName('');
    setShowSaveDialog(false);
    loadSessionsList();
  };

  const handleDeleteSession = (id: string) => {
    const result = deleteSession(id);
    if (!result.success) {
      setError(result.error || 'Failed to delete session');
      return;
    }

    setError(null);
    loadSessionsList();
  };

  const handleLoadSession = (session: StoredSession) => {
    const results: CalculationResult[] = session.results.map(r => ({
      startCab: r.start,
      endCab: r.end,
      lengthFt: r.feet,
      lengthM: r.meters,
      room: r.room,
      path: r.pathName,
      sameX: false,
      cableType: r.cableType
    }));
    onLoadSession(results);
  };

  const handleExportSession = (session: StoredSession) => {
    const csv = 'Start,End,Room,Cable Type,Feet,Meters,Path\n' + 
      session.results.map(r => 
        `"${r.start}","${r.end}","${r.room}","${r.cableType}",${r.feet.toFixed(2)},${r.meters.toFixed(2)},"${r.pathName}"`
      ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${(session.name || 'session').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Saved Sessions</h2>
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={currentResults.length === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          Save Current
        </button>
      </div>

      {showSaveDialog && (
        <div className="rounded-md bg-gray-50 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Session Name
          </label>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Session 2024-06-12"
            className="mb-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="space-x-2">
            <button
              onClick={handleSaveSession}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="rounded-md bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No saved sessions</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div>
                <div className="font-medium text-gray-900">{session.name || 'Unnamed Session'}</div>
                <div className="text-xs text-gray-500">
                  {new Date(session.timestamp).toLocaleDateString()} • {session.results.length} calculations
                </div>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleLoadSession(session)}
                  className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Load
                </button>
                <button
                  onClick={() => onViewOnMap(session)}
                  className="rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700"
                >
                  View on Map
                </button>
                <button
                  onClick={() => handleExportSession(session)}
                  className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  Export
                </button>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
