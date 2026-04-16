## 2025-05-14 - [Enhanced Feedback & Accessibility in Composer]
**Learning:** Icon-only buttons (like "Send" or "Clear") lack context for screen readers and don't provide sufficient feedback during async operations. Dynamic `aria-label` updates alongside visual spinners ensure that all users, including those using assistive technology, understand the system state.
**Action:** Always pair `loading` states with updated `aria-label` or `aria-live` regions, and ensure every icon button has a descriptive `aria-label`.
