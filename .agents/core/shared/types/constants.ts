import { dirname, fromFileUrl, join } from "@std/path";

/**
 * ワークスペースのプロジェクトルートを動的に特定する
 */
export function findProjectRoot(
  options: {
    envGetter: (key: string) => string | undefined;
    cwdGetter: () => string;
    statSync: (path: string) => { isDirectory: boolean };
    importMetaUrl: string;
  } = {
    envGetter: (key: string) => Deno.env.get(key),
    cwdGetter: () => Deno.cwd(),
    statSync: (path: string) => Deno.statSync(path),
    importMetaUrl: import.meta.url,
  },
): string {
  // 1. 環境変数 HARNESS_WORKSPACE_ROOT から優先取得
  const envRoot = options.envGetter("HARNESS_WORKSPACE_ROOT");
  if (envRoot) {
    return envRoot;
  }

  // 2. カレントディレクトリ直下に .agents ディレクトリがあるか確認
  try {
    const cwd = options.cwdGetter();
    const hasAgents = options.statSync(join(cwd, ".agents")).isDirectory;
    if (hasAgents) {
      return cwd;
    }
  } catch (_e) {
    // NotFound の場合などは無視して次に進む
  }

  // 3. フォールバック: スクリプト自体の位置から 4 階層上（.agents/core/shared/types/ → プロジェクトルート）
  const __dirname = dirname(fromFileUrl(options.importMetaUrl));
  return join(__dirname, "..", "..", "..", "..");
}

export const PROJECT_ROOT = findProjectRoot();

/**
 * プロジェクト全体のパス定数
 */
export const PATHS = {
  SKILLS_ROOT: ".agents/skills/bundles",
  BUNDLES: {
    ONBOARDING: "workspace-bundle",
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
