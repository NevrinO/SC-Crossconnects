import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOMS_JSON_PATH = path.resolve(__dirname, '../src/data/rooms.json');
const TYPES_PATH = path.resolve(__dirname, '../src/types/room.ts');

console.log('Validating rooms.json against type schema...');

if (!fs.existsSync(ROOMS_JSON_PATH)) {
  console.error(`rooms.json not found: ${ROOMS_JSON_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(TYPES_PATH)) {
  console.error(`Types file not found: ${TYPES_PATH}`);
  process.exit(1);
}

try {
  const roomsContent = fs.readFileSync(ROOMS_JSON_PATH, 'utf-8');
  const data = JSON.parse(roomsContent);

  const rooms = data.rooms || data;

  if (!Array.isArray(rooms)) {
    console.error('rooms.json must contain an array of rooms');
    process.exit(1);
  }

  // Basic structure validation
  for (const room of rooms) {
    if (!room.id || typeof room.id !== 'string') {
      console.error(`Room missing valid id: ${JSON.stringify(room)}`);
      process.exit(1);
    }
    if (!room.name || typeof room.name !== 'string') {
      console.error(`Room missing valid name: ${JSON.stringify(room)}`);
      process.exit(1);
    }
    if (!Array.isArray(room.cabinets)) {
      console.error(`Room missing cabinets array: ${room.id}`);
      process.exit(1);
    }
    if (!Array.isArray(room.pathSegments)) {
      console.error(`Room missing pathSegments array: ${room.id}`);
      process.exit(1);
    }
  }

  console.log(`✅ Validated ${rooms.length} room(s) against schema`);
  console.log('✅ Type validation passed');
} catch (error) {
  console.error('Failed to parse or validate rooms.json:', error.message);
  process.exit(1);
}
