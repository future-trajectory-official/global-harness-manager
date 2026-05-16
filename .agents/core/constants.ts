import { dirname, fromFileUrl, join } from "@std/path";

/**
 * プロジェクトルートの絶対パスを取得する
 * 実行中のスクリプト（このファイル）の位置から 2 階層上
 */
const __dirname = dirname(fromFileUrl(import.meta.url));
export const PROJECT_ROOT = join(__dirname, "..", "..");

/**
 * プロジェクト全体のパス定数
 */
export const PATHS = {
  SKILLS_ROOT: ".agents/skills/bundles",
  BUNDLES: {
    ONBOARDING: "onboarding-bundle",
    GIT: "git-bundle",
    META: "meta-bundle",
    SYSTEM: "system-bundle",
    DEVELOPMENT: "development-bundle",
    MANAGEMENT: "management-bundle",
  },
  MANAGEMENT: ".agents/management",
  SCRIPTS: "scripts",
} as const;

/**
 * PATHS.BUNDLES の値（パス文字列）を表す型エイリアス
 */
export type BundlePathValue = typeof PATHS.BUNDLES[keyof typeof PATHS.BUNDLES];

/**
 * スキルのディレクトリパスを取得するヘルパー
 */
export function getSkillDirPath(
  bundle: BundlePathValue,
  skillName: string,
): string {
  return join(PROJECT_ROOT, PATHS.SKILLS_ROOT, bundle, skillName);
}

/**
 * スキル内のスクリプトの絶対パスを取得するヘルパー
 */
export function getSkillScriptPath(
  bundle: BundlePathValue,
  skillName: string,
  scriptName: string,
): string {
  return join(getSkillDirPath(bundle, skillName), PATHS.SCRIPTS, scriptName);
}

/**
 * スキル内のアセットパスを取得するヘルパー
 */
export function getSkillAssetPath(
  bundle: BundlePathValue,
  skillName: string,
  assetName?: string,
): string {
  const base = join(getSkillDirPath(bundle, skillName), "assets");
  return assetName ? join(base, assetName) : base;
}

/**
 * 管理用テンプレートディレクトリの絶対パスを取得する
 */
export function getManagementPath(fileName?: string): string {
  const base = join(PROJECT_ROOT, PATHS.MANAGEMENT);
  return fileName ? join(base, fileName) : base;
}
