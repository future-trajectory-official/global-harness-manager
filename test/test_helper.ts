import {
  getSkillDirPath as getCoreSkillDirPath,
  getSkillScriptPath as getCoreSkillScriptPath,
  PATHS as CORE_PATHS,
} from "../core/harness-core.ts";

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
