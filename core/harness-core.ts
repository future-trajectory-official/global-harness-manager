import { dirname, fromFileUrl, join } from "@std/path";

/**
 * プロジェクトルートの絶対パスを取得する
 */
const __dirname = dirname(fromFileUrl(import.meta.url));
export const PROJECT_ROOT = join(__dirname, "..");

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
 * スキルのディレクトリパスを取得するヘルパー
 * プロジェクトルートからの相対パスを返します
 */
export function getSkillDirPath(
  bundle: keyof typeof PATHS.BUNDLES | string,
  skillName: string,
): string {
  // キーが渡された場合はその値を使い、そうでない場合は文字列をそのまま使う
  const bundleDir = (PATHS.BUNDLES as Record<string, string>)[bundle] || bundle;
  return join(PATHS.SKILLS_ROOT, bundleDir, skillName);
}

/**
 * スキル内のスクリプトの絶対パスを取得するヘルパー
 */
export function getSkillScriptPath(
  bundle: keyof typeof PATHS.BUNDLES | string,
  skillName: string,
  scriptName: string,
): string {
  return join(getSkillDirPath(bundle, skillName), PATHS.SCRIPTS, scriptName);
}

/**
 * スキル内のアセットパスを取得するヘルパー
 */
export function getSkillAssetPath(
  bundle: keyof typeof PATHS.BUNDLES | string,
  skillName: string,
  assetName?: string,
): string {
  const base = join(getSkillDirPath(bundle, skillName), "assets");
  return assetName ? join(base, assetName) : base;
}

/**
 * 管理用テンプレートディレクトリの相対パスを取得する
 */
export function getManagementPath(fileName?: string): string {
  const base = PATHS.MANAGEMENT;
  return fileName ? join(base, fileName) : base;
}

/**
 * 簡易ロガー
 */
export const logger = {
  info: (msg: string) => console.log(`[%cINFO%c] ${msg}`, "color: green", ""),
  warn: (msg: string) => console.warn(`[%cWARN%c] ${msg}`, "color: yellow", ""),
  error: (msg: string) => console.error(`[%cERROR%c] ${msg}`, "color: red", ""),
};

/**
 * ファイルシステムユーティリティ
 */
export const fsUtil = {
  exists: async (path: string): Promise<boolean> => {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  },
  readTextFile: Deno.readTextFile,
  writeTextFile: Deno.writeTextFile,
  remove: Deno.remove,
  mkdir: Deno.mkdir,
  move: async (src: string, dest: string) => {
    await Deno.rename(src, dest);
  },
  downloadFile: async (url: string, dest: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}`);
    const data = await response.arrayBuffer();
    await Deno.writeFile(dest, new Uint8Array(data));
  },
  extract: async (
    file: string,
    dest: string,
    options?: { stripComponents?: number },
  ) => {
    // 簡易実装（tar/zip は外部コマンドに委譲）
    const isZip = file.endsWith(".zip");
    const cmd = isZip ? "unzip" : "tar";
    const args = isZip ? [file, "-d", dest] : ["-xzf", file, "-C", dest];
    if (!isZip && options?.stripComponents) {
      args.push(`--strip-components=${options.stripComponents}`);
    }
    await executeCommand({ cmd, args });
  },
};

/**
 * パスユーティリティ
 */
export const pathUtil = {
  resolvePath: (first: string, ...rest: string[]) => join(first, ...rest),
};

/**
 * コマンド実行ユーティリティ
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function executeCommand(options: {
  cmd: string;
  args: string[];
  cwd?: string;
}): Promise<CommandResult> {
  const command = new Deno.Command(options.cmd, {
    args: options.args,
    cwd: options.cwd || PROJECT_ROOT,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}
