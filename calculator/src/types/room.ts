export type CoordinateFormat = 'letters-first' | 'numbers-first';

export interface GridPoint {
  x: string;  // Row letter (e.g., "FZ", "GG")
  y: number; // Cabinet number (e.g., 171, 185)
}

export interface PathSegment {
  id: string;
  name: string;
  start: GridPoint;
  end: GridPoint;
  fiberHeight: number | null;
  copperHeight: number | null;
  type: 'fiber-path' | 'ladder-rack' | 'mixed-path';
}

export interface SpecialCabinets {
  networkRacks: string[];
  halfCabs: string[];
  quarterCabs: string[];
}

export interface Room {
  id: string;
  name: string;
  tileSize: number;
  offset: number;
  spilloverAdditionalLength: number;
  pathSegments: PathSegment[];
  specialCabinets: SpecialCabinets;
  coordinateFormat: CoordinateFormat;
}

export interface CalculationResult {
  startCab: string;
  endCab: string;
  lengthFt: number;
  lengthM: number;
  room: string;
  path: string;
  sameX: boolean;
}

export interface CabinetInfo {
  type: 'full_cab' | 'network_rack' | 'half_cab' | 'quarter_cab';
  value: string;
}
