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
  }
  return rooms as Room[];
}
