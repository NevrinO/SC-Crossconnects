import { Room, PathSegment, CoordinateFormat } from '../types/editor'
import { calculateGridBounds, compareXLabels } from './grid-utils'

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Validate the structure of a room object parsed from JSON import.
 * Returns isValid and a list of human-readable error strings.
 */
export function validateRoomStructure(room: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!room || typeof room !== 'object') {
    return { isValid: false, errors: ['Room is not an object'] }
  }

  if (typeof room.id !== 'string') errors.push('Missing or invalid id')
  if (typeof room.name !== 'string') errors.push('Missing or invalid name')
  if (typeof room.tileSize !== 'number' || room.tileSize <= 0) errors.push('Invalid tileSize (must be positive number)')
  if (typeof room.offset !== 'number') errors.push('Missing or invalid offset')
  if (typeof room.spilloverAdditionalLength !== 'number') errors.push('Missing or invalid spilloverAdditionalLength')
  if (room.coordinateFormat !== 'letters-first' && room.coordinateFormat !== 'numbers-first') errors.push('Invalid coordinateFormat (must be "letters-first" or "numbers-first")')
  if (!Array.isArray(room.pathSegments)) {
    errors.push('pathSegments must be an array')
  } else {
    // Validate individual segment structure
    room.pathSegments.forEach((seg: any, idx: number) => {
      if (!seg || typeof seg !== 'object') {
        errors.push(`pathSegments[${idx}] is not an object`)
      } else {
        if (typeof seg.id !== 'string') errors.push(`pathSegments[${idx}].id is missing or invalid`)
        if (typeof seg.name !== 'string') errors.push(`pathSegments[${idx}].name is missing or invalid`)
        if (!seg.start || typeof seg.start.x !== 'string' || typeof seg.start.y !== 'number') {
          errors.push(`pathSegments[${idx}].start is missing or invalid (expected {x: string, y: number})`)
        }
        if (!seg.end || typeof seg.end.x !== 'string' || typeof seg.end.y !== 'number') {
          errors.push(`pathSegments[${idx}].end is missing or invalid (expected {x: string, y: number})`)
        }
      }
    })
  }
  if (!room.specialCabinets || typeof room.specialCabinets !== 'object') errors.push('Missing or invalid specialCabinets')
  if (!Array.isArray(room.specialCabinets?.networkRacks)) errors.push('specialCabinets.networkRacks must be an array')
  if (!Array.isArray(room.specialCabinets?.halfCabs)) errors.push('specialCabinets.halfCabs must be an array')
  if (!Array.isArray(room.specialCabinets?.quarterCabs)) errors.push('specialCabinets.quarterCabs must be an array')

  return { isValid: errors.length === 0, errors }
}

/**
 * Validate that a coordinate string matches the expected format
 */
export function validateCoordinateFormat(
  coord: string,
  format: CoordinateFormat
): { isValid: boolean; error?: string } {
  if (format === 'letters-first') {
    const match = coord.match(/^([A-Z]{1,3})(\d{1,4})$/)
    if (!match) {
      return { isValid: false, error: `Invalid coordinate format for "${coord}". Expected letters-first format (e.g., "FK132")` }
    }
    const y = parseInt(match[2], 10)
    if (y < 1 || y > 9999) {
      return { isValid: false, error: `Coordinate number out of range for "${coord}"` }
    }
  } else {
    const match = coord.match(/^(\d{1,4})([A-Z]{1,3})$/)
    if (!match) {
      return { isValid: false, error: `Invalid coordinate format for "${coord}". Expected numbers-first format (e.g., "132FK")` }
    }
    const y = parseInt(match[1], 10)
    if (y < 1 || y > 9999) {
      return { isValid: false, error: `Coordinate number out of range for "${coord}"` }
    }
  }
  return { isValid: true }
}

/**
 * Validate that a segment's start and end coordinates are within room bounds
 */
export function validateSegmentBounds(
  segment: PathSegment,
  room: Room
): ValidationError[] {
  const errors: ValidationError[] = []
  const bounds = calculateGridBounds(room)

  // Check start coordinate
  if (!bounds.xLabels.includes(segment.start.x)) {
    errors.push({
      field: 'start.x',
      message: `Start X coordinate "${segment.start.x}" is outside room bounds (${bounds.minX}-${bounds.maxX})`,
      severity: 'error'
    })
  }
  if (!bounds.yLabels.includes(segment.start.y)) {
    errors.push({
      field: 'start.y',
      message: `Start Y coordinate "${segment.start.y}" is outside room bounds (${bounds.minY}-${bounds.maxY})`,
      severity: 'error'
    })
  }

  // Check end coordinate
  if (!bounds.xLabels.includes(segment.end.x)) {
    errors.push({
      field: 'end.x',
      message: `End X coordinate "${segment.end.x}" is outside room bounds (${bounds.minX}-${bounds.maxX})`,
      severity: 'error'
    })
  }
  if (!bounds.yLabels.includes(segment.end.y)) {
    errors.push({
      field: 'end.y',
      message: `End Y coordinate "${segment.end.y}" is outside room bounds (${bounds.minY}-${bounds.maxY})`,
      severity: 'error'
    })
  }

  return errors
}

/**
 * Check if two segments overlap
 */
export function checkSegmentOverlap(
  segment1: PathSegment,
  segment2: PathSegment
): 'none' | 'partial' | 'full' {
  const isHorizontal1 = segment1.start.y === segment1.end.y
  const isHorizontal2 = segment2.start.y === segment2.end.y

  // Segments must be on the same axis to overlap
  if (isHorizontal1 !== isHorizontal2) {
    return 'none'
  }

  if (isHorizontal1) {
    const [minX1, maxX1] = [segment1.start.x, segment1.end.x].sort(compareXLabels)
    const [minX2, maxX2] = [segment2.start.x, segment2.end.x].sort(compareXLabels)

    // Full overlap: same start, end, and Y
    if (minX1 === minX2 && maxX1 === maxX2 && segment1.start.y === segment2.start.y) {
      return 'full'
    }

    // Partial overlap: ranges intersect
    if (compareXLabels(maxX1, minX2) >= 0 && compareXLabels(minX1, maxX2) <= 0 && segment1.start.y === segment2.start.y) {
      return 'partial'
    }
  } else {
    const [minY1, maxY1] = [segment1.start.y, segment1.end.y].sort()
    const [minY2, maxY2] = [segment2.start.y, segment2.end.y].sort()

    // Full overlap: same start, end, and X
    if (minY1 === minY2 && maxY1 === maxY2 && segment1.start.x === segment2.start.x) {
      return 'full'
    }

    // Partial overlap: ranges intersect
    if (maxY1 >= minY2 && minY1 <= maxY2 && segment1.start.x === segment2.start.x) {
      return 'partial'
    }
  }

  return 'none'
}

/**
 * Validate segment overlap against all other segments in the room
 */
export function validateSegmentOverlap(
  segment: PathSegment,
  room: Room,
  excludeSegmentId?: string
): ValidationError[] {
  const errors: ValidationError[] = []

  for (const otherSegment of room.pathSegments) {
    if (excludeSegmentId && otherSegment.id === excludeSegmentId) {
      continue
    }

    const overlap = checkSegmentOverlap(segment, otherSegment)

    if (overlap === 'full') {
      errors.push({
        field: 'overlap',
        message: `Segment fully overlaps with segment "${otherSegment.name || otherSegment.id}"`,
        severity: 'error'
      })
    } else if (overlap === 'partial') {
      errors.push({
        field: 'overlap',
        message: `Segment partially overlaps with segment "${otherSegment.name || otherSegment.id}"`,
        severity: 'warning'
      })
    }
  }

  return errors
}

/**
 * Validate segment heights based on type
 */
export function validateSegmentHeights(segment: PathSegment): ValidationError[] {
  const errors: ValidationError[] = []

  if (segment.type === 'fiber-path') {
    if (segment.fiberHeight === null || segment.fiberHeight <= 0) {
      errors.push({
        field: 'fiberHeight',
        message: 'Fiber height is required and must be positive for fiber-path segments',
        severity: 'error'
      })
    }
  } else if (segment.type === 'ladder-rack') {
    if (segment.copperHeight === null || segment.copperHeight <= 0) {
      errors.push({
        field: 'copperHeight',
        message: 'Copper height is required and must be positive for ladder-rack segments',
        severity: 'error'
      })
    }
  } else if (segment.type === 'mixed-path') {
    if (segment.fiberHeight === null || segment.fiberHeight <= 0) {
      errors.push({
        field: 'fiberHeight',
        message: 'Fiber height is required and must be positive for mixed-path segments',
        severity: 'error'
      })
    }
    if (segment.copperHeight === null || segment.copperHeight <= 0) {
      errors.push({
        field: 'copperHeight',
        message: 'Copper height is required and must be positive for mixed-path segments',
        severity: 'error'
      })
    }
  }

  return errors
}

/**
 * Validate a complete segment
 */
export function validateSegment(
  segment: PathSegment,
  room: Room,
  excludeSegmentId?: string
): ValidationResult {
  const errors: ValidationError[] = []

  // Validate coordinate format
  const startFormat = validateCoordinateFormat(`${segment.start.x}${segment.start.y}`, room.coordinateFormat)
  if (!startFormat.isValid) {
    errors.push({
      field: 'start',
      message: startFormat.error || 'Invalid start coordinate format',
      severity: 'error'
    })
  }

  const endFormat = validateCoordinateFormat(`${segment.end.x}${segment.end.y}`, room.coordinateFormat)
  if (!endFormat.isValid) {
    errors.push({
      field: 'end',
      message: endFormat.error || 'Invalid end coordinate format',
      severity: 'error'
    })
  }

  // Validate bounds
  errors.push(...validateSegmentBounds(segment, room))

  // Validate overlap
  errors.push(...validateSegmentOverlap(segment, room, excludeSegmentId))

  // Validate heights
  errors.push(...validateSegmentHeights(segment))

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors
  }
}

/**
 * Validate an entire room
 */
export function validateRoom(room: Room): ValidationResult {
  const errors: ValidationError[] = []

  // Validate each segment
  for (const segment of room.pathSegments) {
    const segmentResult = validateSegment(segment, room, segment.id)
    errors.push(...segmentResult.errors)
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors
  }
}
