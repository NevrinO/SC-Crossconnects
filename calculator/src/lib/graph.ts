import type { PathSegment, GridPoint } from '../types/room';
import { azRun } from './char-utils';

export interface GraphNode {
  id: string;
  point: GridPoint;
}

export interface GraphEdge {
  id: string;
  segmentId: string;
  from: string;
  to: string;
  weight: number;
}

function nodeId(point: GridPoint): string {
  return `${point.row}-${point.cabinet}`;
}

function segmentDistance(segment: PathSegment, tileSize: number): number {
  if (segment.start.row === segment.end.row) {
    // East-west segment (same row, different cabinet)
    return Math.abs(segment.end.cabinet - segment.start.cabinet) * tileSize;
  }
  if (segment.start.cabinet === segment.end.cabinet) {
    // North-south segment (same cabinet, different row)
    return azRun(segment.start.row, segment.end.row, tileSize);
  }
  // Diagonal (shouldn't happen with grid-aligned paths)
  const rowDist = azRun(segment.start.row, segment.end.row, tileSize);
  const cabDist = Math.abs(segment.end.cabinet - segment.start.cabinet) * tileSize;
  return rowDist + cabDist;
}

export class PathGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private segments: Map<string, PathSegment> = new Map();
  private tileSize: number;

  constructor(pathSegments: PathSegment[], cableType: 'fiber' | 'copper', tileSize: number) {
    this.tileSize = tileSize;
    const filtered = pathSegments.filter((seg) => {
      if (cableType === 'fiber') return seg.fiberHeight !== null;
      return seg.copperHeight !== null;
    });
    this.buildGraph(filtered);
  }

  private buildGraph(segments: PathSegment[]): void {
    for (const seg of segments) {
      this.segments.set(seg.id, seg);
      const startId = nodeId(seg.start);
      const endId = nodeId(seg.end);

      if (!this.nodes.has(startId)) {
        this.nodes.set(startId, { id: startId, point: seg.start });
      }
      if (!this.nodes.has(endId)) {
        this.nodes.set(endId, { id: endId, point: seg.end });
      }

      const weight = segmentDistance(seg, this.tileSize);
      this.edges.push({
        id: `${seg.id}-forward`,
        segmentId: seg.id,
        from: startId,
        to: endId,
        weight,
      });
      this.edges.push({
        id: `${seg.id}-backward`,
        segmentId: seg.id,
        from: endId,
        to: startId,
        weight,
      });
    }
  }

  getSegment(id: string): PathSegment | undefined {
    return this.segments.get(id);
  }

  validateSegmentsExist(segmentIds: string[]): boolean {
    return segmentIds.every((id) => this.segments.has(id));
  }

  validatePathConnectivity(segmentIds: string[]): boolean {
    if (segmentIds.length === 0) return false;
    if (!this.validateSegmentsExist(segmentIds)) return false;
    for (let i = 1; i < segmentIds.length; i++) {
      const prev = this.segments.get(segmentIds[i - 1]);
      const curr = this.segments.get(segmentIds[i]);
      if (!prev || !curr) return false;
      const prevEndId = nodeId(prev.end);
      const currStartId = nodeId(curr.start);
      if (prevEndId !== currStartId) return false;
    }
    return true;
  }

  calculatePathDistance(segmentIds: string[]): number {
    if (!this.validatePathConnectivity(segmentIds)) return 0;
    let total = 0;
    for (const id of segmentIds) {
      const seg = this.segments.get(id);
      if (!seg) return 0;
      total += segmentDistance(seg, this.tileSize);
    }
    return total;
  }
}
