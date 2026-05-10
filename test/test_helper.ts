import { join } from "@std/path";

/**
 * テスト共通のパス定数
 */
export const PATHS = {
  SKILLS_ROOT: ".agents/skills/bundles",
  BUNDLES: {
    ONBOARDING: "onboarding-bundle",
    GIT: "git-bundle",
    META: "meta-bundle",
    SYSTEM: "system-bundle",
    DEVELOPMENT: "development-bundle",
  },
} as const;

/**
 * スキル内のスクリプトパスを取得するヘルパー
 */
export function getSkillScriptPath(bundle: string, skill: string, scriptName: string): string {
  return join(PATHS.SKILLS_ROOT, bundle, skill, "scripts", scriptName);
}

/**
 * スキルのディレクトリパスを取得するヘルパー
 */
export function getSkillDirPath(bundle: string, skill: string): string {
  return join(PATHS.SKILLS_ROOT, bundle, skill);
}
