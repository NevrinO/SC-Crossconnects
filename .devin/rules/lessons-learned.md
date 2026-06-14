---
trigger: always_on
---

# Project Lessons Learned & Guardrails

This file contains generalized architectural guardrails derived from past agent mistakes. The Coding Agent must strictly adhere to these rules.

**File Maintenance Rule**: When adding new lessons to this file, always append them at the end. Do not insert lessons in the middle, as this requires renumbering all subsequent rules. The rules do not need to be in any particular order - they are a collection of guardrails that should be applied regardless of position.

### 1. Object & Array Comparisons
- **Rule**: Do not rely on naive `json.dumps()` or `str()` comparisons for arbitrary arrays or objects.
- **Guardrail**: Account for non-serializable types (datetimes, sets), circular references, and key sorting. Use try/except fallbacks or deep-comparison helper functions to avoid runtime crashes.

### 2. Size Limits for DoS Prevention
- **Rule**: Always enforce size limits on user input, collections, and API responses.
- **Guardrail**: For any endpoint accepting arrays (e.g., job_ids, filters), enforce a reasonable maximum size (e.g., 100 items) to prevent memory exhaustion and long-running queries. For bulk operations, enforce limits on total collection size (e.g., 100 items total). For API responses that return collections, enforce reasonable maximum sizes (e.g., 1000 items) to prevent memory exhaustion, long response times, or network bandwidth exhaustion. Return a 400 error or truncate with pagination if limits would be exceeded. Also enforce size limits before parsing JSON from untrusted sources (e.g., 64KB maximum).

### 3. Recursive Processing & Circular References
- **Rule**: When implementing recursive traversal of data structures (lists, dicts, trees), always add cycle detection.
- **Guardrail**: Use a `visited` set or similar mechanism to track processed objects and prevent infinite recursion on circular references. Failing to do so will cause `RecursionError` at runtime when encountering self-referential structures (e.g., `a = []; a.append(a)` or `d = {}; d['self'] = d`).

### 4. Strict Full-String Anchors in Validation Regexes
- **Rule**: For input-validation/whitelist regexes, never anchor with `$` when you mean strict end-of-string.
- **Guardrail**: In JavaScript, `$` also matches just before a trailing `\n`, so a value like `/dev/sda\n` passes a `^...$` whitelist. Use `\Z` for a strict end anchor (or `String.prototype.match` with full string patterns), and explicitly reject `\n`/`\r` for path-like inputs. This applies to identifiers and any security-sensitive whitelist. Note that different regex engines support different anchors, so verify anchors are supported by the target language.

### 5. Preserve API Contracts When Centralizing / Refactoring
- **Rule**: When replacing a function body with a delegated/centralized implementation, the new behavior must honor the original signature and documented contract.
- **Guardrail**: If a wrapper advertises parameters (e.g., `fallbacks`, `env_var`) they must still take effect, or the parameters should be removed. Preserve the original error contract: if callers expect `null` for "not found", do not regress to raising an uncaught exception (e.g., `undefined` from an unguarded object lookup). Guard centralized lookups against unknown keys.

### 6. Caching Effectiveness Across Import Styles
- **Rule**: A lazy/TTL cache is defeated when consumers bind its result once via `import { VALUE } from module`.
- **Guardrail**: If a value is meant to be re-resolved over time (TTL, hot-reload), expose it through a function call (`getX()`) and require call sites to invoke it at use time. Snapshotting via module-level imports freezes the value at import and silently bypasses the cache's refresh semantics, producing inconsistent behavior across modules.

### 7. Import Verification
- **Rule**: Never add code that uses modules without verifying the imports exist, and ensure imports are complete when extracting code.
- **Guardrail**: When adding new functionality that requires standard library or third-party modules, immediately add the corresponding import statement at the top of the file. Run a syntax check or linting tool before committing. When extracting code into new files during refactoring, verify all imports are copied to the new file. Before marking a refactoring task complete, run a syntax check or import verification on all new files. Missing imports cause immediate runtime failures (ReferenceError) that are easily preventable.

### 8. Dependency Version Management for Reproducibility
- **Rule**: Do not change from pinned versions to minimum versions without establishing a dependency update process.
- **Guardrail**: If allowing dependency updates is desired, implement safeguards first:
  - Create a documented dependency update policy (when to update, how to test)
  - Add automated testing against latest dependency versions in CI/CD
  - Consider using dependency management tools (npm, yarn, pnpm with lock files) to separate development constraints from production locks
  - Document specific library features used and their version requirements
  - For production systems, prefer pinned versions unless there is a clear, tested process for handling updates

### 9. Event Listener Management
- **Rule**: Never attach duplicate event listeners to the same DOM element, and avoid registering specific listeners for elements already handled by global handlers.
- **Guardrail**: When refactoring code to use initialization functions, ensure all event listener attachments are consolidated in a single location. Duplicate listeners cause handlers to execute multiple times, leading to unpredictable behavior (e.g., double submissions, concurrent animations). When adding interactive elements (e.g., modal close buttons), check if a global handler already exists for that pattern (e.g., `data-close-modal` attribute). If a global handler handles the element, do not add a specific event listener. Document the dependency on the global handler in a comment if the specific listener is intentionally omitted.

### 10. Root Cause Investigation Over Surface Fixes
- **Rule**: Always investigate the root cause of an issue before implementing fixes or adding debug logging.
- **Guardrail**: When a user reports a problem, trace the data flow from source to display to find where the transformation occurs. Adding logging or surface-level fixes without understanding the underlying issue leads to incomplete solutions and technical debt. Follow the bug fixing discipline: identify root cause before implementing, prefer minimal upstream fixes over downstream workarounds.

### 11. Numbering Scheme Changes
- **Rule**: Numbering scheme changes (e.g., 1-indexed to 0-indexed IDs/display numbers) must be applied to every producer and consumer in the data flow.
- **Guardrail**: When changing identifiers, audit data generation, default values, user input flows, save payloads, sorting/display logic, tests, and documentation before marking the task complete. Partial migrations create off-by-one regressions and inconsistent persisted state.

### 12. Validation Completeness Across Multiple Input Paths
- **Rule**: When data can be provided via multiple mechanisms (e.g., ID lookup vs inline object, reference vs direct value), validation must cover all paths equally.
- **Guardrail**: If a validation function only checks data when provided through one path but the data can also be provided through another path, the validation gap creates a security and consistency vulnerability. Either validate all paths, document the limitation clearly, or reject unsupported paths at the entry point.

### 13. Post-Transformation Contract Validation
- **Rule**: When applying transformations that reduce available data (e.g., filters, exclusions), validate that the result still meets the original contract.
- **Guardrail**: If a function is expected to return N items but a transformation can reduce the count, add post-transformation validation to ensure the result meets minimum requirements. For example, if a count of 8 is requested but filters eliminate 9 items, the function should raise an error rather than silently returning fewer items.

### 14. UI State Priority and Unknown Value Handling
- **Rule**: UI state rendering must prioritize operational states over configuration/metadata states, and unknown values should not be displayed as known defaults.
- **Guardrail**: When rendering UI elements that display system states:
  - Never display unknown/placeholder values as if they were known. Only render badges/labels when the value is explicitly known.
  - Establish a clear state priority hierarchy where critical operational states take precedence over configuration states. Configuration warnings should be additive (e.g., corner badges, border styles) rather than state overrides that hide active operations.
  - When adding conditional state logic, place higher-priority checks last or use explicit priority ordering to prevent lower-priority states from masking critical information.

### 15. Cache Coherence Across Multiple Cached Calls
- **Rule**: When calling multiple cached functions that may return related data, ensure cache consistency to avoid stale/inconsistent responses.
- **Guardrail**: If a response combines data from multiple cached sources, either use a single source of truth, pass cached data between functions, or disable caching for one of the calls to ensure temporal consistency. Never assume separate caches with independent TTLs will remain synchronized during a single request.

### 16. Consistent Error Handling Patterns
- **Rule**: Use consistent error handling patterns for similar operations across the codebase.
- **Guardrail**: When the same operation appears in multiple places, use identical error handling patterns. If one path sets a null/error field and another uses silent pass, consumers cannot distinguish between "no data" and "error occurred". Standardize on either explicit error fields or consistent null patterns to aid debugging. This includes JSON parsing errors—wrap `JSON.parse()` calls in try/catch blocks consistently.

### 17. Validation of Extracted Numeric Values
- **Rule**: Always validate numeric values extracted from strings or unstructured data.
- **Guardrail**: When extracting numbers via regex, parsing, or string manipulation (e.g., slot numbers from slot IDs), validate that the result is within reasonable bounds for the domain. Handle conversion exceptions gracefully and reject values outside expected ranges (e.g., slot numbers should be 0-9999, not arbitrary integers). Unvalidated extracted numbers can cause display issues or logic errors downstream.

### 18. DOM Element Null Check Completeness
- **Rule**: When adding new DOM element references, always include null checks for all new elements.
- **Guardrail**: If a codebase has an existing pattern of checking DOM element existence, any new element references must follow the same pattern. Missing null checks for new elements while checking old ones creates inconsistent error handling and runtime crashes when elements are missing from the DOM. Either check all elements or check none consistently.

### 19. Complete UI Control Implementation
- **Rule**: When adding new UI controls, ensure all corresponding event handlers and state management are implemented.
- **Guardrail**: If a new UI element is added (e.g., a button, input, or toggle), verify that all necessary event listeners are attached and state variables are declared. Missing event handlers or undeclared state variables cause runtime errors. Use a checklist: (1) element reference, (2) event listener, (3) state variable (if needed), (4) validation logic, (5) error handling.

### 20. Verification Before Claiming Completion
- **Rule**: Never claim fixes are complete in CRITIQUE.md resolution logs or document critical findings without verifying the actual code changes.
- **Guardrail**: When writing a resolution log claiming "Added X at line Y" or "Fixed function Z", read the file to verify the change actually exists before writing the log. When acting as the Critic Agent, before writing a finding in CRITIQUE.md, read the specific lines of code referenced in the finding to verify the issue actually exists. False claims of completed fixes waste review time and erode trust. After making edits, always read the affected lines to confirm the changes were applied before updating documentation.

### 21. State Management Lifecycle on Context Changes
- **Rule**: Clear transient UI state when the user context changes (filters, navigation, data refresh).
- **Guardrail**: Selection state, temporary flags, or user-modifiable data that depends on the current view should be cleared when the view changes (e.g., filtering a list, switching tabs, refreshing data). Persisting state across context changes creates confusing UX where selections refer to items no longer visible or relevant. Either clear state on context change or explicitly document that persistence is intentional.

### 22. Async/Await Syntax Requirement in JavaScript
- **Rule**: Never use `await` without declaring the function as `async`.
- **Guardrail**: When adding `await` calls to a function, ensure the function is declared with the `async` keyword. JavaScript will throw a SyntaxError at runtime if `await` is used in a non-async function. This is a fundamental syntax requirement that prevents the code from executing at all.

### 23. Verify Edit Operation Output for Syntax Validity
- **Rule**: Always verify that edit operations produce syntactically valid code, especially when modifying existing functions.
- **Guardrail**: After using the edit tool to modify code, read the modified section to ensure the output is valid syntax. Corrupted edits (e.g., mangled string literals, broken function signatures, incomplete lines) will cause the entire file to fail loading. This is particularly important when editing within existing functions where line boundaries can be ambiguous. If an edit produces invalid syntax, revert and use a more specific old_string with more surrounding context to ensure uniqueness.

### 24. Declare All State Variables at Module Level
- **Rule**: All module-level state variables must be explicitly declared before use, not implicitly created through assignment.
- **Guardrail**: When adding new functionality that requires persistent state, declare these variables at the module level with explicit initialization. Never rely on implicit declaration through assignment in functions, as this creates implicit globals and makes the code fragile to refactoring. Follow the existing pattern in the codebase for consistency.

### 25. Validate Conditional Block Placement
- **Rule**: Ensure initialization code is placed at the correct scope level, not nested inside unrelated conditionals.
- **Guardrail**: When adding initialization code (e.g., resetting state variables), verify it runs in all required code paths. If initialization is placed inside a conditional block, it will not execute when that condition is false. Initialization that should always run must be outside conditionals. Review the control flow to ensure initialization occurs at the appropriate point in the lifecycle.

### 26. Verify Global State Dependencies Before Use
- **Rule**: Before using global state variables in new functions, verify they are properly initialized and populated.
- **Guardrail**: When writing functions that depend on global state, ensure the state is either: (1) passed as a parameter, (2) initialized in a well-defined lifecycle method before the function is called, or (3) documented as a required precondition. Never assume global state exists without verification. If the state has complex initialization requirements, add a comment documenting when and how it is populated.

### 27. Verify Variable References and Scope When Editing Functions
- **Rule**: When adding code blocks to existing functions, verify all referenced variables exist and are in scope.
- **Guardrail**: Before inserting validation, error handling, or logic blocks into an existing function, check that every variable referenced in the new code is either: (1) already declared in the function scope, (2) passed as a parameter, or (3) a global variable that exists in the module. Typos in variable names and scope errors cause runtime failures that are easily preventable by reviewing the function's existing variable declarations before editing.

### 28. Code Extraction Best Practices
- **Rule**: When extracting code into new modules, the original module MUST have the extracted code deleted in the same commit, and all side-effects must be preserved exactly.
- **Remove Original Code**: If you extract code into new files but leave the original code in the source module, the original code may shadow the new code — making the new files dead code that never executes. Before marking an extraction refactor complete: (1) delete the moved code from the source file, (2) remove the now-unused imports from the source file, (3) verify the application starts without errors, (4) confirm at least one extracted function works via its new location. Never ship "both old and new" code simultaneously.
- **Clean Stale Imports**: After extracting code into new modules, audit both source and destination files for stale imports. When deleting functions from a module during extraction, some imports become orphaned. These stale imports waste startup time, obscure the module's actual dependencies, and fail linting. After completing any extraction refactor, run a linting tool or manually grep each import symbol to confirm it is still used in the remaining code.
- **No Initialization Side-Effects**: When splitting a monolithic file into smaller modules, each new file must reproduce only the behavior of its extracted section — never add new auto-initialization or lifecycle hooks that weren't present in the original. Before committing a split: diff the combined new files against the original and flag any top-level statements that are net-new. Every auto-executing line must trace back to equivalent code in the original module.

### 29. Avoid Unnecessary Defensive Programming Patterns
- **Rule**: Prefer simple, declarative solutions over complex defensive patterns when simpler alternatives exist.
- **Guardrail**: When defensive programming patterns are added to handle edge cases, first verify if a simpler solution exists. Complex defensive patterns that duplicate code across multiple locations create maintenance burden and technical debt. Use the simplest solution that actually solves the problem, and document why the defensive pattern is necessary if no simpler alternative exists.

### 30. Explicit Dependencies Between Non-Module Script Files
- **Rule**: When splitting browser-side scripts loaded via `<script>` tags (non-ES-module), cross-file variable references must be documented and centralized.
- **Guardrail**: `const`/`let` declarations at global scope in non-module scripts are shared across files via the global lexical environment, but the dependency is invisible — there is no `import` statement to make it explicit. If File B uses a `const` declared in File A, (a) add a comment in File B noting the dependency, or (b) move the shared declaration into a utilities file that both depend on. This prevents silent breakage when `<script>` tag order is changed. Any shared DOM reference used by multiple split files should live in a single "shared references" file loaded first.

### 31. Collision Probability in Generated Identifiers
- **Rule**: When generating human-readable identifiers with random components, ensure sufficient entropy to prevent collisions.
- **Guardrail**: For identifiers that include random suffixes (e.g., UUID-based friendly IDs), calculate the collision probability based on expected volume. With 4 hex characters (65,536 combinations), collisions become likely if more than ~8,000 items are generated per day (birthday paradox). Use at least 6 hex characters (16,777,216 combinations) for daily-rotated identifiers, or implement collision detection with retry logic. Document the collision probability assumptions in code comments.

### 32. Complete Field Name Refactoring Across All Data Paths
- **Rule**: When renaming fields or identifiers, update all read and write paths consistently in a single operation.
- **Guardrail**: Partial field name refactoring creates mismatches where data is written with the new name but read with the old name (or vice versa). Before marking a refactoring complete, grep the entire codebase for all occurrences of the old field name, including: form submissions, API payloads, state updates, rendering, default value assignments, and HTML form field names. If backward compatibility is needed during migration, add explicit fallback logic (e.g., `data.newField || data.oldField`) and document the transition period. Never ship partial migrations.

### 33. Validation Consistency During Transformations
- **Rule**: When validating input that undergoes transformation (e.g., parsing, conversion, mapping), validate the original input before transformation, not the transformed output. When changing the domain or range of a numbering scheme, update all validation logic to match the new domain.
- **Pre-Transformation Validation**: If validation checks the transformed data instead of the original input, type mismatches can render validation ineffective. For example, validating an array of objects when the input was an array of numbers will fail to catch invalid numeric ranges. Always validate the raw input at the point of entry, then apply transformations. If validation logic must reference transformed data, use distinct variable names to avoid shadowing the original input and causing confusion about which data is being validated.
- **Domain Change Updates**: If a numbering scheme's upper bound changes from value A to value B, every validation that checks against that bound must be updated. Validation gaps create situations where the UI displays values that validation rejects, or vice versa. Audit all validation logic when changing numbering domains, including input validation, range checks, and error messages.

### 34. Guard Against Division by Zero in Mathematical Conversion Functions
- **Rule**: All functions performing division or modulo operations must validate that divisors are non-zero before the operation.
- **Guardrail**: Mathematical conversion functions (e.g., coordinate transformations, index calculations) that accept divisor parameters must include guard clauses to reject zero or negative values. Even if the current caller validates inputs, the function is a reusable utility that may be called from other contexts in the future. Throw a clear error message (e.g., "Columns must be greater than 0") rather than allowing the operation to proceed with Infinity, NaN, or incorrect results.

### 35. Remove Debugging Artifacts Before Committing
- **Rule**: Never commit debugging console.log statements or temporary debug code to production.

### 36. Module-Level Validation Creates Runtime Crash Risk
- **Rule**: Never perform data validation at module level that can throw exceptions before the application can render error handling.
- **Guardrail**: When validating static data (e.g., JSON imports), move validation inside the component initialization or use lazy-loading with try-catch. Module-level validation that throws will crash the entire application before React can render error boundaries or user-friendly messages. Either: (1) move validation inside the component with error state, (2) use React's useEffect/useState for async loading, or (3) add a top-level error boundary to catch module initialization errors.

### 37. Test Validation Must Match Production Validation
- **Rule**: Test validation functions must be at least as strict as production validation functions.
- **Guardrail**: When writing test utilities that validate data structures, ensure they check all required fields that the production validator checks. If the production validator checks multiple fields, the test validator must also check these fields. Using a weaker validator in tests creates a false sense of security—test data could pass validation but crash production. Either import and use the production validator (extract to shared utility) or duplicate all field validations in the test version.

### 38. Cache Failure State Handling
- **Rule**: Never cache failure states (null, error values) in TTL-based caches.
- **Guardrail**: When implementing caching with TTL, only update the cache on successful data acquisition. If an operation fails (network timeout, file I/O error, exception), do not cache the failure state. Caching failures causes the cache to return invalid data for the entire TTL period, even if the underlying issue is transient. The cache contract should be: return valid cached data, or perform a fresh scan on miss. Never cache null or error results. Move cache update logic inside the success path, not in finally blocks or exception handlers.

### 39. Cache Consistency Across Function Calls
- **Rule**: When adding caching to a function, ensure all call sites use the caching consistently.
- **Guardrail**: If a function is modified to support caching via a `useCache` parameter, all existing call sites must be updated to pass `useCache=true` (or the appropriate default). Leaving call sites that bypass the cache defeats the purpose of the optimization and creates hot paths that still perform expensive operations. Audit all call sites when adding caching to ensure consistent usage.

### 40. User Feedback for Data Reduction During Transformations
- **Rule**: When transformations reduce available data (e.g., filtering, skipping invalid items), always provide explicit user feedback about what was excluded.
- **Guardrail**: If a transformation skips items (e.g., data mismatches, validation failures), track and report the count and reason for skipped items to the user. Silent data reduction creates confusing UX where users don't understand why expected items are missing from results. Always provide visible feedback (e.g., "Warning: 3 item(s) skipped due to validation errors") rather than silently proceeding with reduced data.

### 41. Avoid Code Duplication - DRY Principle
- **Rule**: Never copy-paste identical logic blocks across multiple functions.
- **Guardrail**: When the same logic appears in multiple functions, extract it into a shared helper function. Code duplication creates maintenance burden where bug fixes must be applied in multiple locations. Before adding new code, check if similar logic already exists and can be reused or refactored into a common utility. This is especially important for complex logic with multiple edge cases or validation steps.

### 42. CSS Class Consistency for UI Element Visibility
- **Rule**: When implementing UI element visibility control, use the CSS class pattern established for that element type in the codebase.
- **Guardrail**: Different UI elements use different visibility patterns (e.g., modals use `.open` class with `.modal { display: none; }` and `.modal.open { display: block; }`, while footers/overlays use `.hidden` class). Before adding visibility control to an element, verify the CSS class definitions in the stylesheet. Mixing visibility patterns causes the element to not display correctly. Always grep the CSS file to confirm the correct class names and their semantics before using them.

### 43. HTML Form Constraints Must Match JavaScript Validation
- **Rule**: HTML form validation attributes (min, max, pattern) must match JavaScript validation logic to provide consistent user feedback.
- **Guardrail**: When adding client-side validation, ensure HTML form attributes and JavaScript validation use the same rules. If JavaScript validates a number must be between 1 and 100, the HTML input should have min="1" and max="100". Mismatched validation causes confusing UX where the browser allows values that JavaScript rejects, or vice versa.

### 44. UI Preview Consistency with Configuration
- **Rule**: UI previews must accurately reflect the actual configuration and behavior that will be used at runtime, or clearly indicate when using a simplified representation.
- **Guardrail**: When implementing preview components (e.g., configuration visualizations), the preview should generally respect all relevant configuration parameters and match the logic exactly. However, simplified representations are acceptable if:
  - The distinction is clearly documented or indicated to users
  - The operational behavior respects the actual configuration
  - The simplified representation serves a clear UX purpose
  Hardcoding preview behavior to a fixed order without clear indication creates misleading UX. When using simplified representations, add visual indicators or documentation to clarify the difference between reference displays and operational behavior.

### 45. Complete UI Option Distribution Across All Relevant Controls
- **Rule**: When adding new options to dropdowns or selects, the option must be added to all UI locations where that choice is relevant.
- **Guardrail**: If a new configuration option is added to one part of the UI (e.g., creation form), it must also be added to all other UI controls that reference the same concept (e.g., application dialog). Partial implementation creates confusing UX where users can create resources with certain options but cannot apply or use them elsewhere. Audit the entire codebase for all references to the option type before marking the feature complete.

### 46. Apply Lessons to Code Changes in the Same Commit
- **Rule**: When adding a new lesson to lessons-learned.md, verify that the concurrent code changes do not violate that lesson.
- **Guardrail**: If a code change introduces a pattern that a new lesson is meant to prevent, the code must be fixed to comply with the lesson before the commit is complete. Adding a lesson that describes a bug without fixing the bug creates technical debt and confusion. When adding guardrails, audit the concurrent changes for violations and fix them in the same operation.

### 47. Function Contract Preservation During Modifications
- **Rule**: When modifying a function to support new use cases, preserve the original contract for all existing callers or update all call sites consistently.
- **Guardrail**: If a function modification changes the semantics (e.g., deriving dimensions from partial inputs instead of accepting full dimensions as parameters), this breaks the contract for existing callers. Either: (1) make the change backward-compatible by adding optional parameters with sensible defaults, (2) create a new function with a different name for the new use case, or (3) update all call sites to pass the required data. Never infer critical data from partial inputs when the full data is available from the caller—this creates fragile functions that fail with edge cases. When adding optional parameters to existing functions, ensure all call sites that rely on the old behavior are updated or the default preserves the old semantics.

### 48. DOM State Detection Should Use Data Attributes, Not Visual Content
- **Rule**: When detecting DOM element state (e.g., selected items, disabled elements), use data attributes rather than inspecting visual content or text.
- **Guardrail**: Checking `textContent`, `innerHTML`, or visual markers couples state detection to the visual representation, making code fragile to UI changes. Instead, set `data-*` attributes during rendering (e.g., `data-selected="true"`) and check these attributes in event handlers and utility functions. This decouples state logic from presentation and allows UI changes without breaking behavior.

### 49. Validate Composite Format Strings with Proper Regex Patterns
- **Rule**: When validating strings that contain multiple concatenated components, use strict regex patterns that validate the entire structure, not just prefix checks.
- **Guardrail**: Checking only that a string starts with a prefix is insufficient for security and correctness. Use full regex patterns that validate each component in the correct format and position. For composite formats, the regex should match the entire string structure with proper anchors. This prevents malformed or malicious strings from passing validation.

### 50. Standardize Return Structures Across Function Families
- **Rule**: Functions that perform similar operations (e.g., mapping functions, validation functions) must return consistent data structures with the same field names and types.
- **Guardrail**: When multiple functions in the same family return different structures, API consumers cannot handle the results uniformly. This creates fragile code that breaks when the fallback path is taken. Define a standard return structure for the function family and ensure all functions conform to it, including all relevant fields with appropriate defaults (e.g., `mismatchCount: 0` if not applicable).

### 51. CSS Class Migration Requires Cross-File Usage Verification
- **Rule**: When consolidating or removing CSS classes, verify all usages across the entire codebase before deletion.
- **Guardrail**: CSS class consolidation must include a comprehensive search for all usages of the old classes across all JavaScript, TypeScript, and HTML files. Removing a CSS class without updating all consumers causes functional regressions where UI elements lose their styling. Use grep to find all occurrences of the old class names before removing them from the CSS file. Either update all consumers to use the new classes, or keep the old classes as backward-compatible aliases.

### 52. Algorithm Implementation Must Match Standard Specifications
- **Rule**: When implementing well-known algorithms (e.g., Dijkstra, Yen's, A*), verify the implementation against the standard algorithm specification before use.
- **Guardrail**: Do not invent algorithm logic or add "optimizations" that deviate from the standard specification without thorough testing and documentation. Incorrect algorithm implementations produce subtle bugs that are difficult to detect and debug. Before committing an algorithm implementation, either: (1) reference a standard textbook or academic paper, (2) compare against a reference implementation, or (3) add comprehensive tests that verify the algorithm's invariants (e.g., path optimality, correctness guarantees). Adding logic like "remove all edges in root path to prevent backtracking" to Yen's algorithm is incorrect and breaks the algorithm's correctness.

### 53. Null Safety After Filtering Requires Explicit Checks
- **Rule**: Never assume filtered data is non-null without explicit runtime checks, even if the filter logic appears sound.
- **Guardrail**: When filtering a collection and then accessing properties of filtered items, add explicit null/undefined checks before using those properties. The filter logic may change, the data structure may evolve, or concurrent modifications may introduce nulls. Use null coalescing (`??`) or explicit if-checks to handle the null case gracefully. This is especially critical for TypeScript non-null assertions (`!`) - never use `!` on data that has been filtered without a second explicit check at the point of use.

### 54. Mutable State in Algorithm Implementations Must Be Documented or Eliminated
- **Rule**: When implementing algorithms that mutate state (e.g., graph algorithms with edge removal), either make the state immutable or clearly document reuse constraints.
- **Guardrail**: If an algorithm function mutates its input data structure, either: (1) implement immutable operations (create new instances instead of mutating), (2) add a deep copy method and use it to isolate mutations, or (3) add clear JSDoc warnings that instances must not be reused after calling the function. Mutable state in reusable algorithms creates subtle bugs when instances are reused or when concurrent access occurs. The current usage pattern (creating new instances each time) may change in the future, leading to bugs.

### 55. Avoid Homonymous Functions Across Modules
- **Rule**: Do not export functions with the same name from different modules unless they implement the exact same contract.
- **Guardrail**: When a new function is needed that conceptually overlaps with an existing exported function in another module, choose a distinct name that reflects its specific purpose (e.g., `calculateShortestPath` vs `findShortestPath`). Homonymous functions with different signatures force developers to rely on import paths to disambiguate, which is error-prone during refactoring and increases onboarding friction. Before creating a new function, grep the codebase for existing exports with the same name.

### 56. Do Not Persist Placeholder Data
- **Rule**: When storing data for later retrieval or validation, never persist hardcoded placeholder or default values that misrepresent the actual state.
- **Guardrail**: If a schema includes fields for debug information, telemetry, or audit data, either populate them from real values at the time of computation, or omit the fields from the persisted schema entirely. Persisting zeros, empty strings, or fabricated timestamps creates a false sense of data integrity and renders downstream validation meaningless. If the data is not yet available, defer persistence until it is, or use a schema that does not require the unavailable fields.

### 57. User-Facing Imports Must Surface Errors Explicitly
- **Rule**: When parsing user-uploaded files (CSV, JSON, etc.), every row or record that cannot be processed must be reported to the user with a clear reason, not silently discarded.
- **Guardrail**: Silent skipping of invalid rows during bulk import is a form of data loss that frustrates users and erodes trust. Design import pipelines to return structured error information (e.g., row number, field, failure reason) alongside successfully processed items. The UI should display a summary like "450 imported, 3 errors" with a downloadable error report. Never use `continue` or silent filtering as the primary error-handling strategy for user-provided data.
