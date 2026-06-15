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
  type: 'fiber-path' | 'copper-path' | 'mixed-path';
}

export interface SpecialCabinets {
  networkRacks: string[];
  halfCabs: string[];
  quarterCabs: string[];
}

export interface Cabinet {
  id: string;       // base label: x+y, e.g. "FR132" (no suffix, no panel)
  x: string;        // row, e.g. "FR"
  y: number;        // cabinet number, e.g. 132
  type: 'full_cab' | 'network_rack' | 'half_cab' | 'quarter_cab';
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
  xyRange?: { start: GridPoint; end: GridPoint };
  orientation?: 'numbers-vertical' | 'numbers-horizontal';
  startCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  cabinets?: Cabinet[];
}

export interface CalculationResult {
  startCab: string;
  endCab: string;
  lengthFt: number;
  lengthM: number;
  room: string;
  path: string;
  sameX: boolean;
  cableType: 'fiber' | 'copper';
}

export interface CabinetInfo {
  type: 'full_cab' | 'network_rack' | 'half_cab' | 'quarter_cab';
  value: string;
}
