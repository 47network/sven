## 2025-05-15 - Accessibility for Async Actions and Icon Buttons
**Learning:** Icon-only buttons without ARIA labels are invisible to screen readers, and async actions without loading indicators (like Spinners) lead to user confusion and duplicate submissions.
**Action:** Always add `aria-label` to buttons using only Lucide/Icon components. Implement conditional `Spinner` rendering based on mutation `isPending` state for all chat-related actions.
