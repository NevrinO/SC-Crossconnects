import type { PathSegment, GridPoint, CoordinateFormat } from '../types/room';
import { calculateXDistance } from './char-utils';

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
  return `${point.x}-${point.y}`;
}

function segmentDistance(segment: PathSegment, tileSize: number, coordinateFormat: CoordinateFormat): number {
  if (segment.start.x === segment.end.x) {
    // Horizontal segment (same X, different Y)
    return Math.abs(segment.end.y - segment.start.y) * tileSize;
  }
  if (segment.start.y === segment.end.y) {
    // Vertical segment (same Y, different X)
    return calculateXDistance(segment.start.x, segment.end.x, tileSize, coordinateFormat);
  }
  // Diagonal (shouldn't happen with grid-aligned paths)
  const xDist = calculateXDistance(segment.start.x, segment.end.x, tileSize, coordinateFormat);
  const yDist = Math.abs(segment.end.y - segment.start.y) * tileSize;
  return xDist + yDist;
}

/**
 * PathGraph represents a graph of tray segments for pathfinding.
 * 
 * WARNING: This class uses mutable state for edge removal (removedEdgeIds Set).
 * Instances must NOT be reused after calling kShortestPaths or any function that
 * mutates the graph state. Always create a new PathGraph instance for each
 * pathfinding operation to avoid state corruption.
 */
export class PathGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private segments: Map<string, PathSegment> = new Map();
  private tileSize: number;
  private coordinateFormat: CoordinateFormat;
  private removedEdgeIds: Set<string> = new Set();

  constructor(pathSegments: PathSegment[], cableType: 'fiber' | 'copper', tileSize: number, coordinateFormat: CoordinateFormat) {
    this.tileSize = tileSize;
    this.coordinateFormat = coordinateFormat;
    const filtered = pathSegments.filter((seg) => {
      if (cableType === 'fiber') return seg.fiberHeight !== null;
      return seg.copperHeight !== null;
    });
    // Guard against empty filtered segments
    if (filtered.length === 0) {
      return;
    }
    this.buildGraph(filtered);
  }

  private buildGraph(segments: PathSegment[]): void {
    for (const seg of segments) {
      this.segments.set(seg.id, seg);

      // Create nodes at segment endpoints only
      const startNodeId = nodeId(seg.start);
      const endNodeId = nodeId(seg.end);

      if (!this.nodes.has(startNodeId)) {
        this.nodes.set(startNodeId, { id: startNodeId, point: seg.start });
      }
      if (!this.nodes.has(endNodeId)) {
        this.nodes.set(endNodeId, { id: endNodeId, point: seg.end });
      }

      // Create a single edge for the entire segment
      const weight = segmentDistance(seg, this.tileSize, this.coordinateFormat);
      this.edges.push({
        id: `${seg.id}-forward`,
        segmentId: seg.id,
        from: startNodeId,
        to: endNodeId,
        weight,
      });
      this.edges.push({
        id: `${seg.id}-backward`,
        segmentId: seg.id,
        from: endNodeId,
        to: startNodeId,
        weight,
      });
    }

    // Create intersection nodes where horizontal and vertical segments cross
    // This allows pathfinding to switch between segments at intersections
    const horizontalSegments = segments.filter(s => s.start.y === s.end.y);
    const verticalSegments = segments.filter(s => s.start.x === s.end.x);

    for (const hSeg of horizontalSegments) {
      for (const vSeg of verticalSegments) {
        // Check if vertical segment's X is within horizontal segment's X range
        const hStartXNum = calculateXDistance('AA', hSeg.start.x, 1, this.coordinateFormat);
        const hEndXNum = calculateXDistance('AA', hSeg.end.x, 1, this.coordinateFormat);
        const hMinX = Math.min(hStartXNum, hEndXNum);
        const hMaxX = Math.max(hStartXNum, hEndXNum);
        const vXNum = calculateXDistance('AA', vSeg.start.x, 1, this.coordinateFormat);

        // Check if horizontal segment's Y is within vertical segment's Y range
        const vMinY = Math.min(vSeg.start.y, vSeg.end.y);
        const vMaxY = Math.max(vSeg.start.y, vSeg.end.y);
        const hY = hSeg.start.y;

        // If they intersect, create a node at the intersection
        if (vXNum >= hMinX && vXNum <= hMaxX && hY >= vMinY && hY <= vMaxY) {
          const intersectionPoint: GridPoint = { x: vSeg.start.x, y: hY };
          const intersectionNodeId = nodeId(intersectionPoint);

          // Create intersection node if it doesn't exist
          if (!this.nodes.has(intersectionNodeId)) {
            this.nodes.set(intersectionNodeId, { id: intersectionNodeId, point: intersectionPoint });
          }

          // Connect horizontal segment to intersection
          const hStartNodeId = nodeId(hSeg.start);
          const hEndNodeId = nodeId(hSeg.end);
          const hWeightToIntersection = segmentDistance(
            { ...hSeg, end: intersectionPoint },
            this.tileSize,
            this.coordinateFormat
          );
          const hWeightFromIntersection = segmentDistance(
            { ...hSeg, start: intersectionPoint },
            this.tileSize,
            this.coordinateFormat
          );

          this.edges.push({
            id: `${hSeg.id}-to-intersection`,
            segmentId: hSeg.id,
            from: hStartNodeId,
            to: intersectionNodeId,
            weight: hWeightToIntersection,
          });
          this.edges.push({
            id: `${hSeg.id}-from-intersection`,
            segmentId: hSeg.id,
            from: intersectionNodeId,
            to: hStartNodeId,
            weight: hWeightToIntersection,
          });
          this.edges.push({
            id: `${hSeg.id}-to-intersection-end`,
            segmentId: hSeg.id,
            from: intersectionNodeId,
            to: hEndNodeId,
            weight: hWeightFromIntersection,
          });
          this.edges.push({
            id: `${hSeg.id}-from-intersection-end`,
            segmentId: hSeg.id,
            from: hEndNodeId,
            to: intersectionNodeId,
            weight: hWeightFromIntersection,
          });

          // Connect vertical segment to intersection
          const vStartNodeId = nodeId(vSeg.start);
          const vEndNodeId = nodeId(vSeg.end);
          const vWeightToIntersection = segmentDistance(
            { ...vSeg, end: intersectionPoint },
            this.tileSize,
            this.coordinateFormat
          );
          const vWeightFromIntersection = segmentDistance(
            { ...vSeg, start: intersectionPoint },
            this.tileSize,
            this.coordinateFormat
          );

          this.edges.push({
            id: `${vSeg.id}-to-intersection`,
            segmentId: vSeg.id,
            from: vStartNodeId,
            to: intersectionNodeId,
            weight: vWeightToIntersection,
          });
          this.edges.push({
            id: `${vSeg.id}-from-intersection`,
            segmentId: vSeg.id,
            from: intersectionNodeId,
            to: vStartNodeId,
            weight: vWeightToIntersection,
          });
          this.edges.push({
            id: `${vSeg.id}-to-intersection-end`,
            segmentId: vSeg.id,
            from: intersectionNodeId,
            to: vEndNodeId,
            weight: vWeightFromIntersection,
          });
          this.edges.push({
            id: `${vSeg.id}-from-intersection-end`,
            segmentId: vSeg.id,
            from: vEndNodeId,
            to: intersectionNodeId,
            weight: vWeightFromIntersection,
          });
        }
      }
    }
  }

  getSegment(id: string): PathSegment | undefined {
    return this.segments.get(id);
  }

  /**
   * Inject a mid-segment point as a graph node, splitting the segment's edges at that point.
   * This is used to connect cabinet entry points that lie mid-segment into the graph.
   * The original start→end edges for the segment are removed and replaced with
   * start→point and point→end split edges (and their reverses).
   */
  injectMidpoint(point: GridPoint, segmentId: string): void {
    const seg = this.segments.get(segmentId);
    if (!seg) return;

    const midId = nodeId(point);
    if (this.nodes.has(midId)) return; // Already a known node (e.g. segment endpoint or intersection)

    this.nodes.set(midId, { id: midId, point });

    const startId = nodeId(seg.start);
    const endId = nodeId(seg.end);

    // Compute weights from segment start/end to this midpoint
    const weightStartToMid = segmentDistance({ ...seg, end: point }, this.tileSize, this.coordinateFormat);
    const weightMidToEnd = segmentDistance({ ...seg, start: point }, this.tileSize, this.coordinateFormat);

    // Add bidirectional split edges connecting the midpoint into the graph.
    // Existing edges are NOT removed so intersection connectivity is preserved.
    this.edges.push({ id: `${segmentId}-to-${midId}`, segmentId, from: startId, to: midId, weight: weightStartToMid });
    this.edges.push({ id: `${segmentId}-from-${midId}-rev`, segmentId, from: midId, to: startId, weight: weightStartToMid });
    this.edges.push({ id: `${segmentId}-from-${midId}`, segmentId, from: midId, to: endId, weight: weightMidToEnd });
    this.edges.push({ id: `${segmentId}-to-${midId}-rev`, segmentId, from: endId, to: midId, weight: weightMidToEnd });

    // Also connect this midpoint to any existing intersection nodes on the same segment.
    // Intersection nodes already exist as nodes in the graph at positions between start and end.
    for (const node of this.nodes.values()) {
      if (node.id === midId || node.id === startId || node.id === endId) continue;
      // Check if this node lies on the segment (same x for vertical, same y for horizontal)
      const isOnSameVertical = seg.start.x === seg.end.x && node.point.x === seg.start.x &&
        node.point.y >= Math.min(seg.start.y, seg.end.y) &&
        node.point.y <= Math.max(seg.start.y, seg.end.y);
      // For horizontal segments, also verify X coordinate is within segment range
      const isOnSameHorizontal = seg.start.y === seg.end.y && node.point.y === seg.start.y;
      if (isOnSameHorizontal) {
        const startXNum = calculateXDistance('AA', seg.start.x, 1, this.coordinateFormat);
        const endXNum = calculateXDistance('AA', seg.end.x, 1, this.coordinateFormat);
        const nodeXNum = calculateXDistance('AA', node.point.x, 1, this.coordinateFormat);
        const minX = Math.min(startXNum, endXNum);
        const maxX = Math.max(startXNum, endXNum);
        if (nodeXNum < minX || nodeXNum > maxX) {
          // Node is outside the segment's X range, skip it
          continue;
        }
      }
      if (!isOnSameVertical && !isOnSameHorizontal) continue;

      // Verify this node is actually connected to this segment (has an edge with this segmentId)
      const connected = this.edges.some(
        e => e.segmentId === segmentId && (e.from === node.id || e.to === node.id)
      );
      if (!connected) continue;

      const weightMidToNode = segmentDistance({ ...seg, start: point, end: node.point }, this.tileSize, this.coordinateFormat);
      this.edges.push({ id: `${segmentId}-${midId}-to-${node.id}`, segmentId, from: midId, to: node.id, weight: weightMidToNode });
      this.edges.push({ id: `${segmentId}-${node.id}-to-${midId}`, segmentId, from: node.id, to: midId, weight: weightMidToNode });
    }
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
      total += segmentDistance(seg, this.tileSize, this.coordinateFormat);
    }
    return total;
  }

  /**
   * Remove an edge from the graph (for Yen's algorithm).
   * @param segmentId The segment ID to remove (removes all edges for this segment)
   */
  removeEdge(segmentId: string): void {
    // Remove all edges that belong to this segment
    for (const edge of this.edges) {
      if (edge.segmentId === segmentId) {
        this.removedEdgeIds.add(edge.id);
      }
    }
  }

  /**
   * Remove a specific directed edge from 'from' to 'to' via 'segmentId' (for Yen's algorithm).
   * Only removes the specific directed edge, not the reverse.
   */
  removeDirectedEdge(from: string, to: string, segmentId: string): void {
    for (const edge of this.edges) {
      if (edge.from === from && edge.to === to && edge.segmentId === segmentId) {
        this.removedEdgeIds.add(edge.id);
      }
    }
  }

  /**
   * Restore all removed edges to the graph (for Yen's algorithm).
   */
  restoreAllEdges(): void {
    this.removedEdgeIds.clear();
  }

  /**
   * Get edges that are not removed.
   */
  getActiveEdges(): GraphEdge[] {
    return this.edges.filter(edge => !this.removedEdgeIds.has(edge.id));
  }
}
