/**
 * Global Harness Core Utilities (Facade)
 *
 * このファイルは .agents/core/ 配下の各ユーティリティを一本化して提供します。
 * スキルやスクリプトからはこのファイルをインポートすることで、
 * 内部ディレクトリ構造の変更を意識せずに機能を利用できます。
 */

// 定数とパス解決
export * from "./shared/types/constants.ts";

// ファイルシステム操作 (fsUtil, pathUtil)
export * from "./shared/io/fs.ts";

// コマンド実行 (executeCommand)
export * from "./shared/io/command.ts";

// ロガー (logger)
export * from "./shared/io/logger.ts";

// Markdown 操作 (mdUtil)
export * from "./shared/parse/markdown.ts";

// エラーハンドリング (errorUtil)
export * from "./shared/types/error.ts";

// フェーズゲート (phaseGate, extractLinksFromSkillMd, resolveReferencePath, checkReadStatus)
export * from "./shared/workflow/phase-gate.ts";

// ターゲット検証 (verifyTarget)
export * from "./shared/validate/verify-target.ts";

// .harnessrc 設定バリデーション (validateHarnessConfig, ValidationResult, ValidationError)
export * from "./shared/validate/validate-harnessrc.ts";

// スキーマバリデーション (validateInput)
export * from "./shared/parse/schema.ts";

/**
 * 共通型定義の再エクスポート (必要に応じて追加)
 */
// export type { ... } from "./types.ts";
