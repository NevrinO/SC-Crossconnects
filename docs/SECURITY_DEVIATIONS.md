# Architectural Deviations & Deliberate Decisions

This file documents deliberate architectural decisions that intentionally deviate from standard patterns or best practices, along with the rationale for each deviation.

## [2025-06-13] - Dijkstra Priority Queue Performance Trade-off

- **Deviation**: Using array-based priority queue with O(n² log n) complexity instead of binary heap with O(n log n) in Dijkstra's algorithm
- **Reason**: Current graph scale (20-30 segments per room, ~50-80 nodes) makes the performance difference negligible (1-5ms vs sub-1ms). The array-based implementation is simpler, more maintainable, and easier to understand.
- **Context**: Room data has 9-20 segments creating small graphs. At 20-30 segments per room, array-based approach performs adequately for real-time user interaction. Performance optimization would only be necessary if scaling to 50+ segments per room or implementing real-time pathfinding during user drag operations.
- **Location**: `calculator/src/lib/pathfinding.ts` lines 49-52

## [2026-06-13] - Type Validation Script Uses String Comparison

- **Deviation**: Type validation script uses string-based comparison instead of AST-based structural comparison (violates lesson 58)
- **Reason**: The type files being compared are simple TypeScript interface definitions with no complex type logic, generics, or conditional types. The current implementation strips comments, imports, exports, and normalizes whitespace before comparison, which is sufficient for detecting semantic changes in this specific use case. Implementing TypeScript compiler API-based comparison would add significant complexity (additional dependencies, build time overhead) without meaningful benefit for these simple type definitions.
- **Context**: The config-tool and calculator share identical type definitions that are manually synchronized. The validation script runs as a pre-build check to catch drift. The types are straightforward interfaces with no advanced TypeScript features that would require AST analysis to detect semantic equivalence.
- **Location**: `config-tool/scripts/validate-types.js` lines 26-44

## [2026-06-15] - Pathfinding Sorts by Turn Count Instead of Pure Distance

- **Deviation**: `findKShortestPaths` sorts results by `(turnCount, totalDistance)` instead of by distance alone, and the `isShortest` flag is set based on this sorted position rather than actual distance
- **Reason**: For cross-connect cable routing, minimizing turns is often more important than minimizing pure distance. Fewer turns reduce cable stress, installation complexity, and potential failure points. The sorting prioritizes paths with fewer turns, using distance as a tiebreaker for paths with equal turn counts.
- **Context**: The function is used in a UI where users select from multiple path options. Presenting turn-minimized paths first improves user experience by showing the most practical routes first. The function name `findKShortestPaths` is a legacy name that doesn't reflect this optimization; the actual behavior is "find k-best paths" where "best" considers both turns and distance.
- **Location**: `calculator/src/lib/pathfinding.ts` lines 814-820
