import {
  getSkillDirPath as getCoreSkillDirPath,
  getSkillScriptPath as getCoreSkillScriptPath,
  PATHS as CORE_PATHS,
} from "../.agents/core/shared/types/constants.ts";

/**
 * テスト共通のパス定数
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
