/**
 * プロジェクト全体で使用される定型メッセージを一元管理します。
 */
export const MESSAGES = {
  METRICS: {
    SUCCESS: "✅ Metrics recorded successfully.",
    NO_DATA: "No metrics recorded yet.",
    ERROR_PREFIX: "❌ Error: ",
    MISSING_FIELD: (field: string) => `Missing required field: ${field}`,
    INVALID_RANGE: (field: string, val: string) =>
      `Field ${field} must be a number between 1 and 5 (received: ${val})`,
  },
  SETUP: {
    GIT_DIR_NOT_FOUND: (path: string) => `Git directory not found at ${path}`,
    HOOK_CONFIGURED: (path: string) => `pre-push hook configured at ${path}`,
    HOOK_FAILED: (msg: string) => `Failed to configure git hook: ${msg}`,
  },
} as const;
