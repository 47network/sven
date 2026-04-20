## 2026-04-20 - CoordinatorSession Arrays Performance
**Learning:** O(N²) array loops formed by continuously chaining `Array.from(map.values()).filter` inside while loops can severely bottleneck state tracking components with many tasks, like `CoordinatorSession`.
**Action:** Use an O(1) integer cache (`runningCount`) dynamically updated upon state transitions, and a `for..of` iterator with `break` directly on the Set/Map for operations like `find()`.
