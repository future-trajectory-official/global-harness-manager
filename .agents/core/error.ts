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
    return new Error(typeof e === "string" ? e : JSON.stringify(e));
  },

  /**
   * エラーをログに出力し、必要に応じて詳細情報を表示します。
   */
  log: (e: unknown, context?: string) => {
    const error = errorUtil.toError(e);
    const message = context ? `[${context}] ${error.message}` : error.message;
    logger.error(message);
    if (error.stack) {
      // スタックトレースはデバッグ用に詳細ログとして出力（logger.debug があればそれを使うが、現状は error でも可）
      // ここでは logger.error の後にスタックを表示する
      console.error(error.stack);
    }
  },

  /**
   * 致命的なエラーとしてログ出力し、プロセスを終了させます。
   */
  fatal: (e: unknown, context?: string): never => {
    errorUtil.log(e, context);
    Deno.exit(1);
  }
};
