# Bolt's Journal - Performance Optimizations

## 2025-05-15 - [React Rendering Optimization in Chat UI]
**Learning:** In a chat timeline with frequent state updates (e.g., a clock or "now" tick for relative timestamps), every message bubble re-renders every 5 seconds unless memoized. Wrapping message bubbles and their expensive sub-components (like Markdown parsers) in `React.memo` significantly reduces CPU usage during idle time and message streaming.
**Action:** Always ensure handlers passed to long lists are wrapped in `useCallback` to prevent breaking `React.memo` on child items.
