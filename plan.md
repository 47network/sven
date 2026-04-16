1.  **Refactor `handleChat` Function**:
    The `handleChat` function in `apps/sven-copilot-extension/src/extension.ts` is over 150 lines long. It handles multiple steps: building history, streaming from "Sven's brain", and doing code-aware analysis using Copilot. I will extract these steps into separate helper functions to improve readability and maintainability.
    *   Extract `buildConversationHistory` to convert `vscode.ChatContext` into the required `history` array.
    *   Extract `streamSvenBrain` to handle the streaming from `api.chatStream` and returning the result.
    *   Extract `performCopilotCodeAnalysis` to handle the Copilot code analysis step (Step 3).
2.  **Update `handleChat`**:
    *   Call the new helper functions from within `handleChat`.
3.  **Ensure Pre-commit Checks Pass**:
    *   Run linting, build, and any available verification steps to confirm no functionality is broken.
4.  **Submit Changes**:
    *   Create a pull request with the refactored code.
