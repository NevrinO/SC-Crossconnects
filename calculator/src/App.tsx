import { useState, useMemo, useEffect } from 'react';
import roomsData from './data/rooms.json';
import type { Room, CalculationResult } from './types/room';
import { calculateManual, getAvailablePaths, validateRackLocationInput } from './lib/calculation';
import { validateRooms } from './lib/validation';
import RoomSelector from './components/RoomSelector';
import CabinetInput from './components/CabinetInput';
import CableTypeSelector from './components/CableTypeSelector';
import PathSelector from './components/PathSelector';
import SlackInput from './components/SlackInput';
import CalculateButton from './components/CalculateButton';
import ResultsTable from './components/ResultsTable';

export default function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [startCabinet, setStartCabinet] = useState('');
  const [endCabinet, setEndCabinet] = useState('');
  const [cableType, setCableType] = useState<'fiber' | 'copper' | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [slack, setSlack] = useState(0);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load and validate rooms data on mount
  useEffect(() => {
    try {
      const validatedRooms = validateRooms(roomsData);
      setRooms(validatedRooms);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load rooms data');
    }
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [selectedRoomId]
  );

  const availablePaths = useMemo(() => {
    if (!selectedRoom || !cableType) return [];
    return getAvailablePaths(selectedRoom, cableType);
  }, [selectedRoom, cableType]);

  const canCalculate =
    selectedRoom &&
    cableType &&
    selectedPathId &&
    validateRackLocationInput(startCabinet) &&
    validateRackLocationInput(endCabinet);

  function handleCalculate() {
    setError(null);
    if (!canCalculate || !selectedRoom || !cableType || !selectedPathId) return;

    const segment = availablePaths.find((s) => s.id === selectedPathId);
    if (!segment) {
      setError('Selected path not found.');
      return;
    }

    const result = calculateManual(
      startCabinet,
      endCabinet,
      [segment],
      cableType,
      slack,
      selectedRoom
    );

    if (!result) {
      setError('Could not calculate. Check that both cabinets are in the same room and valid.');
      return;
    }

    setResults((prev) => [...prev, result]);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Cross Connect Calculator</h1>

      {loadError && (
        <div className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <strong>Error loading application:</strong> {loadError}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <RoomSelector
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSelect={(id) => {
            setSelectedRoomId(id);
            setSelectedPathId(null);
            setError(null);
          }}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CabinetInput
            label="Starting Rack"
            value={startCabinet}
            onChange={setStartCabinet}
          />
          <CabinetInput
            label="Ending Rack"
            value={endCabinet}
            onChange={setEndCabinet}
          />
        </div>

        <CableTypeSelector
          value={cableType}
          onChange={(type) => {
            setCableType(type);
            setSelectedPathId(null);
            setError(null);
          }}
        />

        <PathSelector
          segments={availablePaths}
          selectedSegmentId={selectedPathId}
          onSelect={setSelectedPathId}
        />

        <SlackInput value={slack} onChange={setSlack} />

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <CalculateButton
          disabled={!canCalculate}
          onClick={handleCalculate}
        />
      </div>

      <ResultsTable results={results} />

      {results.length > 0 && (
        <button
          type="button"
          onClick={() => setResults([])}
          className="mt-4 text-sm text-gray-500 underline hover:text-gray-700"
        >
          Clear results
        </button>
      )}
    </div>
  );
}
