
## 2026-04-20 - Optimize chat timeline re-renders and A2UI memoization
**Learning:** Frequent periodic state updates (e.g., 5s timer) in large container components like the chat page cause expensive cascading re-renders. Replacing them with targeted effects and precise timers significantly reduces CPU overhead. Memoizing components that perform expensive tasks like HTML sanitization (A2UI) is crucial for responsiveness.
**Action:** Always prefer effect-driven state changes over periodic polling for UI status (like "stuck" detectors). Use `React.memo` for components that process complex data or strings.
