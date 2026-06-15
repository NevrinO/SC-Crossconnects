import type { Room, PathSegment, CalculationResult, CabinetInfo } from '../types/room';
import type { PathResult } from './pathfinding';
import { CONSTANTS } from './constants';
import { calculateXDistance } from './char-utils';
import roomsData from '../data/rooms.json';

function cabRangeCheck(aRange: string, zRange: string, value: string): boolean {
  const row = value.slice(0, 2);
  const aRow = aRange.slice(0, 2);
  const zRow = zRange.slice(0, 2);
  const cabNum = parseInt(value.slice(2, 5), 10);
  if (isNaN(cabNum)) return false;
  const aRangeCab = parseInt(aRange.slice(2, 5), 10);
  const zRangeCab = parseInt(zRange.slice(2, 5), 10);
  if (isNaN(aRangeCab) || isNaN(zRangeCab)) return false;
  const cabOk = cabNum >= aRangeCab && cabNum <= zRangeCab;
  // Convert row letters to numeric values for correct alphabetical comparison
  const rowNum = calculateXDistance('AA', row, 1, 'letters-first');
  const aRowNum = calculateXDistance('AA', aRow, 1, 'letters-first');
  const zRowNum = calculateXDistance('AA', zRow, 1, 'letters-first');
  const rowOk = rowNum >= aRowNum && rowNum <= zRowNum;
  return rowOk && cabOk;
}

export function getRoom(loc: string): string | null {
  for (const room of roomsData.rooms) {
    const { start, end } = room.xyRange;
    const startLoc = `${start.x}${start.y}`;
    const endLoc = `${end.x}${end.y}`;
    if (cabRangeCheck(startLoc, endLoc, loc)) {
      return room.id;
    }
  }
  return null;
}

export function validateRackLocationInput(rackLoc: string): boolean {
  const trimmed = rackLoc.trim();
  if (trimmed === '') return false;
  if (/[\n\r]/.test(trimmed)) return false;
  const patt = /(^[a-zA-Z]{2}[0-9]{2,3}[a-dA-D]?:[0-9]{1,2}:([0-9]{1,3}\|[0-9]{1,3}|[0-9]{1,3})$|^[a-zA-Z]{2}[0-9]{2,3}[a-dA-D]?$)/;
  return patt.test(trimmed);
}

export function getCabType(loc: string, room: Room): CabinetInfo {
  // Normalize to uppercase for consistent comparison
  const normalized = loc.toUpperCase();
  // Strip port info (e.g., "FR132:1:5" -> "FR132") before suffix-based cabinet type detection
  const cabOnly = normalized.split(':')[0];

  // First check the cabinets array (new format with explicit types)
  if (room.cabinets) {
    const cabinet = room.cabinets.find(c => c.id === cabOnly);
    if (cabinet) {
      // For network_rack, extract panel number from format "CABINET:PANEL:PORT"
      if (cabinet.type === 'network_rack') {
        const parts = normalized.split(':');
        const panel = parts.length >= 2 ? parts[1] : '';
        return { type: 'network_rack', value: panel };
      }
      // For half_cab and quarter_cab, extract suffix from cabinet ID
      if (cabinet.type === 'half_cab' || cabinet.type === 'quarter_cab') {
        const suffix = cabOnly.slice(-1);
        return { type: cabinet.type, value: suffix };
      }
      // full_cab has no value
      return { type: cabinet.type, value: '' };
    }
  }

  // Fallback to specialCabinets for backward compatibility
  const { networkRacks, halfCabs, quarterCabs } = room.specialCabinets;

  // Check for network rack
  if (networkRacks.includes(cabOnly)) {
    // Extract panel number from format "CABINET:PANEL:PORT" (e.g., "EU108:1:5" -> panel "1")
    const parts = normalized.split(':');
    const panel = parts.length >= 2 ? parts[1] : '';
    return { type: 'network_rack', value: panel };
  }

  // Check for half cabinet (must end with A-D)
  if (halfCabs.includes(cabOnly) && /[A-D]$/i.test(cabOnly)) {
    return { type: 'half_cab', value: cabOnly.slice(-1) };
  }

  // Check for quarter cabinet (must end with A-D)
  if (quarterCabs.includes(cabOnly) && /[A-D]$/i.test(cabOnly)) {
    return { type: 'quarter_cab', value: cabOnly.slice(-1) };
  }

  return { type: 'full_cab', value: '' };
}

function convertFeetToMeters(feet: number): number {
  return feet * CONSTANTS.METERS_PER_FOOT;
}

function roundFloat(value: number, toNearest: number, fixed: number): string {
  return (Math.ceil(value / toNearest) * toNearest).toFixed(fixed);
}

function applyCabinetAdjustments(len: number, cabInfo: CabinetInfo): number {
  if (cabInfo.type === 'network_rack') {
    const panel = parseInt(cabInfo.value, 10);
    if (!isNaN(panel)) {
      len += Math.ceil(panel * CONSTANTS.NETWORK_PER_PANEL);
    }
  }
  if (cabInfo.type === 'half_cab' && cabInfo.value === 'B') {
    len += Math.ceil(2 * CONSTANTS.HALF_CAB_STEP);
  }
  if (cabInfo.type === 'quarter_cab') {
    if (cabInfo.value === 'B') {
      len += Math.ceil(1 * CONSTANTS.QUARTER_CAB_STEP);
    } else if (cabInfo.value === 'C') {
      len += Math.ceil(2 * CONSTANTS.QUARTER_CAB_STEP);
    } else if (cabInfo.value === 'D') {
      len += Math.ceil(3 * CONSTANTS.QUARTER_CAB_STEP);
    }
  }
  return len;
}

interface ParsedCabinet {
  x: string;
  y: number;
  portInfo: string;
  raw: string;
}

export function parseCabinetInput(input: string): ParsedCabinet | null {
  const raw = input.toUpperCase().trim();
  if (!validateRackLocationInput(raw)) return null;

  // Extract port info if present
  let portInfo = '';
  let cabStr = raw;

  // Check for port info pattern: AB123:1:1 or AB123:1:1|2
  const portMatch = raw.match(/^([A-Z]{2}\d{2,3}[A-D]?):(\d{1,2}):(\d{1,3}\|\d{1,3}|\d{1,3})$/);
  if (portMatch) {
    cabStr = portMatch[1];
    portInfo = `:${portMatch[2]}:${portMatch[3]}`;
  }

  // Extract X and Y coordinates
  const x = cabStr.slice(0, 2);
  let yStr = cabStr.slice(2);

  // Remove trailing letter for half/quarter cabs
  const suffix = yStr.slice(-1);
  if (/[A-D]/.test(suffix)) {
    yStr = yStr.slice(0, -1);
  }

  const y = parseInt(yStr, 10);
  if (isNaN(y)) return null;

  return { x, y, portInfo, raw: cabStr + portInfo };
}

export function calculateManual(
  startInput: string,
  endInput: string,
  pathResult: PathResult,
  cableType: 'fiber' | 'copper',
  slack: number,
  room: Room
): CalculationResult | null {
  const start = parseCabinetInput(startInput);
  const end = parseCabinetInput(endInput);
  if (!start || !end) return null;

  // Verify both cabinets are in the same room
  const startRoom = getRoom(start.x + String(start.y).padStart(3, '0'));
  const endRoom = getRoom(end.x + String(end.y).padStart(3, '0'));
  if (!startRoom || !endRoom || startRoom !== endRoom || startRoom !== room.id) {
    return null;
  }

  const tileSize = room.tileSize;

  // Calculate tray distance based on the path segments
  // For multi-segment paths, use pre-calculated totalDistance from pathfinding (already includes spillover)
  // For single-segment paths, calculate using the original formula
  let len: number;
  if (pathResult.segments.length > 1) {
    // Multi-segment case: use pathfinding's totalDistance (already includes tray distance + spillover)
    len = pathResult.totalDistance + slack;
  } else {
    // Single-segment case: calculate using original formula
    const segment = pathResult.segments[0];
    if (!segment) return null;

    let totalTrayDistance: number;
    // Use orientation field if available, otherwise fall back to room ID
    const isNumbersHorizontal = room.orientation === 'numbers-horizontal' || room.id === '10';
    if (isNumbersHorizontal) {
      // Room 10: east-west rows, paths run north-south at positions 14/18
      if (start.x === end.x) {
        totalTrayDistance = Math.abs(start.y - end.y) * tileSize;
      } else {
        // Old tool uses slice(3,5) on raw cabinet string
        const startRaw = start.x + String(start.y);
        const endRaw = end.x + String(end.y);
        const startCabLastTwo = startRaw.slice(3, 5);
        const endCabLastTwo = endRaw.slice(3, 5);
        const pathPos = String(segment.start.y);
        totalTrayDistance = (Math.abs(parseInt(startCabLastTwo || '0', 10) - parseInt(pathPos, 10)) +
          Math.abs(parseInt(pathPos, 10) - parseInt(endCabLastTwo || '0', 10))) * tileSize;
      }
      // X distance
      totalTrayDistance += calculateXDistance(start.x, end.x, tileSize, room.coordinateFormat);
    } else {
      // Room 14/28: north-south rows, paths run east-west along rows
      const tempLen = Math.abs(start.y - end.y) * tileSize;
      if (tempLen === 0) {
        // Same cabinet number (same row or different row same position)
        totalTrayDistance = calculateXDistance(start.x, end.x, tileSize, room.coordinateFormat);
      } else {
        totalTrayDistance = tempLen;
        const pathRow = segment.start.x;
        totalTrayDistance += calculateXDistance(start.x, pathRow, tileSize, room.coordinateFormat);
        totalTrayDistance += calculateXDistance(pathRow, end.x, tileSize, room.coordinateFormat);
      }
    }

    // Single-segment: use both entry and exit spillover individually
    const spilloverCost = pathResult.entrySpillover + pathResult.exitSpillover + pathResult.transferSpillovers;
    len = totalTrayDistance + spilloverCost + slack;
  }

  // Determine sameX flag based on cabinet positions
  const sameX = start.x === end.x;

  // Apply cabinet type adjustments (only once at start and end)
  const startInfo = getCabType(startInput.toUpperCase(), room);
  const endInfo = getCabType(endInput.toUpperCase(), room);
  len = applyCabinetAdjustments(len, startInfo);
  len = applyCabinetAdjustments(len, endInfo);

  const lengthFt = parseFloat(len.toFixed(2));
  const lengthM = parseFloat(roundFloat(convertFeetToMeters(len), 0.25, 2));

  return {
    startCab: start.raw,
    endCab: end.raw,
    lengthFt,
    lengthM,
    room: room.name,
    path: pathResult.pathName,
    sameX,
    cableType,
  };
}

export function getAvailablePaths(room: Room, cableType: 'fiber' | 'copper'): PathSegment[] {
  return room.pathSegments.filter((seg) => {
    if (cableType === 'fiber') return seg.fiberHeight !== null;
    return seg.copperHeight !== null;
  });
}

/**
 * Finds the shortest path across all available segments for a given cable type.
 * Iterates through all available paths and returns the calculation result with the minimum length.
 * Returns null if no valid path is found.
 */
export function calculateShortestPath(
  start: string,
  end: string,
  room: Room,
  cableType: 'fiber' | 'copper',
  slack: number
): CalculationResult | null {
  const availablePaths = getAvailablePaths(room, cableType);
  if (availablePaths.length === 0) return null;

  let shortestResult: CalculationResult | null = null;
  let shortestLength = Infinity;

  for (const path of availablePaths) {
    // Build a minimal PathResult for single-segment calculation
    const pathResult: import('./pathfinding').PathResult = {
      segments: [path],
      nodes: [path.start.x + '-' + path.start.y, path.end.x + '-' + path.end.y],
      entrySpillover: cableType === 'fiber' ? (path.fiberHeight ?? 0) + room.spilloverAdditionalLength : (path.copperHeight ?? 0) + room.spilloverAdditionalLength,
      exitSpillover: cableType === 'fiber' ? (path.fiberHeight ?? 0) + room.spilloverAdditionalLength : (path.copperHeight ?? 0) + room.spilloverAdditionalLength,
      transferSpillovers: 0,
      totalTrayDistance: 0, // Will be calculated by calculateManual using the pathfinding approach
      totalDistance: 0,
      pathName: path.name,
      isShortest: true,
      percentOverShortest: 0,
    };

    const result = calculateManual(start, end, pathResult, cableType, slack, room);
    if (result && result.lengthFt < shortestLength) {
      shortestResult = result;
      shortestLength = result.lengthFt;
    }
  }

  return shortestResult;
}
