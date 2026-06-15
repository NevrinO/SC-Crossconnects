/**
 * Deep comparison utility for objects and arrays.
 * Handles nested objects, arrays, and primitive types.
 * Returns true if values are deeply equal, false otherwise.
 */
export function deepEqual(a: any, b: any, visited = new WeakMap<object, object>()): boolean {
  // Fast path for primitive types and same reference
  if (a === b) return true

  // Handle null/undefined
  if (a == null || b == null) return a === b

  // Handle different types
  if (typeof a !== typeof b) return false

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], visited)) return false
    }
    return true
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    // Cycle detection (Lesson 3)
    if (visited.has(a) && visited.get(a) === b) return true
    visited.set(a, b)

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!keysB.includes(key)) return false
      if (!deepEqual(a[key], b[key], visited)) return false
    }

    return true
  }

  // Handle primitives (number, string, boolean, etc.)
  return false
}
