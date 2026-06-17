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

## [2026-06-17] - Client-Side Password Gate with Hardcoded Fallback

- **Deviation**: `SimplePasswordGate` uses a hardcoded SHA-256 hash as a fallback when `VITE_CALCULATOR_PASSWORD_HASH` environment variable is not set
- **Reason**: The password gate is intended to prevent casual sniffing only, not to provide robust security. The protected section does not contain sensitive information. Real protection is provided via the `VITE_CALCULATOR_PASSWORD_HASH` environment variable in production. The hardcoded fallback allows the application to function in development without environment variable configuration.
- **Context**: This is a deliberate trade-off between security and developer convenience. The hash is exposed in client-side JavaScript, making it theoretically brute-forceable, but the risk is accepted given the non-sensitive nature of the protected content and the availability of environment variable-based protection in production.
- **Location**: `calculator/src/components/SimplePasswordGate.tsx` line 7

## [2026-06-17] - Config Tool Auth Delegated to Cloudflare

- **Deviation**: The config tool route (`/config/*`) is not protected by the client-side password gate that protects the calculator
- **Reason**: Authentication for the config tool is delegated to Cloudflare's infrastructure-level authentication, not client-side JavaScript. This is an architectural decision to rely on Cloudflare's more robust auth mechanisms rather than implementing client-side auth for the config tool.
- **Context**: The config tool allows editing room configurations and path segments. Rather than implementing a separate client-side auth mechanism, the decision was made to protect this route at the infrastructure level via Cloudflare. This provides better security and simplifies the client-side code.
- **Location**: `calculator/src/main.tsx` line 20

## [2026-06-17] - Vite Dev Server fs.strict: false

- **Deviation**: Vite config sets `server.fs.strict: false` to allow serving files from outside the project root
- **Reason**: This setting is only used in the development environment to allow the Vite dev server to access files outside the project root (e.g., shared config files). Production builds use `vite build` which generates static files; the server configuration is not used in production.
- **Context**: This is a dev-only convenience setting. The risk is limited to the developer's local machine during development. Production deployments use static file generation, so this setting has no effect in production environments.
- **Location**: `calculator/vite.config.js` lines 12-15
