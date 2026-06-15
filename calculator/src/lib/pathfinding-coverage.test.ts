import { test, expect } from 'vitest';
import { findShortestPath } from './pathfinding';
import { validateRooms } from './validation';
import roomsData from '../data/rooms.json';

const rooms = validateRooms(roomsData);
const room14 = rooms.find(r => r.id === 'CR-14')!;

// Regression test: Ensure all cabinet pairs in Room 14 can find fiber paths
// This test samples cabinet pairs to verify the graph connectivity fix (adjacent intersection nodes)
test(
  'Room 14 fiber pathfinding coverage - regression test',
  () => {
    const failures: { start: string; end: string; reason: string }[] = [];
    const successCount = { sameRow: 0, differentRow: 0 };
    const failCount = { sameRow: 0, differentRow: 0 };

    const cabinets = room14.cabinets || [];

    // Test a sample of cabinet pairs (not all N^2 combinations to keep test fast)
    // Focus on problematic cases: different rows, different columns
    for (let i = 0; i < cabinets.length; i++) {
      for (let j = i + 1; j < cabinets.length; j++) {
        const start = cabinets[i];
        const end = cabinets[j];

        // Skip if same cabinet
        if (start.id === end.id) continue;

        // Test every 10th pair to keep test manageable
        if ((i * cabinets.length + j) % 10 !== 0) continue;

        const isSameRow = start.y === end.y;
        const result = findShortestPath(
          { x: start.x, y: start.y },
          42,
          { x: end.x, y: end.y },
          42,
          'fiber',
          room14
        );

        if (!result) {
          failCount[isSameRow ? 'sameRow' : 'differentRow']++;
          failures.push({
            start: start.id,
            end: end.id,
            reason: isSameRow ? 'same row' : 'different row'
          });
        } else {
          successCount[isSameRow ? 'sameRow' : 'differentRow']++;
        }
      }
    }

    console.log('Pathfinding coverage:');
    console.log(`  Same row successes: ${successCount.sameRow}, failures: ${failCount.sameRow}`);
    console.log(`  Different row successes: ${successCount.differentRow}, failures: ${failCount.differentRow}`);

    if (failures.length > 0) {
      console.log('Sample failures:');
      failures.slice(0, 20).forEach(f => {
        console.log(`  ${f.start} → ${f.end} (${f.reason})`);
      });
    }

    // Regression: All sampled cabinet pairs should find a path
    expect(failures.length).toBe(0);
    expect(successCount.sameRow + successCount.differentRow).toBeGreaterThan(0);
  },
  30000
);
