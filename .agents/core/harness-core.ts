/**
 * Global Harness Core Utilities (Facade)
 *
 * このファイルは .agents/core/ 配下の各ユーティリティを一本化して提供します。
 * スキルやスクリプトからはこのファイルをインポートすることで、
 * 内部ディレクトリ構造の変更を意識せずに機能を利用できます。
 */

// 定数とパス解決
export * from "./constants.ts";

// ファイルシステム操作 (fsUtil, pathUtil)
export * from "./fs.ts";

// コマンド実行 (executeCommand)
export * from "./command.ts";

// ロガー (logger)
export * from "./logger.ts";

// Markdown 操作 (mdUtil)
export * from "./markdown.ts";

// エラーハンドリング (errorUtil)
export * from "./error.ts";

// バックログスキーマ解決 (loadBacklogSchema, extractPbiBlock, buildArchiveCard, updateContents)
export * from "./backlog-schema.ts";

// フェーズゲート (phaseGate, extractLinksFromSkillMd, resolveReferencePath, checkReadStatus)
export * from "./phase-gate.ts";

// ターゲット検証 (verifyTarget)
export * from "./verify-target.ts";

/**
 * 共通型定義の再エクスポート (必要に応じて追加)
 */
// export type { ... } from "./types.ts";
