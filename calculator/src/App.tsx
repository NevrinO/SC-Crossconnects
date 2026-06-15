import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import roomsData from './data/rooms.json';
import type { Room, CalculationResult } from './types/room';
import { calculateManual, validateRackLocationInput } from './lib/calculation';
import { validateRooms } from './lib/validation';
import { usePathCalculation } from './hooks/usePathCalculation';
import { initializeSessionCleanup } from './lib/storage';
import type { StoredSession } from './lib/storage';
import RoomSelector from './components/RoomSelector';
import CabinetInput from './components/CabinetInput';
import CableTypeSelector from './components/CableTypeSelector';
import PathSelector from './components/PathSelector';
import SlackInput from './components/SlackInput';
import CalculateButton from './components/CalculateButton';
import ResultsTable from './components/ResultsTable';
import CsvImport from './components/CsvImport';
import SessionsPanel from './components/SessionsPanel';
import { RoomMapContainer } from './components/RoomMapContainer';
import { GridLayer } from './components/GridLayer';
import { CabinetLayer } from './components/CabinetLayer';
import { SegmentLayer } from './components/SegmentLayer';
import { PathAnimationLayer } from './components/PathAnimationLayer';

export default function App() {
  const [loadError] = useState<string | null>(() => {
    try { validateRooms(roomsData); return null; }
    catch (err) { return err instanceof Error ? err.message : 'Failed to load rooms data'; }
  });
  const [rooms] = useState<Room[]>(() => {
    try { return validateRooms(roomsData); }
    catch { return []; }
  });
  
  // Initialize session cleanup on mount
  useEffect(() => {
    initializeSessionCleanup();
  }, []);

  const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'sessions'>('manual');
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

    // Use the manual calculation with the selected path result
    const result = calculateManual(
      startCabinet,
      endCabinet,
      selectedPath,
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

  function handleViewOnMap(session: StoredSession) {
    // Use the first result from the session to populate the map
    const firstResult = session.results[0];
    if (!firstResult) return;

    // Find the room by ID
    const room = rooms.find(r => r.id === firstResult.room);
    if (!room) return;

    // Set all the state to match the session
    setSelectedRoomId(firstResult.room);
    setStartCabinet(firstResult.start);
    setEndCabinet(firstResult.end);
    setCableType(firstResult.cableType);
    setError(null);

    // Switch to the Manual Calculation tab (map is now embedded there)
    setActiveTab('manual');
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cross Connect Calculator</h1>
        <div className="flex space-x-4">
          <Link
            to="/validate"
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Validation Tool
          </Link>
          <a
            href="/legacy/index.html"
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Legacy Version
          </a>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <strong>Error loading application:</strong> {loadError}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 flex space-x-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'manual'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Manual Calculation
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'csv'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          CSV Import
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Saved Sessions
        </button>
      </div>

      {activeTab === 'manual' && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            {/* Left column - inputs */}
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <RoomSelector
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              onSelect={(id) => {
                setSelectedRoomId(id);
                setError(null);
              }}
            />

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <CabinetInput
                    label="Starting Rack"
                    value={startCabinet}
                    onChange={setStartCabinet}
                    room={selectedRoom}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const temp = startCabinet
                    setStartCabinet(endCabinet)
                    setEndCabinet(temp)
                  }}
                  className="mt-6 px-2 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm shrink-0"
                  title="Swap"
                >
                  ⇄
                </button>
              </div>
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

            {/* Right column - Room Map */}
            {selectedRoom && (
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm self-start h-[calc(100vh-100px)] min-h-[400px] overflow-hidden">
                <RoomMapContainer
                  room={selectedRoom}
                  startCabinet={startCabinet}
                  endCabinet={endCabinet}
                  selectedPathSegments={selectedPath?.segments}
                  cableType={cableType}
                  onSelectStart={setStartCabinet}
                  onSelectEnd={setEndCabinet}
                  onCalculate={handleCalculate}
                >
                  {({ bounds, cellSize, orientation, selectedPathSegments, cableType, startCabinet, endCabinet, highlightedCabinet, onCabinetClick, showGrid, showCabinets, showSegments, showAnimation, showPathTooltips }) => (
                    <>
                      {showGrid && (
                        <GridLayer
                          bounds={bounds}
                          cellSize={cellSize}
                          orientation={orientation}
                        />
                      )}
                      {showCabinets && (
                        <CabinetLayer
                          bounds={bounds}
                          cellSize={cellSize}
                          orientation={orientation}
                          cabinets={selectedRoom.cabinets || []}
                          startCabinet={startCabinet}
                          endCabinet={endCabinet}
                          highlightedCabinet={highlightedCabinet}
                          onCabinetClick={onCabinetClick}
                        />
                      )}
                      {showSegments && (
                        <SegmentLayer
                          bounds={bounds}
                          cellSize={cellSize}
                          orientation={orientation}
                          segments={selectedRoom.pathSegments}
                          selectedPathSegments={selectedPathSegments}
                          cableType={cableType}
                          showPathTooltips={showPathTooltips}
                        />
                      )}
                      {showAnimation && selectedPathSegments && (
                        <PathAnimationLayer
                          bounds={bounds}
                          cellSize={cellSize}
                          orientation={orientation}
                          selectedPathSegments={selectedPathSegments}
                          selectedPathNodes={selectedPath?.nodes}
                          visible={showAnimation}
                        />
                      )}
                    </>
                  )}
                </RoomMapContainer>
              </div>
            )}
          </div>

          {/* Results - full width below */}
          <div className="mt-6">
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
        </>
      )}

      {activeTab === 'csv' && (
        <CsvImport rooms={rooms} onResultsLoaded={(csvResults) => {
          // Convert CSV results to CalculationResult format
          const converted: CalculationResult[] = csvResults
            .filter(r => r.status === 'OK')
            .map(r => ({
              startCab: r.start,
              endCab: r.end,
              lengthFt: r.feet || 0,
              lengthM: r.meters || 0,
              room: r.room || '',
              path: r.path || '',
              sameX: false,
              cableType: r.cableType
            }));
          setResults(converted);
        }} />
      )}

      {activeTab === 'sessions' && (
        <SessionsPanel
          currentResults={results}
          onLoadSession={(sessionResults) => setResults(sessionResults)}
          onViewOnMap={handleViewOnMap}
        />
      )}
    </div>
  );
}
