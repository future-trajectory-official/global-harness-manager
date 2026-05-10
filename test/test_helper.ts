import { PATHS as CORE_PATHS, getSkillDirPath as getCoreSkillDirPath, getSkillScriptPath as getCoreSkillScriptPath } from "../core/harness-core.ts";

/**
 * テスト共通のパス定数 (harness-core.ts から再エクスポート)
 */
export const PATHS = CORE_PATHS;

/**
 * スキル内のスクリプトパスを取得するヘルパー
 */
export const getSkillScriptPath = getCoreSkillScriptPath;

/**
 * スキルのディレクトリパスを取得するヘルパー
 */
export const getSkillDirPath = getCoreSkillDirPath;
