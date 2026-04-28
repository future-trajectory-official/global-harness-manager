import { logger } from "./logger.ts";

/**
 * Error utility for consistent error handling and logging.
 */
export const errorUtil = {
  /**
   * unknown 型のエラーを安全にエラーオブジェクトまたはメッセージとして扱います。
   */
  toError: (e: unknown): Error => {
    if (e instanceof Error) return e;
    if (typeof e === "string") return new Error(e);
    return new Error(e === undefined ? "undefined" : JSON.stringify(e));
  },

  /**
   * エラーをログに出力し、必要に応じて詳細情報を表示します。
   */
  log: (e: unknown, context?: string) => {
    const error = errorUtil.toError(e);
    const prefix = context ? `[${context}] ` : "";
    logger.error(`${prefix}${error.message}`);
    if (error.stack) console.error(error.stack);
  },

  /**
   * 致命的なエラーとしてログ出力し、プロセスを終了させます。
   */
  fatal: (e: unknown, context?: string): never => {
    errorUtil.log(e, context);
    Deno.exit(1);
  },
};
