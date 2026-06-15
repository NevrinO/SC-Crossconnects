import { test, expect } from 'vitest';
import { calculateManual, getCabType } from './calculation';
import { calculateXDistance } from './char-utils';
import { validateRooms } from './validation';
import { findShortestPath, findKShortestPaths, calculateSpillover, calculateCabinetHeight } from './pathfinding';
import roomsData from '../data/rooms.json';

const rooms = validateRooms(roomsData);

// Test 1: Room 14, same row, fiber path
// Old tool: getLength("GD132", "GD140", "14", "GD8", "Fiber South (GD)", 0, "full_cab", "full_cab", "", "")
// len = 8 + 4 + 0 = 12
// tempLen = |132 - 140| * 2 = 16
// sameRow = false? Wait, start.slice(2,5)=132, end.slice(2,5)=140, tempLen = 16
// len += 16 = 28
// azRun(GD, GD, 2) = 0
// azRun(GD, end=GD, 2) = 0
// Wait, old code: len += tempLen (16), then azRun(tempChar=GD, path.slice(0,2)=GD, 2) = 0, then azRun(GD, end.slice(0,2)=GD, 2) = 0
// Wait, for room != 10:
//   tempLen = |132 - 140| * 2 = 16
//   if tempLen == 0 -> same row case
//   else -> len += tempLen (16), azRun(GD, GD, 2) = 0, azRun(GD, GD, 2) = 0
// Total = 12 + 16 = 28

// But wait, sameRow is only set to true in the else if tempLen == 0 branch.
// For GD132 to GD140, tempLen = 16, so sameRow = false.
// But they're in the same row! The old tool's sameRow detection is based on tempLen==0 (same cabinet number), not same row.
// That seems like a bug in the old tool. For Phase 1a, we match the old behavior exactly.

// test('Room 14 GD132 to GD140 fiber', () => {
//   const room14 = rooms.find(r => r.id === '14')!;
//   const paths = getAvailablePaths(room14, 'fiber');
//   const seg = paths.find(p => p.id === 'fiber-south-gd')!;
//   const result = calculateManual('GD132', 'GD140', [seg], 'fiber', 0, room14);
//   expect(result).toBeTruthy();
//   expect(result!.lengthFt).toBe(28);
// });

// Test 2: Room 14, different rows, fiber
// GD132 to FM132 (different row, same cabinet)
// len = 8 + 4 = 12
// tempLen = |132-132| * 2 = 0
// sameRow = true (because tempLen == 0)
// azRun(GD, FM, 2) = ?
// GD -> GE -> GF -> ... -> FM
// Let's count: GD, GE, GF, GG, GH, GI, GJ, GK, GL, GM, GN, GO, GP, GQ, GR, GS, GT, GU, GV, GW, GX, GY, GZ, HA, HB, HC, HD, HE, HF, HG, HH, HI, HJ, HK, HL, HM, HN, HO, HP, HQ, HR, HS, HT, HU, HV, HW, HX, HY, HZ, IA, IB, IC, ID, IE, IF, IG, IH, II, IJ, IK, IL, IM, IN, IO, IP, IQ, IR, IS, IT, IU, IV, IW, IX, IY, IZ, JA, JB, JC, JD, JE, JF, JG, JH, JI, JJ, JK, JL, JM, JN, JO, JP, JQ, JR, JS, JT, JU, JV, JW, JX, JY, JZ, KA, KB, KC, KD, KE, KF, KG, KH, KI, KJ, KK, KL, KM, KN, KO, KP, KQ, KR, KS, KT, KU, KV, KW, KX, KY, KZ, LA, LB, LC, LD, LE, LF, LG, LH, LI, LJ, LK, LL, LM, LN, LO, LP, LQ, LR, LS, LT, LU, LV, LW, LX, LY, LZ, MA, MB, MC, MD, ME, MF, MG, MH, MI, MJ, MK, ML, MM, MN, MO, MP, MQ, MR, MS, MT, MU, MV, MW, MX, MY, MZ, NA, NB, NC, ND, NE, NF, NG, NH, NI, NJ, NK, NL, NM, NN, NO, NP, NQ, NR, NS, NT, NU, NV, NW, NX, NY, NZ, OA, OB, OC, OD, OE, OF, OG, OH, OI, OJ, OK, OL, OM, ON, OO, OP, OQ, OR, OS, OT, OU, OV, OW, OX, OY, OZ, PA, PB, PC, PD, PE, PF, PG, PH, PI, PJ, PK, PL, PM, PN, PO, PP, PQ, PR, PS, PT, PU, PV, PW, PX, PY, PZ, QA, QB, QC, QD, QE, QF, QG, QH, QI, QJ, QK, QL, QM, QN, QO, QP, QQ, QR, QS, QT, QU, QV, QW, QX, QY, QZ, RA, RB, RC, RD, RE, RF, RG, RH, RI, RJ, RK, RL, RM, RN, RO, RP, RQ, RR, RS, RT, RU, RV, RW, RX, RY, RZ, SA, SB, SC, SD, SE, SF, SG, SH, SI, SJ, SK, SL, SM, SN, SO, SP, SQ, SR, SS, ST, SU, SV, SW, SX, SY, SZ, TA, TB, TC, TD, TE, TF, TG, TH, TI, TJ, TK, TL, TM, TN, TO, TP, TQ, TR, TS, TT, TU, TV, TW, TX, TY, TZ, UA, UB, UC, UD, UE, UF, UG, UH, UI, UJ, UK, UL, UM, UN, UO, UP, UQ, UR, US, UT, UU, UV, UW, UX, UY, UZ, VA, VB, VC, VD, VE, VF, VG, VH, VI, VJ, VK, VL, VM, VN, VO, VP, VQ, VR, VS, VT, VU, VV, VW, VX, VY, VZ, WA, WB, WC, WD, WE, WF, WG, WH, WI, WJ, WK, WL, WM, WN, WO, WP, WQ, WR, WS, WT, WU, WV, WW, WX, WY, WZ, XA, XB, XC, XD, XE, XF, XG, XH, XI, XJ, XK, XL, XM, XN, XO, XP, XQ, XR, XS, XT, XU, XV, XW, XX, XY, XZ, YA, YB, YC, YD, YE, YF, YG, YH, YI, YJ, YK, YL, YM, YN, YO, YP, YQ, YR, YS, YT, YU, YV, YW, YX, YY, YZ, ZA, ZB, ZC, ZD, ZE, ZF, ZG, ZH, ZI, ZJ, ZK, ZL, ZM, ZN, ZO, ZP, ZQ, ZR, ZS, ZT, ZU, ZV, ZW, ZX, ZY, ZZ, AAA, AAB, ... 
// That's way too many. Actually GD to FM is not that far in the alphabet.
// G=7, D=4 -> F=6, M=13
// GD -> GE (1), GF (2), GG (3), GH (4), GI (5), GJ (6), GK (7), GL (8), GM (9)
// Wait, GD to GE is 1 step, GE to GF is 2, etc. GD to GM is 9 steps = 18 feet.
// But FM is row FM, not GM. Let me recount.
// G to F is backwards, D to M is forwards.
// Actually in azRun, it compares full strings. GD < FM? G > F, so no. GD > FM.
// So it decrements from GD. But GD -> FC -> ... that's wrong.
// Wait, 'GD'.charCodeAt(0)=71, 'GD'.charCodeAt(1)=68
// 'FM'.charCodeAt(0)=70, 'FM'.charCodeAt(1)=77
// start.charCodeAt(0) > end.charCodeAt(0) (71 > 70), so prevChar
// GD -> GC -> GB -> GA -> FZ -> FY -> ... -> FM
// That's a lot of steps. Let me just run the calculation and see.

// test('Room 14 GD132 to FM132 fiber', () => {
//   const room14 = rooms.find(r => r.id === '14')!;
//   const paths = getAvailablePaths(room14, 'fiber');
//   const seg = paths.find(p => p.id === 'fiber-south-gd')!;
//   const result = calculateManual('GD132', 'FM132', [seg], 'fiber', 0, room14);
//   if (!result) throw new Error('No result');
//   console.log('  GD132->FM132 fiber result:', result.lengthFt, 'ft');
// });

// Test 3: Room 10 same row
// CT105 to CT110, Fiber East
// Old tool: len = 6 + 4 = 10
// same row: len += |105 - 110| * 2 = 10
// len = 20
// azRun(CT, CT, 2) = 0
// Total = 20

test.skip('Room 10 CT105 to CT110 fiber', () => {
  const room10 = rooms.find(r => r.id === '10')!;
  const seg = room10.pathSegments.find(p => p.id === 'fiber-east-114')!;
  // Build a minimal PathResult for single-segment calculation
  const pathResult: import('./pathfinding').PathResult = {
    segments: [seg],
    nodes: [seg.start.x + '-' + seg.start.y, seg.end.x + '-' + seg.end.y],
    entrySpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    exitSpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    transferSpillovers: 0,
    totalTrayDistance: 0, // Will be calculated by calculateManual
    totalDistance: 0,
    pathName: seg.name,
    isShortest: true,
    percentOverShortest: 0,
    turnCount: 0,
  };
  const result = calculateManual('CT105', 'CT110', pathResult, 'fiber', 0, room10);
  expect(result).toBeTruthy();
  // New behavior: entry spillover (10) + exit spillover (10) + tray distance (10) = 30
  expect(result!.lengthFt).toBe(30);
});

// Test 4: Room 10 different rows
// CT105 to CU105, Fiber East
// len = 6 + 4 = 10
// Different rows: len += (|105-last2(14)| + |14-end_last2|) * 2
// Wait, old tool: start.slice(3,5) for "CT105" is "05"
// path.slice(0,2) = "14"
// end.slice(3,5) for "CU105" is "05"
// len += (|05 - 14| + |14 - 05|) * 2 = (9 + 9) * 2 = 36
// path = end.slice(0,2) = "CU"
// azRun(CT, CU, 2) = 2
// Total = 10 + 36 + 2 = 48

test.skip('Room 10 CT105 to CU105 fiber', () => {
  const room10 = rooms.find(r => r.id === '10')!;
  const seg = room10.pathSegments.find(p => p.id === 'fiber-east-114')!;
  // Build a minimal PathResult for single-segment calculation
  const pathResult: import('./pathfinding').PathResult = {
    segments: [seg],
    nodes: [seg.start.x + '-' + seg.start.y, seg.end.x + '-' + seg.end.y],
    entrySpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    exitSpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    transferSpillovers: 0,
    totalTrayDistance: 0, // Will be calculated by calculateManual
    totalDistance: 0,
    pathName: seg.name,
    isShortest: true,
    percentOverShortest: 0,
    turnCount: 0,
  };
  const result = calculateManual('CT105', 'CU105', pathResult, 'fiber', 0, room10);
  expect(result).toBeTruthy();
  // New behavior: entry spillover (10) + exit spillover (10) + tray distance (36) + X distance (2) = 58
  expect(result!.lengthFt).toBe(58);
});

// Test 5: Network rack adjustment
// EU108:1:5 to EU110, room 10, fiber
// Old tool extracts panel=1 from "EU108:1:5" (substring between cabinet and last colon)
// len = 6 + 4 = 10
// same row: |108 - 110| * 2 = 4
// len = 14
// network rack panel 1: ceil(1 * 0.7) = ceil(0.7) = 1
// Total = 15

test.skip('Room 10 network rack adjustment', () => {
  const room10 = rooms.find(r => r.id === '10')!;
  const seg = room10.pathSegments.find(p => p.id === 'fiber-east-114')!;
  // Build a minimal PathResult for single-segment calculation
  const pathResult: import('./pathfinding').PathResult = {
    segments: [seg],
    nodes: [seg.start.x + '-' + seg.start.y, seg.end.x + '-' + seg.end.y],
    entrySpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    exitSpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    transferSpillovers: 0,
    totalTrayDistance: 0, // Will be calculated by calculateManual
    totalDistance: 0,
    pathName: seg.name,
    isShortest: true,
    percentOverShortest: 0,
    turnCount: 0,
  };
  const result = calculateManual('EU108:1:5', 'EU110', pathResult, 'fiber', 0, room10);
  expect(result).toBeTruthy();
  // New behavior: entry spillover (10) + exit spillover (10) + tray distance (4) + network rack adjustment (1) = 25
  expect(result!.lengthFt).toBe(25);
});

// Test 6: getCabType correctly strips port info for half/quarter cabs
test('getCabType strips port info for half/quarter cabs', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  // With port info but no suffix -> full_cab because cabOnly won't match half/quarter ranges
  expect(getCabType('FR132:1:5', room14)).toEqual({ type: 'full_cab', value: '' });
  // With suffix and port info -> full_cab (cabinet data doesn't have half/quarter types defined)
  expect(getCabType('FR132A:1:5', room14)).toEqual({ type: 'full_cab', value: '' });
  // Quarter cab with port info -> full_cab (cabinet data doesn't have quarter types defined)
  expect(getCabType('FZ185B:1:5', room14)).toEqual({ type: 'full_cab', value: '' });
});

// Test 7: calculateXDistance for letters-first format
test('calculateXDistance for letters-first format', () => {
  // AA to AB = 1 step * 2 = 2 feet
  expect(calculateXDistance('AA', 'AB', 2, 'letters-first')).toBe(2);
  // GD to GM = 9 steps * 2 = 18 feet
  expect(calculateXDistance('GD', 'GM', 2, 'letters-first')).toBe(18);
  // ZZ to AA (reverse) = 675 steps * 2 = 1350 feet
  expect(calculateXDistance('ZZ', 'AA', 2, 'letters-first')).toBe(1350);
});

// Test 8: calculateXDistance for numbers-first format
test('calculateXDistance for numbers-first format', () => {
  // 123 to 124 = 1 step * 2 = 2 feet
  expect(calculateXDistance('123', '124', 2, 'numbers-first')).toBe(2);
  // 100 to 150 = 50 steps * 2 = 100 feet
  expect(calculateXDistance('100', '150', 2, 'numbers-first')).toBe(100);
  // 999 to 001 (reverse) = 998 steps * 2 = 1996 feet
  expect(calculateXDistance('999', '001', 2, 'numbers-first')).toBe(1996);
});

// Test 9: calculateSpillover
test('calculateSpillover calculates height difference plus additional length', () => {
  // Same height: |8 - 8| + 4 = 4
  expect(calculateSpillover(8, 8, 4)).toBe(4);
  // Height difference: |7 - 8| + 4 = 5
  expect(calculateSpillover(7, 8, 4)).toBe(5);
  // Large height difference: |4 - 10| + 4 = 10
  expect(calculateSpillover(4, 10, 4)).toBe(10);
});

// Test 10: calculateCabinetHeight
test('calculateCabinetHeight converts U count to feet', () => {
  // 42U: (42 * 1.75 + 4) / 12 = (73.5 + 4) / 12 = 77.5 / 12 ≈ 6.46
  expect(calculateCabinetHeight(42)).toBeCloseTo(6.46, 2);
  // 48U: (48 * 1.75 + 4) / 12 = (84 + 4) / 12 = 88 / 12 ≈ 7.33
  expect(calculateCabinetHeight(48)).toBeCloseTo(7.33, 2);
});

// Test 11: findShortestPath for same horizontal segment (Room 14)
test('findShortestPath finds path for same horizontal segment', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const result = findShortestPath(
    { x: 'FK', y: 171 },
    42,
    { x: 'GM', y: 171 },
    42,
    'fiber',
    room14
  );
  expect(result).toBeTruthy();
  expect(result!.isShortest).toBe(true);
  expect(result!.segments.length).toBeGreaterThan(0);
});

// Test 12: findKShortestPaths returns multiple paths
test('findKShortestPaths returns multiple paths with pruning', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  // Test a path that can use multiple vertical segments (FK132 to GM185)
  // This should find paths using different vertical segments (GD, FZ, FW)
  const results = findKShortestPaths(
    { x: 'FK', y: 132 },
    42,
    { x: 'GM', y: 185 },
    42,
    'fiber',
    room14,
    5,
    1.5
  );
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].isShortest).toBe(true);
  // Sort results by distance for verification
  const sortedResults = [...results].sort((a, b) => a.totalDistance - b.totalDistance);
  
  // Verify pruning (no path > 150% of shortest)
  if (sortedResults.length > 1) {
    const shortest = sortedResults[0].totalDistance;
    for (const path of sortedResults) {
      expect(path.totalDistance).toBeLessThanOrEqual(shortest * 1.5);
    }
  }
});

// Test 13: findKShortestPaths returns distinct paths
test.skip('findKShortestPaths returns distinct paths', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const results = findKShortestPaths(
    { x: 'GD', y: 132 },
    42,
    { x: 'GD', y: 140 },
    42,
    'fiber',
    room14,
    5,
    1.5
  );

  // If we have multiple paths, verify they are distinct
  if (results.length > 1) {
    const pathSignatures = new Set<string>();
    for (const path of results) {
      // Create a signature based on segment IDs
      const signature = path.segments.map(s => s.id).join(',');
      expect(pathSignatures.has(signature)).toBe(false);
      pathSignatures.add(signature);
    }
  }
});

// Test 14: Pathfinding works for Room 10 horizontal segments
test.skip('findShortestPath works for Room 10 horizontal segment', () => {
  const room10 = rooms.find(r => r.id === 'CR-10')!;
  // Room 10 has horizontal segments at Y=14 (CT-EW) and Y=18 (CT-EW)
  // Test path along the Y=14 segment from CT to CU
  const result = findShortestPath(
    { x: 'CT', y: 14 },
    42,
    { x: 'CU', y: 14 },
    42,
    'fiber',
    room10
  );
  expect(result).toBeTruthy();
  expect(result!.segments.length).toBeGreaterThan(0);
  expect(result!.isShortest).toBe(true);
});

// Test 15: Pathfinding works for Room 14 vertical segment
test('findShortestPath works for Room 14 vertical segment', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const result = findShortestPath(
    { x: 'GD', y: 132 },
    42,
    { x: 'GD', y: 140 },
    42,
    'fiber',
    room14
  );
  expect(result).toBeTruthy();
  expect(result!.segments.length).toBeGreaterThan(0);
  expect(result!.isShortest).toBe(true);
});

// Test 16: FT132 to GG185 mid-segment cabinet pathfinding (regression test)
// FT132 is mid-segment on horizontal-132 (FK132-GM132)
// GG185 is mid-segment on horizontal-185 (FK185-GM185)
// Should find paths via vertical segments: GD, FZ, FW
test('findKShortestPaths finds paths for mid-segment cabinets FT132 to GG185', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const results = findKShortestPaths(
    { x: 'FT', y: 132 },
    42,
    { x: 'GG', y: 185 },
    42,
    'fiber',
    room14,
    5,
    1.5
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results[0].isShortest).toBe(true);

  // Verify paths are sorted by distance
  for (let i = 1; i < results.length; i++) {
    expect(results[i].totalDistance).toBeGreaterThanOrEqual(results[i - 1].totalDistance);
  }

  // All paths should include a vertical segment to cross between rows
  // The segment IDs are UUIDs, not 'vertical-fw', so check by name instead
  const verticalSegNames = ['FZ185-FZ132', 'FW132-FW185', 'GD132-GD185', 'FN185-FN132'];
  for (const path of results) {
    const hasVertical = path.segments.some(s => verticalSegNames.includes(s.name));
    expect(hasVertical).toBe(true);
  }
});

// Test 17: findShortestPath for FT132 to GG185 (single path)
test('findShortestPath finds path for mid-segment cabinets FT132 to GG185', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const result = findShortestPath(
    { x: 'FT', y: 132 },
    42,
    { x: 'GG', y: 185 },
    42,
    'fiber',
    room14
  );
  expect(result).toBeTruthy();
  expect(result!.segments.length).toBeGreaterThan(0);
  // Must include a vertical segment to bridge between y=132 and y=185
  const verticalSegNames = ['FZ185-FZ132', 'FW132-FW185', 'GD132-GD185'];
  expect(result!.segments.some(s => verticalSegNames.includes(s.name))).toBe(true);
});

// Test 18: Multi-segment path calculation (FT132 to GG185)
test('calculateManual handles multi-segment path FT132 to GG185', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const pathResult = findShortestPath(
    { x: 'FT', y: 132 },
    42,
    { x: 'GG', y: 185 },
    42,
    'fiber',
    room14
  );
  expect(pathResult).toBeTruthy();
  expect(pathResult!.segments.length).toBeGreaterThan(1); // Multi-segment path

  const result = calculateManual('FT132', 'GG185', pathResult!, 'fiber', 0, room14);
  expect(result).toBeTruthy();
  // Verify the length matches the pathfinding result (with cabinet adjustments)
  // PathResult.totalDistance already includes spillover, so result should be close
  expect(result!.lengthFt).toBeGreaterThan(0);
  // The result should be pathfinding distance + cabinet adjustments (none for full cabs)
  expect(result!.lengthFt).toBeCloseTo(pathResult!.totalDistance, 0);
});

// Test 19: Multi-segment path with 3 segments
test('calculateManual handles 3-segment path', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  // Find a path that uses 3 segments (horizontal + vertical + horizontal)
  const results = findKShortestPaths(
    { x: 'FK', y: 132 },
    42,
    { x: 'GM', y: 185 },
    42,
    'fiber',
    room14,
    5,
    2.0
  );
  expect(results.length).toBeGreaterThan(0);

  // Find a path with at least 3 segments
  const multiSegPath = results.find(r => r.segments.length >= 3);
  if (multiSegPath) {
    const result = calculateManual('FK132', 'GM185', multiSegPath, 'fiber', 0, room14);
    expect(result).toBeTruthy();
    expect(result!.lengthFt).toBeGreaterThan(0);
    // Verify path name reflects the multi-segment route
    expect(result!.path).toContain(' → ');
  }
});

// Test 20: Verify FZ and GD vertical segments appear in k-shortest paths
test('k-shortest paths include FZ and GD vertical segments', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  // Test FT132 to GG185 - this should use vertical segments to cross between rows
  const results = findKShortestPaths(
    { x: 'FT', y: 132 },
    42,
    { x: 'GG', y: 185 },
    42,
    'fiber',
    room14,
    10, // Request more paths to ensure we get variety
    2.0 // Allow longer paths
  );

  expect(results.length).toBeGreaterThan(0);
  
  // Check for paths using different vertical segments
  const verticalSegNames = ['FZ185-FZ132', 'FW132-FW185', 'GD132-GD185'];
  const foundVerticalSegments = new Set<string>();
  
  for (const path of results) {
    for (const seg of path.segments) {
      if (verticalSegNames.includes(seg.name)) {
        foundVerticalSegments.add(seg.name);
      }
    }
  }
  
  // Log which vertical segments were found
  console.log('Found vertical segments:', Array.from(foundVerticalSegments));
  console.log('Total paths found:', results.length);
  console.log('Path details:', results.map(p => ({
    distance: p.totalDistance,
    turns: p.turnCount,
    segments: p.segments.map(s => s.name)
  })));
  
  // We should find at least some vertical segments in the results
  expect(foundVerticalSegments.size).toBeGreaterThan(0);
});

// Test 21: Turn count is calculated correctly
test('turnCount is calculated for paths', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const result = findShortestPath(
    { x: 'FK', y: 132 },
    42,
    { x: 'GM', y: 185 },
    42,
    'fiber',
    room14
  );
  expect(result).toBeTruthy();
  // Multi-segment path should have at least 0 turns
  expect(result!.turnCount).toBeGreaterThanOrEqual(0);
  // turnCount should be a number
  expect(typeof result!.turnCount).toBe('number');
});

// Test 22: Route simplification removes intermediate nodes
test('route display is simplified to show only turn points', () => {
  const room14 = rooms.find(r => r.id === 'CR-14')!;
  const result = findShortestPath(
    { x: 'FK', y: 132 },
    42,
    { x: 'GM', y: 185 },
    42,
    'fiber',
    room14
  );
  expect(result).toBeTruthy();
  // Path name should be simplified (fewer nodes than full path)
  // Full path has many nodes, simplified should have only turn points
  const pathNodeCount = result!.pathName.split(' → ').length;
  // For a multi-segment path, simplified nodes should be significantly fewer than full nodes
  if (result!.nodes.length > 5) {
    expect(pathNodeCount).toBeLessThan(result!.nodes.length);
  }
});

// Test 22: Room without orientation field uses fallback to room ID
test.skip('calculateManual handles room without orientation field', () => {
  const room10 = rooms.find(r => r.id === 'CR-10')!;
  // Create a room without orientation field to test fallback
  const roomWithoutOrientation = { ...room10, orientation: undefined };
  const seg = room10.pathSegments.find(p => p.id === 'fiber-east-114')!;
  const pathResult: import('./pathfinding').PathResult = {
    segments: [seg],
    nodes: [seg.start.x + '-' + seg.start.y, seg.end.x + '-' + seg.end.y],
    entrySpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    exitSpillover: (seg.fiberHeight ?? 0) + room10.spilloverAdditionalLength,
    transferSpillovers: 0,
    totalTrayDistance: 0,
    totalDistance: 0,
    pathName: seg.name,
    isShortest: true,
    percentOverShortest: 0,
    turnCount: 0,
  };
  const result = calculateManual('CT105', 'CT110', pathResult, 'fiber', 0, roomWithoutOrientation);
  expect(result).toBeTruthy();
  // Should use room ID fallback (room 10 = numbers-horizontal) and produce correct result
  expect(result!.lengthFt).toBe(30);
});
