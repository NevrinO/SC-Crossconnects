# Architectural Deviations & Deliberate Decisions

This file documents deliberate architectural decisions that intentionally deviate from standard patterns or best practices, along with the rationale for each deviation.

## [2025-06-13] - Dijkstra Priority Queue Performance Trade-off

- **Deviation**: Using array-based priority queue with O(n² log n) complexity instead of binary heap with O(n log n) in Dijkstra's algorithm
- **Reason**: Current graph scale (20-30 segments per room, ~50-80 nodes) makes the performance difference negligible (1-5ms vs sub-1ms). The array-based implementation is simpler, more maintainable, and easier to understand.
- **Context**: Room data has 9-20 segments creating small graphs. At 20-30 segments per room, array-based approach performs adequately for real-time user interaction. Performance optimization would only be necessary if scaling to 50+ segments per room or implementing real-time pathfinding during user drag operations.
- **Location**: `calculator/src/lib/pathfinding.ts` lines 49-52
