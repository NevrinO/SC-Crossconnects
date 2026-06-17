import { CoordinateFormat } from '../../types/room'
import { compareXLabels, generateLetterRange } from './grid-utils'

/**
 * Parse a cabinet coordinate string into its components
 * For letters-first: "EU108" -> { prefix: "EU", number: 108 }
 * For numbers-first: "108EU" -> { prefix: "EU", number: 108 }
 */
export function parseCabinetCoordinate(coord: string, format: CoordinateFormat): { prefix: string; number: number } | null {
  if (format === 'letters-first') {
    const match = coord.match(/^([A-Z]{1,3})(\d{1,4})$/)
    if (!match) return null
    return { prefix: match[1], number: parseInt(match[2], 10) }
  } else {
    const match = coord.match(/^(\d{1,4})([A-Z]{1,3})$/)
    if (!match) return null
    return { prefix: match[2], number: parseInt(match[1], 10) }
  }
}

/**
 * Format cabinet components back into a coordinate string
 */
export function formatCabinetCoordinate(prefix: string, number: number, format: CoordinateFormat): string {
  if (format === 'letters-first') {
    return `${prefix}${number}`
  } else {
    return `${number}${prefix}`
  }
}

/**
 * Expand a cabinet range string into individual cabinet IDs
 * Supports both single entries and range syntax
 * Examples:
 * - "EU108" -> ["EU108"]
 * - "EU108-EU122" -> ["EU108", "EU109", ..., "EU122"]
 * - "108EU-122EU" (numbers-first) -> ["108EU", "109EU", ..., "122EU"]
 */
export function expandCabinetRange(range: string, format: CoordinateFormat): string[] {
  const results: string[] = []
  const lines = range.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  for (const line of lines) {
    // Check if this is a range (contains a dash)
    if (line.includes('-')) {
      const parts = line.split('-').map(p => p.trim())
      if (parts.length === 2) {
        const start = parseCabinetCoordinate(parts[0], format)
        const end = parseCabinetCoordinate(parts[1], format)

        if (start && end && start.prefix === end.prefix) {
          // Same-prefix range: expand by number (e.g. FN130-FN160)
          const minNum = Math.min(start.number, end.number)
          const maxNum = Math.max(start.number, end.number)
          for (let num = minNum; num <= maxNum; num++) {
            results.push(formatCabinetCoordinate(start.prefix, num, format))
          }
        } else if (start && end && start.number === end.number) {
          // Cross-prefix range, same number: expand by letter column (e.g. FN150-GD150)
          const prefixes = generateLetterRange(start.prefix, end.prefix)
          for (const prefix of prefixes) {
            results.push(formatCabinetCoordinate(prefix, start.number, format))
          }
        } else if (start && end) {
          // Cross-prefix, different numbers: expand all prefixes x all numbers
          const prefixes = generateLetterRange(start.prefix, end.prefix)
          const minNum = Math.min(start.number, end.number)
          const maxNum = Math.max(start.number, end.number)
          const totalSize = prefixes.length * (maxNum - minNum + 1)
          if (totalSize > 1000) {
            throw new Error(`Range too large: ${totalSize} cabinets exceeds maximum 1000`)
          }
          for (const prefix of prefixes) {
            for (let num = minNum; num <= maxNum; num++) {
              results.push(formatCabinetCoordinate(prefix, num, format))
            }
          }
        } else {
          // Unparseable range, treat as single entry
          results.push(line)
        }
      } else {
        // Invalid range format, treat as single entry
        results.push(line)
      }
    } else {
      // Single entry
      results.push(line)
    }
  }

  return results
}

/**
 * Validate that a cabinet coordinate is within room bounds
 */
export function validateCabinetBounds(
  cabinet: string,
  room: { xyRange?: { start: { x: string; y: number }; end: { x: string; y: number } } },
  format: CoordinateFormat
): { isValid: boolean; error?: string } {
  if (!room.xyRange) {
    return { isValid: false, error: 'Room bounds not defined' }
  }

  const parsed = parseCabinetCoordinate(cabinet, format)
  if (!parsed) {
    return { isValid: false, error: `Invalid cabinet format: ${cabinet}` }
  }

  // Check Y range (number part)
  const minY = Math.min(room.xyRange.start.y, room.xyRange.end.y)
  const maxY = Math.max(room.xyRange.start.y, room.xyRange.end.y)
  if (parsed.number < minY || parsed.number > maxY) {
    return { isValid: false, error: `Cabinet ${cabinet} is outside Y range (${minY}-${maxY})` }
  }

  // Check X range (prefix part) - use proper letter comparison
  const minX = room.xyRange.start.x
  const maxX = room.xyRange.end.x

  // Use proper letter comparison for multi-letter columns
  if (compareXLabels(parsed.prefix, minX) < 0 || compareXLabels(parsed.prefix, maxX) > 0) {
    return { isValid: false, error: `Cabinet ${cabinet} is outside X range (${minX}-${maxX})` }
  }

  return { isValid: true }
}
