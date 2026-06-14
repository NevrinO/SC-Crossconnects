import type { Room } from '../types/room';
import { validateRackLocationInput, getRoom, calculateShortestPath } from './calculation';

export interface CsvRow {
  start: string;
  end: string;
  cableType: 'fiber' | 'copper';
  slack: number;
  lineNumber: number;
  errorMessage?: string;
}

export interface CsvResult extends CsvRow {
  status: 'OK' | 'ERROR';
  errorMessage?: string;
  feet?: number;
  meters?: number;
  room?: string;
  path?: string;
}

export function parseCsv(content: string): CsvRow[] {
  // Enforce size limits to prevent DoS
  const MAX_FILE_SIZE = 64 * 1024; // 64KB
  const MAX_ROWS = 1000;

  if (content.length > MAX_FILE_SIZE) {
    throw new Error(`CSV file too large (max ${MAX_FILE_SIZE / 1024}KB)`);
  }

  const lines = content.split('\n');
  const rows: CsvRow[] = [];
  let rowCount = 0;

  // Skip header if present - check for exact column header match
  const firstLineLower = lines[0].toLowerCase().trim();
  const hasHeader = firstLineLower === 'start,end,cabletype,slack' ||
                    firstLineLower.startsWith('start,end,cabletype') ||
                    (firstLineLower.includes('start') && firstLineLower.includes('end') && firstLineLower.includes('cable'));
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    rowCount++;
    if (rowCount > MAX_ROWS) {
      throw new Error(`CSV file has too many rows (max ${MAX_ROWS})`);
    }

    const parts = parseCsvLine(line);

    if (parts.length < 3) {
      rows.push({
        start: parts[0] || '',
        end: parts[1] || '',
        cableType: 'fiber',
        slack: 0,
        lineNumber: i + 1,
        errorMessage: `Insufficient columns (expected 4, got ${parts.length})`
      });
      continue;
    }

    const start = parts[0];
    const end = parts[1];
    const cableTypeStr = parts[2].toLowerCase();
    const slack = parts[3] ? parseInt(parts[3], 10) : 0;

    if (cableTypeStr !== 'fiber' && cableTypeStr !== 'copper') {
      rows.push({
        start,
        end,
        cableType: 'fiber',
        slack: 0,
        lineNumber: i + 1,
        errorMessage: `Invalid cable type: ${parts[2]}`
      });
      continue;
    }

    // Validate slack value: must be non-negative and reasonable
    const validatedSlack = isNaN(slack) ? 0 : slack;
    if (validatedSlack < 0 || validatedSlack > 100) {
      rows.push({
        start,
        end,
        cableType: cableTypeStr as 'fiber' | 'copper',
        slack: validatedSlack,
        lineNumber: i + 1,
        errorMessage: `Slack value out of range: ${parts[3] || ''} (must be 0-100)`
      });
      continue;
    }

    rows.push({
      start,
      end,
      cableType: cableTypeStr as 'fiber' | 'copper',
      slack: validatedSlack,
      lineNumber: i + 1
    });
  }

  return rows;
}

// RFC 4180 compliant CSV line parser that handles quoted fields
function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  parts.push(current.trim());

  return parts;
}

export function processCsvRows(
  rows: CsvRow[],
  rooms: Room[]
): CsvResult[] {
  const results: CsvResult[] = [];

  for (const row of rows) {
    const result: CsvResult = {
      ...row,
      status: 'ERROR',
      errorMessage: ''
    };

    // Surface parse-level errors first
    if (row.errorMessage) {
      result.errorMessage = row.errorMessage;
      results.push(result);
      continue;
    }

    // Validate cabinet format
    if (!validateRackLocationInput(row.start)) {
      result.errorMessage = `Invalid format: ${row.start}`;
      results.push(result);
      continue;
    }

    if (!validateRackLocationInput(row.end)) {
      result.errorMessage = `Invalid format: ${row.end}`;
      results.push(result);
      continue;
    }

    // Check if cabinets are in the same room
    const startRoom = getRoom(row.start);
    const endRoom = getRoom(row.end);

    if (!startRoom || !endRoom) {
      result.errorMessage = 'Cabinet not in room range';
      results.push(result);
      continue;
    }

    if (startRoom !== endRoom) {
      result.errorMessage = 'Cabinets must be in the same room';
      results.push(result);
      continue;
    }

    const room = rooms.find(r => r.id === startRoom);
    if (!room) {
      result.errorMessage = 'Room configuration not found';
      results.push(result);
      continue;
    }

    // Use pathfinding to find the best path
    try {
      const shortestResult = calculateShortestPath(row.start, row.end, room, row.cableType, row.slack);

      if (!shortestResult) {
        result.errorMessage = 'No path available for this cable type';
        results.push(result);
        continue;
      }

      result.status = 'OK';
      result.feet = shortestResult.lengthFt;
      result.meters = shortestResult.lengthM;
      result.room = shortestResult.room;
      result.path = shortestResult.path;
      result.errorMessage = undefined;
    } catch (err) {
      result.errorMessage = err instanceof Error ? err.message : 'Calculation error';
    }

    results.push(result);
  }

  return results;
}

// RFC 4180 compliant CSV field escaping
function escapeCsvField(value: string): string {
  if (!value) return '';
  // Replace quotes with double quotes and wrap in quotes if field contains quotes, commas, or newlines
  const escaped = value.replace(/"/g, '""');
  if (escaped.includes('"') || escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r')) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function generateResultsCsv(results: CsvResult[]): string {
  const header = 'Start,End,LengthFt,LengthM,Room,Path,Status,ErrorDetails\n';
  const rows = results.map(r => {
    const lengthFt = r.feet?.toFixed(2) ?? '0';
    const lengthM = r.meters?.toFixed(2) ?? '0';
    const room = r.room ?? 'N/A';
    const path = r.path ?? 'N/A';
    const error = r.errorMessage ?? '';
    return `${escapeCsvField(r.start)},${escapeCsvField(r.end)},${lengthFt},${lengthM},${escapeCsvField(room)},${escapeCsvField(path)},${r.status},${escapeCsvField(error)}`;
  }).join('\n');

  return header + rows;
}

export function generateLabelsCsv(results: CsvResult[]): string {
  return results
    .filter(r => r.status === 'OK')
    .map(r => `"${r.start}\n${r.end}"`)
    .join('\n');
}
