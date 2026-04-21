## 2026-04-21 - Optimize O(N^2) Array Searches in React Render Loops
**Learning:** When rendering lists of objects (like graph edges) that require joining against another list (like graph nodes) via `.find()`, the time complexity degrades to O(N * M) per render cycle, which can severely block the main thread for large datasets.
**Action:** Pre-compute a memoized lookup `Map` using `useMemo` and map the array once. Then use `.get()` inside the render loop to bring the complexity down to O(N + M).
