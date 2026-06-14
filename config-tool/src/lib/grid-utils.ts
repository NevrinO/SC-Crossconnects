import { Room, CoordinateFormat } from '../types/editor'

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

export function calculateGridBounds(room: Room): GridBounds {
  // If room has xRange and yRange metadata, use those
  // Otherwise calculate from segment coordinates
  const allXCoords = new Set<string>()
  const allYCoords = new Set<number>()

  room.pathSegments.forEach(segment => {
    allXCoords.add(segment.start.x)
    allXCoords.add(segment.end.x)
    allYCoords.add(segment.start.y)
    allYCoords.add(segment.end.y)
  })

  const xLabels = Array.from(allXCoords).sort(compareXLabels)
  const yLabels = Array.from(allYCoords).sort((a, b) => a - b)

  const xIndexMap = new Map<string, number>()
  xLabels.forEach((x, i) => xIndexMap.set(x, i))

  return {
    minX: xLabels[0] || 'A',
    maxX: xLabels[xLabels.length - 1] || 'Z',
    minY: yLabels[0] || 1,
    maxY: yLabels[yLabels.length - 1] || 10,
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
