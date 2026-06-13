export type RowFormat = 'letters-first' | 'numbers-first';

export interface GridPoint {
  row: string;
  cabinet: number;
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
  rowFormat: RowFormat;
}

export interface CalculationResult {
  startCab: string;
  endCab: string;
  lengthFt: number;
  lengthM: number;
  room: string;
  path: string;
  sameRow: boolean;
}

export interface CabinetInfo {
  type: 'full_cab' | 'network_rack' | 'half_cab' | 'quarter_cab';
  value: string;
}
