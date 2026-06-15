import type { Room } from '../types/room';

export function validateRooms(data: unknown): Room[] {
  if (!data || typeof data !== 'object' || !('rooms' in data)) {
    throw new Error('Invalid rooms data: expected { rooms: Room[] }');
  }
  const { rooms } = data as Record<string, unknown>;
  if (!Array.isArray(rooms)) {
    throw new Error('Invalid rooms data: rooms must be an array');
  }
  for (const room of rooms) {
    if (!room || typeof room !== 'object') {
      throw new Error('Invalid room data: each room must be an object');
    }
    const r = room as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.tileSize !== 'number') {
      throw new Error('Invalid room data: missing required fields');
    }
    if (!Array.isArray(r.pathSegments)) {
      throw new Error('Invalid room data: pathSegments must be an array');
    }
    // Validate optional fields if present
    if (r.orientation !== undefined) {
      if (r.orientation !== 'numbers-vertical' && r.orientation !== 'numbers-horizontal') {
        throw new Error('Invalid room data: orientation must be "numbers-vertical" or "numbers-horizontal"');
      }
    }
    if (r.startCorner !== undefined) {
      if (typeof r.startCorner !== 'string') {
        throw new Error('Invalid room data: startCorner must be a string');
      }
      const validCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
      if (!validCorners.includes(r.startCorner)) {
        throw new Error('Invalid room data: startCorner must be one of ' + validCorners.join(', '));
      }
    }
    // Add safe fallback for cabinets if missing
    if (!r.cabinets) {
      (r as unknown as Room).cabinets = [];
    }
  }
  return rooms as Room[];
}
