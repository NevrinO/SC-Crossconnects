import { useState, useEffect } from 'react';
import type { Room, GridPoint } from '../types/room';
import { findKShortestPaths, findShortestPath, type PathResult } from '../lib/pathfinding';
import { parseCabinetInput } from '../lib/calculation';

interface UsePathCalculationResult {
  paths: PathResult[];
  selectedPath: PathResult | null;
  isCalculating: boolean;
  error: string | null;
  selectPath: (path: PathResult) => void;
}

export function usePathCalculation(
  room: Room | undefined,
  startCab: string,
  endCab: string,
  cableType: 'fiber' | 'copper' | null,
  startU: number = 42, // Default U count for standard cabinets
  endU: number = 42
): UsePathCalculationResult {
  const [paths, setPaths] = useState<PathResult[]>([]);
  const [selectedPath, setSelectedPath] = useState<PathResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Only calculate when room is selected, cable type is chosen, and both cabinets are entered
    if (!room || !cableType || !startCab || !endCab) {
      if (isMounted) {
        setPaths([]);
        setSelectedPath(null);
        setError(null);
      }
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const startParsed = parseCabinetInput(startCab);
      const endParsed = parseCabinetInput(endCab);

      if (!startParsed || !endParsed) {
        if (isMounted) {
          setError('Invalid cabinet format');
          setPaths([]);
          setSelectedPath(null);
          setIsCalculating(false);
        }
        return;
      }

      // Runtime validation for cable type
      if (cableType !== 'fiber' && cableType !== 'copper') {
        if (isMounted) {
          setError('Invalid cable type');
          setPaths([]);
          setSelectedPath(null);
          setIsCalculating(false);
        }
        return;
      }

      const startGridPoint: GridPoint = { x: startParsed.x, y: startParsed.y };
      const endGridPoint: GridPoint = { x: endParsed.x, y: endParsed.y };

      // Calculate k-shortest paths
      let calculatedPaths = findKShortestPaths(
        startGridPoint,
        startU,
        endGridPoint,
        endU,
        cableType,
        room,
        10, // k=10 paths to find more alternatives
        3.0 // max 300% of shortest (show more alternatives)
      );

      // If no paths found (e.g., cross-row routing at same position), fall back to single shortest path
      if (calculatedPaths.length === 0) {
        const singlePath = findShortestPath(
          startGridPoint,
          startU,
          endGridPoint,
          endU,
          cableType,
          room
        );
        if (singlePath) {
          calculatedPaths = [singlePath];
        } else {
          // Provide specific error message based on room data
          if (!room.pathSegments || room.pathSegments.length === 0) {
            if (isMounted) {
              setError('No tray segments defined for this room');
            }
          } else {
            // Check if there are any segments for this cable type
            const hasValidSegments = room.pathSegments.some(seg => {
              return cableType === 'fiber' ? seg.fiberHeight !== null : seg.copperHeight !== null;
            });
            if (!hasValidSegments) {
              if (isMounted) {
                setError(`No ${cableType} tray segments available in this room`);
              }
            } else {
              if (isMounted) {
                setError('No valid path found between these cabinets');
              }
            }
          }
        }
      }

      if (isMounted) {
        setPaths(calculatedPaths);
        // Auto-select the shortest path
        if (calculatedPaths.length > 0) {
          setSelectedPath(calculatedPaths[0]);
        } else {
          // No paths found - clear selection but don't show error
          setSelectedPath(null);
        }
      }
    } catch (err) {
      console.error('Path calculation error:', err);
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Calculation failed');
        setPaths([]);
        setSelectedPath(null);
      }
    } finally {
      if (isMounted) {
        setIsCalculating(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [room, startCab, endCab, cableType, startU, endU]);

  const selectPath = (path: PathResult) => {
    setSelectedPath(path);
  };

  return {
    paths,
    selectedPath,
    isCalculating,
    error,
    selectPath,
  };
}
