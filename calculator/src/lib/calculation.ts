import type { Room, PathSegment, CalculationResult, CabinetInfo } from '../types/room';
import { CONSTANTS } from './constants';
import { calculateRowDistance } from './char-utils';

function cabRangeCheck(aRange: string, zRange: string, value: string): boolean {
  const rowOk = value.slice(0, 2) >= aRange.slice(0, 2) && value.slice(0, 2) <= zRange.slice(0, 2);
  const cabNum = parseInt(value.slice(2, 5), 10);
  if (isNaN(cabNum)) return false;
  const aRangeCab = parseInt(aRange.slice(2, 5), 10);
  const zRangeCab = parseInt(zRange.slice(2, 5), 10);
  if (isNaN(aRangeCab) || isNaN(zRangeCab)) return false;
  const cabOk = cabNum >= aRangeCab && cabNum <= zRangeCab;
  return rowOk && cabOk;
}

export function getRoom(loc: string): string | null {
  if (cabRangeCheck('CT105', 'EW129', loc)) return '10';
  if (cabRangeCheck('FJ132', 'GN185', loc)) return '14';
  if (cabRangeCheck('HM085', 'IV152', loc)) return '28';
  return null;
}

export function validateRackLocationInput(rackLoc: string): boolean {
  const trimmed = rackLoc.trim();
  if (trimmed === '') return false;
  if (/[\n\r]/.test(trimmed)) return false;
  const patt = /(^[a-zA-Z]{2}[0-9]{2,3}[a-dA-D]?:[0-9]{1,2}:([0-9]{1,3}\|[0-9]{1,3}|[0-9]{1,3})$|^[a-zA-Z]{2}[0-9]{2,3}[a-dA-D]?$)/;
  return patt.test(trimmed);
}

export function getCabType(loc: string): CabinetInfo {
  // Normalize to uppercase for consistent comparison
  const normalized = loc.toUpperCase();
  // Strip port info (e.g., "FR132:1:5" -> "FR132") before suffix-based cabinet type detection
  const cabOnly = normalized.split(':')[0];
  if (cabRangeCheck('EU108', 'EU122', cabOnly) || cabRangeCheck('FM155', 'GD155', cabOnly) || cabRangeCheck('IG085', 'IR089', cabOnly)) {
    // Extract panel number from format "CABINET:PANEL:PORT" (e.g., "EU108:1:5" -> panel "1")
    const parts = normalized.split(':');
    const panel = parts.length >= 2 ? parts[1] : '';
    return { type: 'network_rack', value: panel };
  }
  if ((cabRangeCheck('FR132A', 'FS132B', cabOnly) || cabRangeCheck('FV132A', 'GD132B', cabOnly)) && /[A-D]$/i.test(cabOnly)) {
    return { type: 'half_cab', value: cabOnly.slice(5, 6) };
  }
  if (cabRangeCheck('FZ185A', 'GE185D', cabOnly) && /[A-D]$/i.test(cabOnly)) {
    return { type: 'quarter_cab', value: cabOnly.slice(5, 6) };
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
  row: string;
  cabinet: number;
  portInfo: string;
  raw: string;
}

function parseCabinetInput(input: string): ParsedCabinet | null {
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

  // Extract row and cabinet number
  const row = cabStr.slice(0, 2);
  let cabNumStr = cabStr.slice(2);

  // Remove trailing letter for half/quarter cabs
  const suffix = cabNumStr.slice(-1);
  if (/[A-D]/.test(suffix)) {
    cabNumStr = cabNumStr.slice(0, -1);
  }

  const cabinet = parseInt(cabNumStr, 10);
  if (isNaN(cabinet)) return null;

  return { row, cabinet, portInfo, raw: cabStr + portInfo };
}

export function calculateManual(
  startInput: string,
  endInput: string,
  selectedSegments: PathSegment[],
  cableType: 'fiber' | 'copper',
  slack: number,
  room: Room
): CalculationResult | null {
  const start = parseCabinetInput(startInput);
  const end = parseCabinetInput(endInput);
  if (!start || !end) return null;

  // Verify both cabinets are in the same room
  const startRoom = getRoom(start.row + String(start.cabinet).padStart(3, '0'));
  const endRoom = getRoom(end.row + String(end.cabinet).padStart(3, '0'));
  if (!startRoom || !endRoom || startRoom !== endRoom || startRoom !== room.id) {
    return null;
  }

  const tileSize = room.tileSize;
  const offset = room.offset;

  // Get the primary selected segment (Phase 1a uses single segment selection)
  const segment = selectedSegments[0];
  if (!segment) return null;

  // Determine path height based on cable type
  const height = cableType === 'fiber' ? segment.fiberHeight : segment.copperHeight;
  if (height === null) return null;

  // Build the path code similar to old tool for calculation compatibility
  // For room 14/28: path code is like "GD8" (row + height)
  // For room 10: path code is like "146" (position + height)
  let pathCode: string;
  if (room.id === '10') {
    pathCode = String(segment.start.cabinet).padStart(2, '0') + String(height);
  } else {
    pathCode = segment.start.row + String(height);
  }

  let len = height + offset + slack;
  let sameRow = false;

  if (room.id === '10') {
    // Room 10: east-west rows, paths run north-south at positions 14/18
    if (start.row === end.row) {
      len += Math.abs(start.cabinet - end.cabinet) * tileSize;
      sameRow = true;
    } else {
      // Old tool uses slice(3,5) on raw cabinet string (e.g., "CT105" -> "05", "CT12" -> "")
      // Reconstruct raw cabinet string and apply slice(3,5) to match exactly
      const startRaw = start.row + String(start.cabinet);
      const endRaw = end.row + String(end.cabinet);
      const startCabLastTwo = startRaw.slice(3, 5);
      const endCabLastTwo = endRaw.slice(3, 5);
      const pathPos = String(segment.start.cabinet);
      len += (Math.abs(parseInt(startCabLastTwo || '0', 10) - parseInt(pathPos, 10)) +
        Math.abs(parseInt(pathPos, 10) - parseInt(endCabLastTwo || '0', 10))) * tileSize;
    }
    // Row distance
    len += calculateRowDistance(start.row, end.row, tileSize, room.rowFormat);
  } else {
    // Room 14/28: north-south rows, paths run east-west along rows
    const tempLen = Math.abs(start.cabinet - end.cabinet) * tileSize;
    if (tempLen === 0) {
      // Same cabinet number (same row or different row same position)
      len += calculateRowDistance(start.row, end.row, tileSize, room.rowFormat);
      sameRow = start.row === end.row;
    } else {
      len += tempLen;
      const pathRow = pathCode.slice(0, 2);
      len += calculateRowDistance(start.row, pathRow, tileSize, room.rowFormat);
      len += calculateRowDistance(pathRow, end.row, tileSize, room.rowFormat);
    }
  }

  // Apply cabinet type adjustments
  const startInfo = getCabType(startInput.toUpperCase());
  const endInfo = getCabType(endInput.toUpperCase());
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
    path: segment.name,
    sameRow,
  };
}

export function getAvailablePaths(room: Room, cableType: 'fiber' | 'copper'): PathSegment[] {
  return room.pathSegments.filter((seg) => {
    if (cableType === 'fiber') return seg.fiberHeight !== null;
    return seg.copperHeight !== null;
  });
}
