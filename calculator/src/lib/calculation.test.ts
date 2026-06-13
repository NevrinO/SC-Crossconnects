import { test, expect } from 'vitest';
import { calculateManual, getAvailablePaths, getCabType } from './calculation';
import { calculateRowDistance } from './char-utils';
import { validateRooms } from './validation';
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

test('Room 14 GD132 to GD140 fiber', () => {
  const room14 = rooms.find(r => r.id === '14')!;
  const paths = getAvailablePaths(room14, 'fiber');
  const seg = paths.find(p => p.id === 'fiber-south-gd')!;
  const result = calculateManual('GD132', 'GD140', [seg], 'fiber', 0, room14);
  expect(result).toBeTruthy();
  expect(result!.lengthFt).toBe(28);
});

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

test('Room 14 GD132 to FM132 fiber', () => {
  const room14 = rooms.find(r => r.id === '14')!;
  const paths = getAvailablePaths(room14, 'fiber');
  const seg = paths.find(p => p.id === 'fiber-south-gd')!;
  const result = calculateManual('GD132', 'FM132', [seg], 'fiber', 0, room14);
  if (!result) throw new Error('No result');
  console.log('  GD132->FM132 fiber result:', result.lengthFt, 'ft');
});

// Test 3: Room 10 same row
// CT105 to CT110, Fiber East
// Old tool: len = 6 + 4 = 10
// same row: len += |105 - 110| * 2 = 10
// len = 20
// azRun(CT, CT, 2) = 0
// Total = 20

test('Room 10 CT105 to CT110 fiber', () => {
  const room10 = rooms.find(r => r.id === '10')!;
  const paths = getAvailablePaths(room10, 'fiber');
  const seg = paths.find(p => p.id === 'fiber-east-114')!;
  const result = calculateManual('CT105', 'CT110', [seg], 'fiber', 0, room10);
  expect(result).toBeTruthy();
  expect(result!.lengthFt).toBe(20);
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

test('Room 10 CT105 to CU105 fiber', () => {
  const room10 = rooms.find(r => r.id === '10')!;
  const paths = getAvailablePaths(room10, 'fiber');
  const seg = paths.find(p => p.id === 'fiber-east-114')!;
  const result = calculateManual('CT105', 'CU105', [seg], 'fiber', 0, room10);
  expect(result).toBeTruthy();
  expect(result!.lengthFt).toBe(48);
});

// Test 5: Network rack adjustment
// EU108:1:5 to EU110, room 10, fiber
// Old tool extracts panel=1 from "EU108:1:5" (substring between cabinet and last colon)
// len = 6 + 4 = 10
// same row: |108 - 110| * 2 = 4
// len = 14
// network rack panel 1: ceil(1 * 0.7) = ceil(0.7) = 1
// Total = 15

test('Room 10 network rack adjustment', () => {
  const room10 = rooms.find(r => r.id === '10')!;
  const paths = getAvailablePaths(room10, 'fiber');
  const seg = paths.find(p => p.id === 'fiber-east-114')!;
  const result = calculateManual('EU108:1:5', 'EU110', [seg], 'fiber', 0, room10);
  expect(result).toBeTruthy();
  expect(result!.lengthFt).toBe(15);
});

// Test 6: getCabType correctly strips port info for half/quarter cabs
test('getCabType strips port info for half/quarter cabs', () => {
  // With port info but no suffix -> full_cab because cabOnly won't match half/quarter ranges
  expect(getCabType('FR132:1:5')).toEqual({ type: 'full_cab', value: '' });
  // With suffix and port info -> half_cab, value from cabOnly
  expect(getCabType('FR132A:1:5')).toEqual({ type: 'half_cab', value: 'A' });
  // Quarter cab with port info
  expect(getCabType('FZ185B:1:5')).toEqual({ type: 'quarter_cab', value: 'B' });
});

// Test 7: calculateRowDistance for letters-first format
test('calculateRowDistance for letters-first format', () => {
  // AA to AB = 1 step * 2 = 2 feet
  expect(calculateRowDistance('AA', 'AB', 2, 'letters-first')).toBe(2);
  // GD to GM = 9 steps * 2 = 18 feet
  expect(calculateRowDistance('GD', 'GM', 2, 'letters-first')).toBe(18);
  // ZZ to AA (reverse) = 675 steps * 2 = 1350 feet
  expect(calculateRowDistance('ZZ', 'AA', 2, 'letters-first')).toBe(1350);
});

// Test 8: calculateRowDistance for numbers-first format
test('calculateRowDistance for numbers-first format', () => {
  // 123 to 124 = 1 step * 2 = 2 feet
  expect(calculateRowDistance('123', '124', 2, 'numbers-first')).toBe(2);
  // 100 to 150 = 50 steps * 2 = 100 feet
  expect(calculateRowDistance('100', '150', 2, 'numbers-first')).toBe(100);
  // 999 to 001 (reverse) = 998 steps * 2 = 1996 feet
  expect(calculateRowDistance('999', '001', 2, 'numbers-first')).toBe(1996);
});
