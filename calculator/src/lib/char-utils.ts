import type { CoordinateFormat } from '../types/room';

/**
 * Convert 2-letter X coordinate to base-26 number (Excel-style column numbering).
 * AA=1, AB=2, ..., ZZ=676
 * O(1) time complexity.
 */
function lettersToNumber(x: string): number {
  if (x.length !== 2) {
    throw new Error(`X coordinate must be 2 letters, got: ${x}`);
  }
  const upper = x.toUpperCase();
  const c1 = upper.charCodeAt(0) - 64; // A=1, B=2, ..., Z=26
  const c2 = upper.charCodeAt(1) - 64;
  return c1 * 26 + c2;
}

/**
 * Convert numeric X coordinate to number.
 * O(1) time complexity.
 */
function numbersToNumber(x: string): number {
  return parseInt(x, 10);
}

/**
 * Convert base-26 number to 2-letter X coordinate (inverse of lettersToNumber).
 * 1=AA, 2=AB, ..., 26=AZ, 27=BA, ..., 676=ZZ
 * O(1) time complexity.
 */
export function numberToLetters(num: number): string {
  if (num < 1 || num > 676) {
    throw new Error(`Number must be between 1 and 676, got: ${num}`);
  }
  const c1 = Math.floor((num - 1) / 26); // 0-25
  const c2 = (num - 1) % 26; // 0-25
  return String.fromCharCode(c1 + 65) + String.fromCharCode(c2 + 65);
}

/**
 * Calculate distance between two X coordinates using O(1) mathematical conversion.
 * Supports both letters-first (AA-ZZ) and numbers-first (001-999) formats.
 */
export function calculateXDistance(
  startX: string,
  endX: string,
  tileSize: number,
  format: CoordinateFormat
): number {
  const startNum = format === 'letters-first'
    ? lettersToNumber(startX)
    : numbersToNumber(startX);
  const endNum = format === 'letters-first'
    ? lettersToNumber(endX)
    : numbersToNumber(endX);
  return Math.abs(startNum - endNum) * tileSize;
}

// DEPRECATED: Legacy functions kept for reference, to be removed in Phase 1b
// These used O(n) iteration which is inefficient for large distances.
// Use calculateRowDistance() instead for O(1) performance.

export function nextChar(c: string): string {
  const u = c.toUpperCase();
  if (allSame(u, 'Z')) {
    return 'A'.repeat(u.length + 1);
  }
  const p = u.slice(0, -1);
  const lastChar = u.slice(-1);
  const next = nextLetter(lastChar.charCodeAt(0));
  if (next === 'A' && p.length > 0) {
    return p.slice(0, -1) + nextLetter(p.slice(-1).charCodeAt(0)) + next;
  }
  return p + next;
}

function nextLetter(l: number): string {
  return l < 90 ? String.fromCharCode(l + 1) : 'A';
}

export function prevChar(c: string): string {
  const u = c.toUpperCase();
  if (allSame(u, 'A')) {
    return 'Z'.repeat(u.length + 1);
  }
  const p = u.slice(0, -1);
  const lastChar = u.slice(-1);
  const prev = prevLetter(lastChar.charCodeAt(0));
  if (prev === 'Z' && p.length > 0) {
    return p.slice(0, -1) + prevLetter(p.slice(-1).charCodeAt(0)) + prev;
  }
  return p + prev;
}

function prevLetter(l: number): string {
  return l > 65 ? String.fromCharCode(l - 1) : 'Z';
}

export function allSame(str: string, char: string): boolean {
  return str.split('').every((c) => c === char);
}

/**
 * DEPRECATED: Legacy azRun function using O(n) iteration.
 * Use calculateRowDistance() instead for O(1) performance.
 */
export function azRun(start: string, end: string, tileSize: number): number {
  let tempLen = 0;
  let current = start.toUpperCase();
  const target = end.toUpperCase();
  while (current !== target) {
    if (current < target) {
      current = nextChar(current);
      tempLen += tileSize;
    } else {
      current = prevChar(current);
      tempLen += tileSize;
    }
  }
  return tempLen;
}
