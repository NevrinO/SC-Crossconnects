import { Room, CoordinateFormat } from '../../types/room'

export interface GridBounds {
  minX: string
  maxX: string
  minY: number
  maxY: number
  xLabels: string[]
  yLabels: number[]
  xIndexMap: Map<string, number>
}

/**
 * Compare two X-axis label strings in natural column order.
 * Shorter labels come first (A < Z < AA < AZ < BA), then lexicographic within same length.
 * This matches the physical column ordering used in data center grid layouts.
 */
export function compareXLabels(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Convert a letter label (e.g. "A", "FF", "GQ") to a base-26 integer.
 * Pads to the longer label's width so distances are comparable across widths.
 */
export function letterLabelToIndex(label: string, width?: number): number {
  const len = width ?? label.length
  const padded = label.padStart(len, 'A')
  let num = 0
  for (let i = 0; i < padded.length; i++) {
    num = num * 26 + (padded.charCodeAt(i) - 65)
  }
  return num
}

/**
 * Generate all letter labels between start and end (inclusive)
 * Handles single letters (A-Z) and multi-letter combinations (AA-ZZ)
 *
 * Encoding: treats each string as a fixed-width base-26 number (A=0..Z=25).
 * "A"=0, "Z"=25, "AA"=26, "AZ"=51, "BA"=52, ...
 * Single-char range → single-char output; multi-char range → multi-char output.
 */
export function generateLetterRange(start: string, end: string, maxCount: number = 1000): string[] {
  // Validate input labels are valid letter labels
  const labelRegex = /^[A-Z]{1,3}$/
  if (!labelRegex.test(start)) {
    throw new Error(`Invalid start label "${start}". Expected uppercase letters (1-3 characters)`)
  }
  if (!labelRegex.test(end)) {
    throw new Error(`Invalid end label "${end}". Expected uppercase letters (1-3 characters)`)
  }

  const len = Math.max(start.length, end.length)

  // Convert a fixed-width label to an integer (A=0, Z=25 per digit)
  const toNumber = (str: string): number => {
    const padded = str.padStart(len, 'A')
    let num = 0
    for (let i = 0; i < padded.length; i++) {
      num = num * 26 + (padded.charCodeAt(i) - 65)
    }
    return num
  }

  // Convert an integer back to a fixed-width label
  const toLetters = (num: number): string => {
    let result = ''
    let n = num
    for (let i = 0; i < len; i++) {
      result = String.fromCharCode(65 + (n % 26)) + result
      n = Math.floor(n / 26)
    }
    return result
  }

  const startNum = toNumber(start)
  const endNum = toNumber(end)
  const total = 26 ** len

  // Validate range ordering
  if (startNum > endNum) {
    throw new Error(`Invalid range: start "${start}" must come before end "${end}"`)
  }

  // Validate range size to prevent memory exhaustion (e.g., A-ZZZ = 17,576 items)
  const rangeSize = endNum - startNum + 1
  if (rangeSize > maxCount) {
    throw new Error(`Range too large: ${rangeSize} items exceeds maximum ${maxCount}`)
  }

  const result: string[] = []
  for (let i = startNum; i <= endNum && i < total; i++) {
    result.push(toLetters(i))
  }

  return result
}

export function calculateGridBounds(room: Room): GridBounds {
  // If room has xyRange metadata, always use it (provides full grid even when segments exist)
  if (room.xyRange) {
    const startLetter = room.xyRange.start.x
    const endLetter = room.xyRange.end.x

    // Generate all letter labels between start and end
    const letterLabels = generateLetterRange(startLetter, endLetter)

    const startY = room.xyRange.start.y
    const endY = room.xyRange.end.y

    const numberLabels: number[] = []
    for (let y = Math.min(startY, endY); y <= Math.max(startY, endY); y++) {
      numberLabels.push(y)
    }

    // For now, keep default orientation (numbers on Y axis, letters on X axis)
    // Orientation support will require GridPoint interface changes
    const xLabels = letterLabels
    const yLabels = numberLabels
    const xIndexMap = new Map<string, number>()
    xLabels.forEach((x, i) => xIndexMap.set(x, i))

    return {
      minX: startLetter,
      maxX: endLetter,
      minY: Math.min(startY, endY),
      maxY: Math.max(startY, endY),
      xLabels,
      yLabels,
      xIndexMap,
    }
  }

  // Calculate from segment coordinates — expand full range between min and max endpoints
  const allXCoords = new Set<string>()
  const allYCoords = new Set<number>()

  room.pathSegments.forEach(segment => {
    allXCoords.add(segment.start.x)
    allXCoords.add(segment.end.x)
    allYCoords.add(segment.start.y)
    allYCoords.add(segment.end.y)
  })

  const endpointXLabels = Array.from(allXCoords).sort(compareXLabels)
  const endpointYLabels = Array.from(allYCoords).sort((a, b) => a - b)

  // Expand to full range between min and max so the grid shows all columns/rows
  const xLabels = endpointXLabels.length >= 2
    ? generateLetterRange(endpointXLabels[0], endpointXLabels[endpointXLabels.length - 1])
    : endpointXLabels

  const yLabels: number[] = []
  if (endpointYLabels.length >= 2) {
    for (let y = endpointYLabels[0]; y <= endpointYLabels[endpointYLabels.length - 1]; y++) {
      yLabels.push(y)
    }
  } else {
    yLabels.push(...endpointYLabels)
  }

  const xIndexMap = new Map<string, number>()
  xLabels.forEach((x, i) => xIndexMap.set(x, i))

  return {
    minX: xLabels.length > 0 ? xLabels[0] : 'A',
    maxX: xLabels.length > 0 ? xLabels[xLabels.length - 1] : 'Z',
    minY: yLabels.length > 0 ? yLabels[0] : 1,
    maxY: yLabels.length > 0 ? yLabels[yLabels.length - 1] : 10,
    xLabels,
    yLabels,
    xIndexMap,
  }
}

export function parseCoordinate(coord: string, format: CoordinateFormat): { x: string; y: number } {
  if (format === 'letters-first') {
    const match = coord.match(/^([A-Z]{1,3})(\d{1,4})$/)
    if (!match) throw new Error(`Invalid coordinate format: ${coord}`)
    const y = parseInt(match[2], 10)
    if (y < 1 || y > 9999) throw new Error(`Coordinate number out of range: ${y}`)
    
    return { x: match[1], y }
  } else {
    const match = coord.match(/^(\d{1,4})([A-Z]{1,3})$/)
    if (!match) throw new Error(`Invalid coordinate format: ${coord}`)
    const y = parseInt(match[1], 10)
    if (y < 1 || y > 9999) throw new Error(`Coordinate number out of range: ${y}`)
    
    return { x: match[2], y }
  }
}

export function formatCoordinate(x: string, y: number, format: CoordinateFormat): string {
  if (format === 'letters-first') {
    return `${x}${y}`
  } else {
    return `${y}${x}`
  }
}
