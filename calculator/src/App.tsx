import { useState, useMemo, useEffect, useCallback } from 'react';
import roomsData from './data/rooms.json';
import type { Room, CalculationResult } from './types/room';
import { calculateManual, validateRackLocationInput } from './lib/calculation';
import { validateRooms } from './lib/validation';
import { usePathCalculation } from './hooks/usePathCalculation';
import { initializeSessionCleanup, createSessionId } from './lib/storage';
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
import { ThemeToggle } from './components/ThemeToggle';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });
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

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    // Use MutationObserver to detect class changes on documentElement
    const observer = new MutationObserver(() => {
      handleThemeChange();
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'sessions' | 'uheight'>('manual');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [startCabinet, setStartCabinet] = useState('');
  const [endCabinet, setEndCabinet] = useState('');
  const [cableType, setCableType] = useState<'fiber' | 'copper' | null>(null);
  const [slack, setSlack] = useState(0);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentSessionName, setCurrentSessionName] = useState<string | null>(null);
  const [diversePath, setDiversePath] = useState<import('./lib/pathfinding').PathResult | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Undo system: tracks operations to support single-level undo
  // Note: This is a single-level undo (no redo). For multi-undo, would need a stack.
  type UndoAction = { type: 'add'; ids: string[] } | { type: 'remove'; results: CalculationResult[] };
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [showUndo, setShowUndo] = useState(false);

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
    const primaryResult = calculateManual(
      startCabinet,
      endCabinet,
      selectedPath,
      cableType,
      slack,
      selectedRoom
    );

    if (!primaryResult) {
      setError('Could not calculate. Check that both cabinets are in the same room and valid.');
      return;
    }

    // If diverse path is also selected, calculate it too
    const resultsToAdd: CalculationResult[] = [{ ...primaryResult, id: createSessionId() }];
    
    if (diversePath) {
      const diverseResult = calculateManual(
        startCabinet,
        endCabinet,
        diversePath,
        cableType,
        slack,
        selectedRoom
      );
      
      if (diverseResult) {
        // Tag the results with PRIMARY/DIVERSE labels
        resultsToAdd[0] = { ...primaryResult, id: createSessionId(), path: `[PRIMARY] ${primaryResult.path}` };
        resultsToAdd.push({ ...diverseResult, id: createSessionId(), path: `[DIVERSE] ${diverseResult.path}` });
      }
    }

    setResults((prev) => {
      const newResults = [...prev, ...resultsToAdd];
      // Track this as an 'add' operation - undo should remove by IDs
      const addedIds = resultsToAdd.map(r => r.id);
      setUndoAction({ type: 'add', ids: addedIds });
      setShowUndo(true);
      return newResults;
    });
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
    setCurrentSessionName(session.name || null);

    // Switch to the Manual Calculation tab (map is now embedded there)
    setActiveTab('manual');
  }

  function handleEditRow(index: number) {
    const result = results[index];
    if (!result) return;

    // Pre-fill form fields from the result
    setSelectedRoomId(result.room);
    setStartCabinet(result.startCab);
    setEndCabinet(result.endCab);
    setCableType(result.cableType);
    setSlack(0); // Reset slack to default
    setError(null);

    // Remove the row from results and track as undoable remove operation
    setResults(prev => {
      const removed = prev[index];
      const newResults = prev.filter((_, i) => i !== index);
      setUndoAction({ type: 'remove', results: [removed] });
      setShowUndo(true);
      return newResults;
    });

    // Show editing message
    setEditMessage('Editing row — original removed. Recalculate to re-add.');
    setTimeout(() => setEditMessage(null), 5000);
  }

  function handleQtyChange(index: number, qty: number) {
    setResults(prev => prev.map((r, i) => 
      i === index ? { ...r, qty } : r
    ));
  }

  function handleDeleteSelected(indices: number[]) {
    // Store all removed rows for undo
    const sortedIndices = [...indices].sort((a, b) => b - a);
    const removedRows = sortedIndices.map(i => results[i]);
    
    setResults(prev => prev.filter((_, i) => !indices.includes(i)));
    // Track this as a 'remove' operation - undo should restore all removed rows
    setUndoAction({ type: 'remove', results: removedRows });
    setShowUndo(true);
  }

  function handleClearAll() {
    if (results.length > 0) {
      const allRows = [...results];
      setResults([]);
      // Track this as a 'remove' operation - undo should restore all rows
      setUndoAction({ type: 'remove', results: allRows });
      setShowUndo(true);
    }
  }

  const handleUndo = useCallback(() => {
    if (!undoAction) return;
    
    if (undoAction.type === 'add') {
      // Undo an add: remove the results by their IDs
      setResults(prev => prev.filter(r => !undoAction.ids.includes(r.id)));
    } else if (undoAction.type === 'remove') {
      // Undo a remove: restore all removed rows
      setResults(prev => [...prev, ...undoAction.results]);
    }
    
    setUndoAction(null);
    setShowUndo(false);
  }, [undoAction]);

  // Handle Ctrl+Z for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoAction]);

  function handleFormKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && canCalculate) {
      // Don't trigger if focus is in a text input within the form
      const activeElement = document.activeElement;
      if (activeElement && e.currentTarget.contains(activeElement) && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      handleCalculate();
    }
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cross Connect Calculator</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowHelpModal(true)}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Help
          </button>
          <ThemeToggle />
          <button
            onClick={() => {
              if (isDarkMode && !confirm('Warning: Legacy Version only supports light mode. Continue?')) {
                return;
              }
              window.location.href = '/legacy/index.html';
            }}
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Legacy Version
          </button>
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
        <button
          onClick={() => setActiveTab('uheight')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'uheight'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          U-Height Calc
        </button>
      </div>

      {activeTab === 'manual' && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            {/* Left column - inputs */}
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" onKeyDown={handleFormKeyDown}>
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
              onDiversePathSelect={setDiversePath}
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
                  diversePathSegments={diversePath?.segments}
                  cableType={cableType}
                  onSelectStart={setStartCabinet}
                  onSelectEnd={setEndCabinet}
                  onCalculate={handleCalculate}
                >
                  {({ bounds, cellSize, orientation, selectedPathSegments, diversePathSegments, cableType, startCabinet, endCabinet, highlightedCabinet, onCabinetClick, showGrid, showCabinets, showSegments, showAnimation, showPathTooltips }) => (
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
                          diversePathSegments={diversePathSegments}
                          selectedPathNodes={selectedPath?.nodes}
                          diversePathNodes={diversePath?.nodes}
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
            {editMessage && (
              <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {editMessage}
              </div>
            )}
            {showUndo && undoAction && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                <span>Last action can be undone</span>
                <button
                  onClick={handleUndo}
                  className="font-medium underline hover:text-yellow-800"
                >
                  Undo
                </button>
                <span className="text-xs text-yellow-600">(Ctrl+Z)</span>
              </div>
            )}
            <ResultsTable 
              results={results} 
              onEditRow={handleEditRow} 
              onQtyChange={handleQtyChange} 
              onDeleteSelected={handleDeleteSelected}
              onClearAll={handleClearAll}
              sessionName={currentSessionName}
            />
          </div>
        </>
      )}

      {activeTab === 'csv' && (
        <CsvImport rooms={rooms} onResultsLoaded={(csvResults) => {
          // Convert CSV results to CalculationResult format
          const converted: CalculationResult[] = csvResults
            .filter(r => r.status === 'OK')
            .map(r => ({
              id: createSessionId(),
              startCab: r.start,
              endCab: r.end,
              lengthFt: r.feet || 0,
              lengthM: r.meters || 0,
              room: r.room || '',
              path: r.path || '',
              sameX: false,
              cableType: r.cableType,
              qty: 1 // Default quantity for imported rows
            }));
          setResults(converted);
        }} />
      )}

      {activeTab === 'sessions' && (
        <SessionsPanel
          currentResults={results}
          onLoadSession={(sessionResults, sessionName) => {
            setResults(sessionResults);
            setCurrentSessionName(sessionName || null);
          }}
          onViewOnMap={handleViewOnMap}
          showSaveDialog={showSaveDialog}
          setShowSaveDialog={setShowSaveDialog}
        />
      )}

      {activeTab === 'uheight' && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 shadow-sm text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intra-Cabinet U-Height Calculator</h2>
          <p className="text-gray-600 mb-6">
            This feature is coming soon. It will help you calculate cable lengths for connections within a single cabinet,
            accounting for U-positions, side routing, and switch port mappings.
          </p>
          <div className="inline-block rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700">
            Full specification in progress — check back later
          </div>
        </div>
      )}

      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}
