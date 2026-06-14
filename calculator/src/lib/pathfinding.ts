import type { PathSegment, GridPoint, Room } from '../types/room';
import { PathGraph } from './graph';
import { CONSTANTS } from './constants';
import { calculateXDistance } from './char-utils';

export interface PathResult {
  segments: PathSegment[];
  nodes: string[];
  entrySpillover: number;
  exitSpillover: number;
  transferSpillovers: number;
  totalTrayDistance: number;
  totalDistance: number;
  pathName: string;
  isShortest: boolean;
  percentOverShortest: number;
}

export interface CabinetConnection {
  entryPoint: GridPoint;
  spilloverCost: number;
  segmentId: string | null;
}

export interface DijkstraPath {
  nodes: string[];
  segments: string[];
}

/**
 * Dijkstra's algorithm to find shortest path between two nodes in the graph.
 * Returns the path as both a node sequence and a segment ID sequence.
 */
export function dijkstra(
  graph: PathGraph,
  startNodeId: string,
  endNodeId: string
): DijkstraPath | null {
  const edges = graph.getActiveEdges();

  // Priority queue: [distance, nodeId]
  const queue: [number, string][] = [[0, startNodeId]];
  const distances: Map<string, number> = new Map();
  const previous: Map<string, { node: string; segment: string | null }> = new Map();
  const visited: Set<string> = new Set();

  distances.set(startNodeId, 0);

  while (queue.length > 0) {
    // Sort queue by distance (min-heap simulation)
    queue.sort((a, b) => a[0] - b[0]);
    const [currentDist, currentNode] = queue.shift()!;

    if (currentNode === endNodeId) {
      // Reconstruct node sequence and segment sequence
      const nodes: string[] = [currentNode];
      const segments: string[] = [];
      let cur: { node: string; segment: string | null } | undefined = previous.get(currentNode);
      while (cur) {
        if (cur.segment) segments.unshift(cur.segment);
        nodes.unshift(cur.node);
        cur = previous.get(cur.node);
      }
      return { nodes, segments };
    }

    if (visited.has(currentNode)) continue;
    visited.add(currentNode);

    // Find all edges from current node
    for (const edge of edges) {
      if (edge.from !== currentNode) continue;
      if (visited.has(edge.to)) continue;

      const newDist = currentDist + edge.weight;
      const existingDist = distances.get(edge.to);

      if (existingDist === undefined || newDist < existingDist) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, { node: currentNode, segment: edge.segmentId });
        queue.push([newDist, edge.to]);
      }
    }
  }

  return null; // No path found
}

export interface KShortestPath {
  segments: string[];
  nodes: string[];
  cost: number;
}

/**
 * Yen's algorithm to find k-shortest paths between two nodes.
 * Returns paths sorted by total distance, each with its actual edge-weight cost.
 */
export function kShortestPaths(
  graph: PathGraph,
  startNodeId: string,
  endNodeId: string,
  k: number
): KShortestPath[] {
  // Each entry stores the full DijkstraPath (nodes + segments) for spur tracking
  const shortestPaths: DijkstraPath[] = [];
  const shortestCosts: number[] = [];
  const candidates: { path: DijkstraPath; cost: number }[] = [];

  // Find the shortest path using Dijkstra
  const first = dijkstra(graph, startNodeId, endNodeId);
  if (!first) return [];

  shortestPaths.push(first);
  const firstCost = edgeWeightCost(graph, first.nodes);
  if (firstCost === null) return []; // Invalid path - disconnected nodes
  shortestCosts.push(firstCost);

  for (let i = 1; i < k; i++) {
    const prevPath = shortestPaths[i - 1];

    // Iterate over each node in the previous path as a potential spur node
    // nodes.length === segments.length + 1, spur node index j means node prevPath.nodes[j]
    for (let j = 0; j < prevPath.nodes.length - 1; j++) {
      const spurNodeId = prevPath.nodes[j];
      const rootNodes = prevPath.nodes.slice(0, j + 1);
      const rootSegments = prevPath.segments.slice(0, j);

      // Remove the edge leaving the spur node for all previous paths that share this root
      for (const p of shortestPaths) {
        const rootMatches = p.nodes.slice(0, j + 1).join(',') === rootNodes.join(',');
        if (rootMatches && j < p.segments.length) {
          // Remove the specific directed edge from spurNode to next node in this path
          const nextNode = p.nodes[j + 1];
          const segId = p.segments[j];
          graph.removeDirectedEdge(spurNodeId, nextNode, segId);
        }
      }

      // Calculate spur path from spurNode to end
      const spurResult = dijkstra(graph, spurNodeId, endNodeId);

      // Restore all removed edges
      graph.restoreAllEdges();

      if (spurResult) {
        const fullNodes = [...rootNodes.slice(0, -1), ...spurResult.nodes];
        const fullSegments = [...rootSegments, ...spurResult.segments];

        // Skip paths that visit the same segment more than once (loop detection)
        const uniqueSegs = new Set(fullSegments);
        if (uniqueSegs.size < fullSegments.length) continue;

        const fullPath: DijkstraPath = { nodes: fullNodes, segments: fullSegments };
        const cost = calculatePathCost(graph, fullNodes);
        if (cost === null) continue; // Disconnected nodes - skip this candidate

        const sig = fullSegments.join(',');
        const isDuplicate =
          candidates.some(c => c.path.segments.join(',') === sig) ||
          shortestPaths.some(p => p.segments.join(',') === sig);

        if (!isDuplicate) {
          candidates.push({ path: fullPath, cost });
        }
      }
    }

    if (candidates.length === 0) break;

    // Sort candidates by cost and select the shortest
    candidates.sort((a, b) => a.cost - b.cost);
    const selected = candidates.shift()!;
    shortestPaths.push(selected.path);
    shortestCosts.push(selected.cost);
  }

  return shortestPaths.map((p, i) => ({ segments: p.segments, nodes: p.nodes, cost: shortestCosts[i] }));
}

/**
 * Calculate the total cost of a path by summing active edge weights along the node sequence.
 * This is accurate for paths through injected midpoints and intersection nodes.
 * Returns null if nodes are disconnected (no edge exists between consecutive nodes).
 */
function edgeWeightCost(graph: PathGraph, nodes: string[]): number | null {
  const edges = graph.getActiveEdges();
  let total = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i];
    const to = nodes[i + 1];
    // Find the minimum-weight edge between these nodes (there may be multiple)
    let minWeight = Infinity;
    for (const edge of edges) {
      if (edge.from === from && edge.to === to && edge.weight < minWeight) {
        minWeight = edge.weight;
      }
    }
    if (minWeight === Infinity) return null; // Disconnected - invalid path
    total += minWeight;
  }
  return total;
}

/**
 * Calculate the total cost of a path given segment IDs.
 * Returns null if nodes are disconnected.
 */
function calculatePathCost(graph: PathGraph, nodes: string[]): number | null {
  return edgeWeightCost(graph, nodes);
}

/**
 * Filter paths that exceed a maximum ratio of the shortest path.
 */
export function prunePaths(
  paths: PathResult[],
  maxRatio: number
): PathResult[] {
  if (paths.length === 0) return [];

  const shortestDistance = paths[0].totalDistance;
  return paths.filter(path => path.totalDistance <= shortestDistance * maxRatio);
}

/**
 * Calculate spillover cost for height differences.
 */
export function calculateSpillover(
  fromHeight: number,
  toHeight: number,
  additionalLength: number
): number {
  return Math.abs(fromHeight - toHeight) + additionalLength;
}

/**
 * Calculate cabinet height from U count.
 * (U count × 1.75") + baseHeight, converted to feet
 */
export function calculateCabinetHeight(uCount: number): number {
  return (uCount * CONSTANTS.U_HEIGHT_INCHES + CONSTANTS.CABINET_BASE_HEIGHT) / 12;
}

/**
 * Compute the spillover cost for a path given the max tray height across all segments.
 * Matches old calculator: entry/exit cost = maxTrayHeight + additionalLength.
 */
function pathSpilloverCost(segments: PathSegment[], cableType: 'fiber' | 'copper', additionalLength: number): number {
  let maxHeight = 0;
  for (const seg of segments) {
    const h = cableType === 'fiber' ? (seg.fiberHeight ?? 0) : (seg.copperHeight ?? 0);
    if (h > maxHeight) maxHeight = h;
  }
  return maxHeight + additionalLength;
}

/**
 * Find nearest tray connection point for a cabinet.
 * Returns the entry point on the tray system and the spillover cost.
 */
export function findCabinetEntryPoint(
  cabinet: GridPoint,
  cableType: 'fiber' | 'copper',
  room: Room
): CabinetConnection {
  // Guard against missing room data
  if (!room || !room.pathSegments || room.pathSegments.length === 0) {
    return {
      entryPoint: cabinet,
      spilloverCost: room?.spilloverAdditionalLength || 4,
      segmentId: null,
    };
  }

  const additionalLength = room.spilloverAdditionalLength;

  // Find a segment that runs along the cabinet's X or Y coordinate
  for (const segment of room.pathSegments) {
    const height = cableType === 'fiber' ? segment.fiberHeight : segment.copperHeight;
    if (height === null) continue;

    // Check if segment runs along the cabinet's X coordinate (vertical segment)
    if (segment.start.x === segment.end.x && segment.start.x === cabinet.x) {
      // Check if cabinet's Y is within segment range
      const startY = Math.min(segment.start.y, segment.end.y);
      const endY = Math.max(segment.start.y, segment.end.y);

      if (cabinet.y >= startY && cabinet.y <= endY) {
        // Cabinet can connect to this segment at its exact Y position
        const trayHeight = cableType === 'fiber'
          ? (segment.fiberHeight ?? 0)
          : (segment.copperHeight ?? 0);

        const spilloverCost = trayHeight + additionalLength;
        return { entryPoint: cabinet, spilloverCost, segmentId: segment.id };
      }
    }

    // Check if segment runs along the cabinet's Y coordinate (horizontal segment)
    if (segment.start.y === segment.end.y && segment.start.y === cabinet.y) {
      // Check if cabinet's X is within segment range
      const startXNum = calculateXDistance('AA', segment.start.x, 1, room.coordinateFormat);
      const endXNum = calculateXDistance('AA', segment.end.x, 1, room.coordinateFormat);
      const cabinetXNum = calculateXDistance('AA', cabinet.x, 1, room.coordinateFormat);
      const minX = Math.min(startXNum, endXNum);
      const maxX = Math.max(startXNum, endXNum);

      if (cabinetXNum >= minX && cabinetXNum <= maxX) {
        // Cabinet can connect to this segment at its exact X position
        const trayHeight = cableType === 'fiber'
          ? (segment.fiberHeight ?? 0)
          : (segment.copperHeight ?? 0);

        const spilloverCost = trayHeight + additionalLength;
        return { entryPoint: cabinet, spilloverCost, segmentId: segment.id };
      }
    }
  }

  // Fallback: no segment runs above this cabinet, use cabinet position as entry point
  return {
    entryPoint: cabinet,
    spilloverCost: additionalLength,
    segmentId: null,
  };
}

/**
 * Find shortest path between two cabinets using the tray graph.
 * Returns complete path result with spillover calculations.
 * Returns null if no path exists, with optional error message.
 */
export function findShortestPath(
  startCab: GridPoint,
  _startU: number,
  endCab: GridPoint,
  _endU: number,
  cableType: 'fiber' | 'copper',
  room: Room
): PathResult | null {
  // Guard against empty path segments
  if (!room.pathSegments || room.pathSegments.length === 0) {
    return null;
  }

  // Build graph for this cable type
  const graph = new PathGraph(room.pathSegments, cableType, room.tileSize, room.coordinateFormat);

  // Find entry points for both cabinets
  const startEntry = findCabinetEntryPoint(startCab, cableType, room);
  const endEntry = findCabinetEntryPoint(endCab, cableType, room);

  // Inject mid-segment entry points into the graph so Dijkstra can reach them
  if (startEntry.segmentId) {
    graph.injectMidpoint(startEntry.entryPoint, startEntry.segmentId);
  }
  if (endEntry.segmentId) {
    graph.injectMidpoint(endEntry.entryPoint, endEntry.segmentId);
  }

  const startNodeId = `${startEntry.entryPoint.x}-${startEntry.entryPoint.y}`;
  const endNodeId = `${endEntry.entryPoint.x}-${endEntry.entryPoint.y}`;

  // Find shortest path using Dijkstra
  const dijkstraResult = dijkstra(graph, startNodeId, endNodeId);
  const segmentIds = dijkstraResult?.segments ?? null;

  // If no path found or same entry point (same row, same tray), use direct distance
  if (!segmentIds || segmentIds.length === 0) {
    // Find the tray segment that both cabinets connect to
    let directSegment: PathSegment | null = null;
    for (const segment of room.pathSegments) {
      const height = cableType === 'fiber' ? segment.fiberHeight : segment.copperHeight;
      if (height === null) continue;

      // Check if both cabinets are within this segment's range
      // Handle vertical segments (same X)
      const startInRangeVertical = startCab.x === segment.start.x &&
        startCab.y >= Math.min(segment.start.y, segment.end.y) &&
        startCab.y <= Math.max(segment.start.y, segment.end.y);
      const endInRangeVertical = endCab.x === segment.start.x &&
        endCab.y >= Math.min(segment.start.y, segment.end.y) &&
        endCab.y <= Math.max(segment.start.y, segment.end.y);

      // Handle horizontal segments (same Y)
      const startXNum = calculateXDistance('AA', segment.start.x, 1, room.coordinateFormat);
      const endXNum = calculateXDistance('AA', segment.end.x, 1, room.coordinateFormat);
      const startCabXNum = calculateXDistance('AA', startCab.x, 1, room.coordinateFormat);
      const endCabXNum = calculateXDistance('AA', endCab.x, 1, room.coordinateFormat);
      const minX = Math.min(startXNum, endXNum);
      const maxX = Math.max(startXNum, endXNum);

      const startInRangeHorizontal = startCab.y === segment.start.y &&
        startCabXNum >= minX && startCabXNum <= maxX;
      const endInRangeHorizontal = endCab.y === segment.start.y &&
        endCabXNum >= minX && endCabXNum <= maxX;

      if ((startInRangeVertical && endInRangeVertical) || (startInRangeHorizontal && endInRangeHorizontal)) {
        directSegment = segment;
        break;
      }
    }

    if (directSegment) {
      // Calculate distance based on segment orientation
      let trayDistance: number;
      if (directSegment.start.x === directSegment.end.x) {
        // Vertical segment
        trayDistance = Math.abs(startCab.y - endCab.y) * room.tileSize;
      } else {
        // Horizontal segment
        const startXNum = calculateXDistance('AA', startCab.x, 1, room.coordinateFormat);
        const endXNum = calculateXDistance('AA', endCab.x, 1, room.coordinateFormat);
        trayDistance = Math.abs(startXNum - endXNum) * room.tileSize;
      }
      const totalDistance = trayDistance + startEntry.spilloverCost + endEntry.spilloverCost;

      return {
        segments: [directSegment],
        nodes: [startNodeId, endNodeId],
        entrySpillover: startEntry.spilloverCost,
        exitSpillover: endEntry.spilloverCost,
        transferSpillovers: 0,
        totalTrayDistance: trayDistance,
        totalDistance,
        pathName: directSegment.name,
        isShortest: true,
        percentOverShortest: 0,
      };
    }

    return null;
  }

  // Build path result
  const segments: PathSegment[] = [];
  for (const id of segmentIds) {
    const seg = graph.getSegment(id);
    if (seg) segments.push(seg);
  }

  const totalTrayDistance = dijkstraResult!.nodes.length > 1
    ? edgeWeightCost(graph, dijkstraResult!.nodes)
    : 0;
  
  // If path has disconnected nodes, return null
  if (totalTrayDistance === null) return null;
  
  // Spillover uses max tray height on this path (matches old calculator: height+offset added once)
  const spillover = pathSpilloverCost(segments, cableType, room.spilloverAdditionalLength);
  const totalDistance = totalTrayDistance + spillover;

  // Generate path name
  const pathName = segments.map(s => s.name).join(' → ');

  return {
    segments,
    nodes: dijkstraResult!.nodes,
    entrySpillover: spillover,
    exitSpillover: spillover,
    transferSpillovers: 0,
    totalTrayDistance,
    totalDistance,
    pathName,
    isShortest: true,
    percentOverShortest: 0,
  };
}

/**
 * Find k-shortest paths between two cabinets.
 * Returns paths sorted by total distance, with pruning for excessively long paths.
 */
export function findKShortestPaths(
  startCab: GridPoint,
  _startU: number,
  endCab: GridPoint,
  _endU: number,
  cableType: 'fiber' | 'copper',
  room: Room,
  k: number = 4,
  maxDistanceRatio: number = 2.0
): PathResult[] {
  // Guard against empty path segments
  if (!room.pathSegments || room.pathSegments.length === 0) {
    return [];
  }

  // Build graph for this cable type
  const graph = new PathGraph(room.pathSegments, cableType, room.tileSize, room.coordinateFormat);

  // Find entry points for both cabinets
  const startEntry = findCabinetEntryPoint(startCab, cableType, room);
  const endEntry = findCabinetEntryPoint(endCab, cableType, room);

  // Inject mid-segment entry points into the graph so Dijkstra can reach them
  if (startEntry.segmentId) {
    graph.injectMidpoint(startEntry.entryPoint, startEntry.segmentId);
  }
  if (endEntry.segmentId) {
    graph.injectMidpoint(endEntry.entryPoint, endEntry.segmentId);
  }

  const startNodeId = `${startEntry.entryPoint.x}-${startEntry.entryPoint.y}`;
  const endNodeId = `${endEntry.entryPoint.x}-${endEntry.entryPoint.y}`;

  // Find k-shortest paths using Yen's algorithm
  const allPaths = kShortestPaths(graph, startNodeId, endNodeId, k);
  if (allPaths.length === 0) return [];

  // Build path results
  const results: PathResult[] = [];
  for (let i = 0; i < allPaths.length; i++) {
    const { segments: segmentIds, cost: totalTrayDistance } = allPaths[i];
    
    // Skip if cost is null (shouldn't happen due to null check in kShortestPaths, but defense in depth)
    if (totalTrayDistance === null) continue;
    
    const segments: PathSegment[] = [];
    const segmentSet = new Set<string>(); // Track unique segments

    for (const id of segmentIds) {
      const seg = graph.getSegment(id);
      if (seg) {
        // Add actual path segments (deduplicate by segment ID)
        if (!segmentSet.has(seg.id)) {
          segmentSet.add(seg.id);
          segments.push(seg);
        }
      }
    }

    // If no segments found, this path is invalid
    if (segments.length === 0) continue;

    // Spillover uses max tray height on this path (matches old calculator: height+offset added once)
    const spillover = pathSpilloverCost(segments, cableType, room.spilloverAdditionalLength);
    const totalDistance = totalTrayDistance + spillover;

    const pathName = segments.map(s => s.name).join(' → ');

    results.push({
      segments,
      nodes: allPaths[i].nodes,
      entrySpillover: spillover,
      exitSpillover: spillover,
      transferSpillovers: 0,
      totalTrayDistance,
      totalDistance,
      pathName,
      isShortest: i === 0,
      percentOverShortest: i === 0 ? 0 : ((totalDistance / results[0].totalDistance) - 1) * 100,
    });
  }

  // Prune paths that exceed max ratio
  return prunePaths(results, maxDistanceRatio);
}
