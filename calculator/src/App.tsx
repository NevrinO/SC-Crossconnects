import { useState, useMemo } from 'react';
import roomsData from './data/rooms.json';
import type { Room, CalculationResult } from './types/room';
import { calculateManual, validateRackLocationInput } from './lib/calculation';
import { validateRooms } from './lib/validation';
import { usePathCalculation } from './hooks/usePathCalculation';
import RoomSelector from './components/RoomSelector';
import CabinetInput from './components/CabinetInput';
import CableTypeSelector from './components/CableTypeSelector';
import PathSelector from './components/PathSelector';
import SlackInput from './components/SlackInput';
import CalculateButton from './components/CalculateButton';
import ResultsTable from './components/ResultsTable';

export default function App() {
  const [loadError] = useState<string | null>(() => {
    try { validateRooms(roomsData); return null; }
    catch (err) { return err instanceof Error ? err.message : 'Failed to load rooms data'; }
  });
  const [rooms] = useState<Room[]>(() => {
    try { return validateRooms(roomsData); }
    catch { return []; }
  });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [startCabinet, setStartCabinet] = useState('');
  const [endCabinet, setEndCabinet] = useState('');
  const [cableType, setCableType] = useState<'fiber' | 'copper' | null>(null);
  const [slack, setSlack] = useState(0);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  // Use pathfinding hook for automatic path calculation (only when room is selected)
  const pathCalculation = usePathCalculation(
    selectedRoom || undefined,
    startCabinet,
    endCabinet,
    cableType
  );
  const { paths, selectedPath, isCalculating, error: pathError, selectPath } = pathCalculation;

  const canCalculate =
    selectedRoom &&
    cableType &&
    selectedPath &&
    selectedPath.segments.length > 0 &&
    validateRackLocationInput(startCabinet) &&
    validateRackLocationInput(endCabinet);

  function handleCalculate() {
    setError(null);
    if (!canCalculate || !selectedRoom || !cableType || !selectedPath) return;

    // Use the manual calculation with the selected path segments
    const result = calculateManual(
      startCabinet,
      endCabinet,
      selectedPath.segments,
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
            setError(null);
          }}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CabinetInput
            label="Starting Rack"
            value={startCabinet}
            onChange={setStartCabinet}
            room={selectedRoom}
          />
          <CabinetInput
            label="Ending Rack"
            value={endCabinet}
            onChange={setEndCabinet}
            room={selectedRoom}
          />
        </div>

        <CableTypeSelector
          value={cableType}
          onChange={(type) => {
            setCableType(type);
            setError(null);
          }}
        />

        <PathSelector
          paths={paths}
          selectedPath={selectedPath}
          onSelect={selectPath}
          isCalculating={isCalculating}
          error={pathError}
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
