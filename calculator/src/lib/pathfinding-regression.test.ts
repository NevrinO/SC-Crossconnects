import { test, expect } from 'vitest';
import { findKShortestPaths } from './pathfinding';
import { validateRooms } from './validation';
import roomsData from '../data/rooms.json';

const rooms = validateRooms(roomsData);
const room14 = rooms.find(r => r.id === 'CR-14')!;

/**
 * Regression test: Issue 1 minimum capability.
 * With overlap penalty + turn-primary sort, k=10 for FK132->FS155
 * must return structurally diverse paths including FZ and GD routes.
 */
test('k=10 for FK132->FS155 returns FZ and GD paths', () => {
  const results = findKShortestPaths(
    { x: 'FK', y: 132 }, 42,
    { x: 'FS', y: 155 }, 42,
    'fiber', room14, 10, 10.0
  );

  expect(results.length).toBeGreaterThanOrEqual(8);

  const hasFZ = results.some(r => r.nodes.some(n => n.startsWith('FZ-')));
  const hasGD = results.some(r => r.nodes.some(n => n.startsWith('GD-')));

  expect(hasFZ).toBe(true);
  expect(hasGD).toBe(true);
});

/**
 * Regression test: Issue 1 sort order.
 * Results must be sorted by (turnCount, totalDistance).
 * The shortest-turn route should appear before higher-turn routes.
 */
test('results sorted by turnCount then distance', () => {
  const results = findKShortestPaths(
    { x: 'FK', y: 132 }, 42,
    { x: 'FS', y: 155 }, 42,
    'fiber', room14, 10, 10.0
  );

  expect(results.length).toBeGreaterThanOrEqual(4);

  // Verify non-decreasing turnCount
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];
    expect(curr.turnCount).toBeGreaterThanOrEqual(prev.turnCount);
    if (curr.turnCount === prev.turnCount) {
      expect(curr.totalDistance).toBeGreaterThanOrEqual(prev.totalDistance);
    }
  }
});

/**
 * Regression test: Issue 2 route simplification.
 * pathName should contain only turn points, not every intermediate node.
 * For a straight path FK->FN->FS, pathName should be exactly "FK-132 → FN-132 → FN-155 → FS-155"
 * (or the simplified equivalent), not a long list of every tile.
 */
test('simplified route does not list every intermediate node', () => {
  const results = findKShortestPaths(
    { x: 'FK', y: 132 }, 42,
    { x: 'FS', y: 155 }, 42,
    'fiber', room14, 10, 10.0
  );

  const straightPath = results.find(r => r.pathName === 'FK-132 → FN-132 → FN-155 → FS-155');
  expect(straightPath).toBeTruthy();

  // The longest pathName should not exceed a reasonable number of turn points
  // (k=10 results should not have pathNames with >15 nodes each)
  for (const r of results) {
    const nodeCount = r.pathName.split(' → ').length;
    expect(nodeCount).toBeLessThanOrEqual(15);
  }
});

/**
 * Regression test: Issue 1 path diversity.
 * The top 5 results should not all share >80% tile overlap.
 * At least 3 distinct "route families" should be present.
 */
test('top 5 paths include at least 3 structurally distinct routes', () => {
  const results = findKShortestPaths(
    { x: 'FK', y: 132 }, 42,
    { x: 'FS', y: 155 }, 42,
    'fiber', room14, 10, 10.0
  );

  const top5 = results.slice(0, 5);

  // Extract "major column route" as the set of column prefixes used (excluding start/end)
  const getMajorColumns = (nodes: string[]) => {
    const cols = new Set<string>();
    for (const node of nodes) {
      const col = node.split('-')[0];
      // Skip start (FK) and end (FS) to focus on traversed corridors
      if (col !== 'FK' && col !== 'FS') {
        cols.add(col);
      }
    }
    return Array.from(cols).sort().join(',');
  };

  const families = new Set<string>();
  for (const r of top5) {
    families.add(getMajorColumns(r.nodes));
  }

  expect(families.size).toBeGreaterThanOrEqual(3);
});
