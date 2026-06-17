import { Room, PathSegment, CoordinateFormat } from '../../types/room'
import { calculateGridBounds, compareXLabels } from './grid-utils'
import { validateCabinetBounds } from './cabinet-utils'

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
  // Orientation is optional for backward compatibility with calculator rooms
  if (room.orientation && room.orientation !== 'numbers-vertical' && room.orientation !== 'numbers-horizontal') {
    errors.push('Invalid orientation (must be "numbers-vertical" or "numbers-horizontal")')
  }
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
 * Validate that a string is a valid letter label (uppercase letters only, 1-3 characters)
 * Used for xRange fields which define column ranges (e.g., "FF", "GQ", "ZZ")
 */
export function validateLetterLabel(label: string): { isValid: boolean; error?: string } {
  const match = label.match(/^[A-Z]{1,3}$/)
  if (!match) {
    return { isValid: false, error: `Invalid letter label "${label}". Expected uppercase letters only (e.g., "A", "FF", "ZZ")` }
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
 * Returns true if two segments share at least one height value that conflicts.
 * Fiber tray and ladder rack can coexist on the same path at different heights.
 * A conflict only occurs when both segments occupy the same path at the same height.
 */
function heightsConflict(s1: PathSegment, s2: PathSegment): boolean {
  const heights1 = new Set<number>()
  if (s1.fiberHeight != null) heights1.add(s1.fiberHeight)
  if (s1.copperHeight != null) heights1.add(s1.copperHeight)

  if (s2.fiberHeight != null && heights1.has(s2.fiberHeight)) return true
  if (s2.copperHeight != null && heights1.has(s2.copperHeight)) return true
  return false
}

/**
 * Check if two segments overlap in path geometry AND height.
 * Segments on the same path at different heights are allowed.
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

    if (segment1.start.y !== segment2.start.y) return 'none'

    const pathFull = minX1 === minX2 && maxX1 === maxX2
    const pathPartial = compareXLabels(maxX1, minX2) >= 0 && compareXLabels(minX1, maxX2) <= 0

    if (!pathPartial) return 'none'
    if (!heightsConflict(segment1, segment2)) return 'none'
    return pathFull ? 'full' : 'partial'
  } else {
    const [minY1, maxY1] = [segment1.start.y, segment1.end.y].sort((a, b) => a - b)
    const [minY2, maxY2] = [segment2.start.y, segment2.end.y].sort((a, b) => a - b)

    if (segment1.start.x !== segment2.start.x) return 'none'

    const pathFull = minY1 === minY2 && maxY1 === maxY2
    const pathPartial = maxY1 >= minY2 && minY1 <= maxY2

    if (!pathPartial) return 'none'
    if (!heightsConflict(segment1, segment2)) return 'none'
    return pathFull ? 'full' : 'partial'
  }
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
  } else if (segment.type === 'copper-path') {
    if (segment.copperHeight === null || segment.copperHeight <= 0) {
      errors.push({
        field: 'copperHeight',
        message: 'Copper height is required and must be positive for copper-path segments',
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
 * Validate special cabinets
 */
export function validateSpecialCabinets(room: Room): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate network racks
  for (const cabinet of room.specialCabinets.networkRacks) {
    const validation = validateCabinetBounds(cabinet, room, room.coordinateFormat)
    if (!validation.isValid) {
      errors.push({
        field: 'networkRacks',
        message: validation.error || `Invalid network rack: ${cabinet}`,
        severity: 'error'
      })
    }
  }

  // Validate half cabs
  for (const cabinet of room.specialCabinets.halfCabs) {
    const validation = validateCabinetBounds(cabinet, room, room.coordinateFormat)
    if (!validation.isValid) {
      errors.push({
        field: 'halfCabs',
        message: validation.error || `Invalid half cab: ${cabinet}`,
        severity: 'error'
      })
    }
  }

  // Validate quarter cabs
  for (const cabinet of room.specialCabinets.quarterCabs) {
    const validation = validateCabinetBounds(cabinet, room, room.coordinateFormat)
    if (!validation.isValid) {
      errors.push({
        field: 'quarterCabs',
        message: validation.error || `Invalid quarter cab: ${cabinet}`,
        severity: 'error'
      })
    }
  }

  return errors
}

/**
 * Validate room metadata (ranges, coordinate format, etc.)
 */
export function validateRoomMetadata(room: Room): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate coordinate format
  if (room.coordinateFormat !== 'letters-first' && room.coordinateFormat !== 'numbers-first') {
    errors.push({
      field: 'coordinateFormat',
      message: 'Invalid coordinate format (must be "letters-first" or "numbers-first")',
      severity: 'error'
    })
  }

  // Validate orientation if present
  if (room.orientation && room.orientation !== 'numbers-vertical' && room.orientation !== 'numbers-horizontal') {
    errors.push({
      field: 'orientation',
      message: 'Invalid orientation (must be "numbers-vertical" or "numbers-horizontal")',
      severity: 'error'
    })
  }

  // Validate tile size
  if (room.tileSize <= 0) {
    errors.push({
      field: 'tileSize',
      message: 'Tile size must be a positive number',
      severity: 'error'
    })
  }

  // Validate xyRange if present
  if (room.xyRange) {
    // Validate start coordinate
    const startCoord = validateCoordinateFormat(
      `${room.xyRange.start.x}${room.xyRange.start.y}`,
      room.coordinateFormat
    )
    if (!startCoord.isValid) {
      errors.push({
        field: 'xyRange.start',
        message: startCoord.error || 'Invalid start coordinate format',
        severity: 'error'
      })
    }

    // Validate end coordinate
    const endCoord = validateCoordinateFormat(
      `${room.xyRange.end.x}${room.xyRange.end.y}`,
      room.coordinateFormat
    )
    if (!endCoord.isValid) {
      errors.push({
        field: 'xyRange.end',
        message: endCoord.error || 'Invalid end coordinate format',
        severity: 'error'
      })
    }

    // Validate Y values are positive
    if (room.xyRange.start.y < 1) {
      errors.push({
        field: 'xyRange.start.y',
        message: 'Start Y coordinate must be at least 1',
        severity: 'error'
      })
    }
    if (room.xyRange.end.y < 1) {
      errors.push({
        field: 'xyRange.end.y',
        message: 'End Y coordinate must be at least 1',
        severity: 'error'
      })
    }
  }

  // Validate startCorner if present
  if (room.startCorner && room.startCorner !== 'top-left' && room.startCorner !== 'top-right' && room.startCorner !== 'bottom-left' && room.startCorner !== 'bottom-right') {
    errors.push({
      field: 'startCorner',
      message: 'Invalid start corner (must be top-left, top-right, bottom-left, or bottom-right)',
      severity: 'error'
    })
  }

  return errors
}

/**
 * Validate an entire room
 */
export function validateRoom(room: Room): ValidationResult {
  const errors: ValidationError[] = []

  // Validate metadata
  errors.push(...validateRoomMetadata(room))

  // Validate special cabinets
  errors.push(...validateSpecialCabinets(room))

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
