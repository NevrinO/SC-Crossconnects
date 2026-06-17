// Generate test CSV for legacy calculator
// Format: Start,End,Type,Path,Slack

const fs = require('fs');
const path = require('path');

// Load actual room data from rooms.json
const roomsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'rooms.json'), 'utf-8'));

// Extract cabinet IDs for each room from rooms.json
const ROOM_CABINETS = {};

roomsData.rooms.forEach(room => {
  const roomId = room.id.replace('CR-', '');
  if (room.cabinets && room.cabinets.length > 0) {
    ROOM_CABINETS[roomId] = room.cabinets.map(cab => cab.id);
  }
});

// For rooms not in rooms.json, use legacy calculator ranges
// CR-10: CT105-EW129, CR-28: HM085-IV152
const LEGACY_ROOM_RANGES = {
  '10': { startRow: 'CT', endRow: 'EW', startCab: 105, endCab: 129 },
  '28': { startRow: 'HM', endRow: 'IV', startCab: 85, endCab: 152 }
};

// Path mappings based on room ID
const ROOM_PATHS = {
  '10': ['e', 'w'],
  '14': ['n', 's'],
  '28': ['n', 's', 'h']
};

// Legacy calculator's row traversal functions
function nextChar(c) {
  const u = c.toUpperCase();
  if (same(u, 'Z')) {
    let txt = '';
    let i = u.length;
    while (i--) {
      txt += 'A';
    }
    return (txt + 'A');
  } else {
    let p = "";
    let q = "";
    if (u.length > 1) {
      p = u.substring(0, u.length - 1);
      q = String.fromCharCode(p.slice(-1).charCodeAt(0));
    }
    const l = u.slice(-1).charCodeAt(0);
    const z = nextLetter(l);
    if (z === 'A') {
      return p.slice(0, -1) + nextLetter(q.slice(-1).charCodeAt(0)) + z;
    } else {
      return p + z;
    }
  }
}

function nextLetter(l) {
  if (l < 90) {
    return String.fromCharCode(l + 1);
  } else {
    return 'A';
  }
}

function same(str, char) {
  let i = str.length;
  while (i--) {
    if (str[i] !== char) {
      return false;
    }
  }
  return true;
}

function generateLegacyCabinets(roomRange) {
  const cabinets = [];
  let currentRow = roomRange.startRow;
  const endRow = roomRange.endRow;
  
  // Generate all rows in range
  let maxIterations = 1000;
  let iterations = 0;
  
  while (currentRow !== endRow && iterations < maxIterations) {
    for (let cab = roomRange.startCab; cab <= roomRange.endCab; cab++) {
      cabinets.push(currentRow + cab.toString().padStart(3, '0'));
    }
    currentRow = nextChar(currentRow);
    iterations++;
  }
  
  // Add the end row
  for (let cab = roomRange.startCab; cab <= roomRange.endCab; cab++) {
    cabinets.push(endRow + cab.toString().padStart(3, '0'));
  }
  
  return cabinets;
}

function getRandomCabInRoom(roomId) {
  // Use actual cabinet data if available
  const cabinets = ROOM_CABINETS[roomId];
  if (cabinets && cabinets.length > 0) {
    return cabinets[Math.floor(Math.random() * cabinets.length)];
  }
  
  // Fall back to legacy range generation
  const range = LEGACY_ROOM_RANGES[roomId];
  if (!range) {
    throw new Error(`No cabinet data or range found for room ${roomId}`);
  }
  
  // Generate cabinets on first use for this room
  if (!ROOM_CABINETS[roomId]) {
    ROOM_CABINETS[roomId] = generateLegacyCabinets(range);
  }
  
  return ROOM_CABINETS[roomId][Math.floor(Math.random() * ROOM_CABINETS[roomId].length)];
}

function generateTestCases(roomId, count) {
  const paths = ROOM_PATHS[roomId];
  
  if (!paths || paths.length === 0) {
    throw new Error(`No paths found for room ${roomId}`);
  }

  const cases = [];
  
  for (let i = 0; i < count; i++) {
    const start = getRandomCabInRoom(roomId);
    let end = getRandomCabInRoom(roomId);
    
    // Ensure start and end are different
    while (end === start) {
      end = getRandomCabInRoom(roomId);
    }
    
    const cableType = Math.random() > 0.5 ? 'fiber' : 'copper';
    const path = paths[Math.floor(Math.random() * paths.length)];
    const slack = '0'; // Default slack
    
    cases.push([start, end, cableType, path, slack]);
  }
  
  return cases;
}

function main() {
  const allCases = [['Start', 'End', 'Type', 'Path', 'Slack']];
  
  // Generate 100 test cases per room for all 3 rooms
  const roomIds = ['10', '14', '28'];
  for (const roomId of roomIds) {
    const cases = generateTestCases(roomId, 100);
    allCases.push(...cases);
  }
  
  // Convert to CSV
  const csv = allCases.map(row => row.join(',')).join('\n');
  
  // Write to file
  const outputPath = path.join(__dirname, '..', 'legacy-test-cases.csv');
  fs.writeFileSync(outputPath, csv, { encoding: 'utf8' });
  console.log(`Generated ${allCases.length - 1} test cases to ${outputPath}`);
}

main();
