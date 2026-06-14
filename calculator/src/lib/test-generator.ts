import type { Room } from '../types/room';

export interface TestCase {
  room: string;
  start: string;
  end: string;
  cableType: 'fiber' | 'copper';
}

export interface ValidationResult {
  testCase: TestCase;
  newToolResult: number;
  oldToolResult?: number;
  match: boolean;
  difference?: number;
}

// Derive room ranges from actual Room data
function getRoomRange(rooms: Room[], roomId: string): { start: string; end: string } | null {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return null;

  // Find min and max cabinet positions from path segments
  let minX = 'ZZ';
  let maxX = 'AA';
  let minY = Infinity;
  let maxY = -Infinity;

  for (const seg of room.pathSegments) {
    const startX = seg.start.x;
    const endX = seg.end.x;
    const startY = seg.start.y;
    const endY = seg.end.y;

    if (startX < minX) minX = startX;
    if (endX < minX) minX = endX;
    if (startX > maxX) maxX = startX;
    if (endX > maxX) maxX = endX;

    if (startY < minY) minY = startY;
    if (endY < minY) minY = endY;
    if (startY > maxY) maxY = startY;
    if (endY > maxY) maxY = endY;
  }

  if (minX === 'ZZ' || minY === Infinity) return null;

  return {
    start: minX + minY.toString().padStart(3, '0'),
    end: maxX + maxY.toString().padStart(3, '0')
  };
}

function getRandomCabinetInRoom(rooms: Room[], roomId: string): string {
  const range = getRoomRange(rooms, roomId);
  if (!range) return 'AB123';

  const startRow = range.start.slice(0, 2);
  const endRow = range.end.slice(0, 2);
  const startCab = parseInt(range.start.slice(2, 5), 10);
  const endCab = parseInt(range.end.slice(2, 5), 10);

  // Generate random row between start and end
  const startRowCode = startRow.charCodeAt(0) * 26 + startRow.charCodeAt(1);
  const endRowCode = endRow.charCodeAt(0) * 26 + endRow.charCodeAt(1);
  const rowCode = Math.floor(Math.random() * (endRowCode - startRowCode + 1)) + startRowCode;
  const row1 = String.fromCharCode(65 + Math.floor(rowCode / 26));
  const row2 = String.fromCharCode(65 + (rowCode % 26));
  const row = row1 + row2;

  // Generate random cabinet number
  const cab = Math.floor(Math.random() * (endCab - startCab + 1)) + startCab;

  return row + cab.toString().padStart(3, '0');
}

export function generateTestCases(
  rooms: Room[],
  count: number
): TestCase[] {
  const testCases: TestCase[] = [];
  const roomIds = rooms.map(r => r.id);

  for (let i = 0; i < count; i++) {
    const roomId = roomIds[Math.floor(Math.random() * roomIds.length)];
    const start = getRandomCabinetInRoom(rooms, roomId);
    let end = getRandomCabinetInRoom(rooms, roomId);

    // Ensure start and end are different
    while (end === start) {
      end = getRandomCabinetInRoom(rooms, roomId);
    }

    const cableType: 'fiber' | 'copper' = Math.random() > 0.5 ? 'fiber' : 'copper';

    testCases.push({
      room: roomId,
      start,
      end,
      cableType
    });
  }

  return testCases;
}

export async function runValidation(
  testCases: TestCase[],
  _oldToolBaseUrl: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const testCase of testCases) {
    // For now, we'll just return the test case structure
    // The actual validation would require:
    // 1. Running the new tool calculation
    // 2. Fetching results from the old tool (via iframe or API)
    // 3. Comparing the results
    
    results.push({
      testCase,
      newToolResult: 0, // Placeholder
      match: false
    });
  }

  return results;
}
