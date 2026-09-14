import { join } from "@std/path";
import {
  executeCommand,
  fsUtil,
  logger,
  pathUtil,
  PROJECT_ROOT,
} from "../../../../../../.opencode/core/harness-core.ts";

export type FsDeps = Pick<
  typeof fsUtil,
  "downloadFile" | "extract" | "exists" | "move" | "remove" | "mkdir"
>;
export type CmdDeps = typeof executeCommand;
export type LoggerDeps = Pick<typeof logger, "info" | "warn" | "error" | "success">;

export interface InstallGhDeps {
  fs: FsDeps;
  cmd: CmdDeps;
  logger: LoggerDeps;
}

const defaultDeps: InstallGhDeps = {
  fs: {
    downloadFile: fsUtil.downloadFile,
    extract: fsUtil.extract,
    exists: fsUtil.exists,
    move: fsUtil.move,
    remove: fsUtil.remove,
    mkdir: fsUtil.mkdir,
  },
  cmd: executeCommand,
  logger,
};

/** GitHub CLI の採用バージョン（AC-3調査確定版。URL組立の単一の正）。 */
export const GH_VERSION = "v2.100.0";

/** プロファイル追記時のマーカー行。 */
const PROFILE_MARKER = "# global-harness-manager";

function profileExportLine(binDir: string): string {
  return `export PATH="$PATH:${binDir}"`;
}

/**
 * binDir文字列を正規化する。
 * 空文字・空白のみは空文字のまま返し、呼出側でフォールバックさせる。
 * 先頭`~`はHOME展開、末尾スラッシュ（`/`、Windowsルート以外の`\`）を除去する。
 * @param raw - 正規化前のbinDir文字列
 * @param home - HOMEディレクトリ（`~`展開用。省略時はDeno.envのHOME）
 * @returns 正規化されたbinDir（空入力時は空文字）
 */
export function normalizeBinDir(raw: string, home?: string): string {
  let dir = raw.trim();
  if (dir === "") return dir;
  if (dir === "~" || dir.startsWith("~/")) {
    const h = home ?? Deno.env.get("HOME") ?? "";
    dir = h + dir.slice(1);
  }
  while (dir.length > 1 && dir.endsWith("/")) {
    dir = dir.slice(0, -1);
  }
  while (dir.length > 3 && dir.endsWith("\\") && !/^[A-Za-z]:\\$/.test(dir)) {
    dir = dir.slice(0, -1);
  }
  return dir;
}

/**
 * インストール先binDirを解決する。
 * 優先順位: GLOBAL_HARNESS_BIN_DIR > HARNESS_DISTRIBUTE_BIN_DIR > <harnessRoot>/bin。
 * - GLOBAL_HARNESS_BIN_DIR: テスト隔離・既存ローカル上書き用（従来変数）。
 * - HARNESS_DISTRIBUTE_BIN_DIR: 配布先（例: ~/.harness/bin）指定用（本WP追加）。
 * 空文字・空白のみは未指定扱いでフォールバックする。`~`展開・末尾スラッシュ除去を行う。
 * @param harnessRoot - ハーネスルートディレクトリのパス
 * @param env - 環境変数マップ（省略時はDeno.env。テスト容易性のためのDI）
 * @returns 解決されたbinDirのパス
 */
export function resolveBinDir(
  harnessRoot: string,
  env: Record<string, string | undefined> = Deno.env.toObject(),
): string {
  const raw = env["GLOBAL_HARNESS_BIN_DIR"]?.trim() ||
    env["HARNESS_DISTRIBUTE_BIN_DIR"]?.trim() ||
    "";
  if (raw === "") return join(harnessRoot, "bin");
  return normalizeBinDir(raw, env["HOME"]);
}

/**
 * プロファイル内容に解決済みbinDirの追記が必要かを判定する。
 * 完全なexport行またはPATHエントリ境界付き（`:"<binDir>"` / `:<binDir>:` /
 * 行末`:<binDir>`）でのみ記載済みとし、部分一致（例: `<binDir>-old`）は誤検出しない。
 * @param content - プロファイルファイルの既存内容
 * @param binDir - 解決済みインストール先binDir
 * @returns 追記が必要な場合にtrue
 */
export function needsProfileUpdate(content: string, binDir: string): boolean {
  const exportLine = profileExportLine(binDir);
  return !content.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    if (trimmed === exportLine) return true;
    return trimmed.includes(`:${binDir}"`) ||
      trimmed.includes(`:${binDir}:`) ||
      trimmed.endsWith(`:${binDir}`);
  });
}

/**
 * プロファイル内容に解決済みbinDirのexport行を追記する。
 * 既にbinDirを含む場合は内容を変えずに返す。末尾改行の有無を正規化し空行を増やさない。
 * @param content - プロファイルファイルの既存内容
 * @param binDir - 解決済みインストール先binDir
 * @returns 追記後（または変更なし）のプロファイル内容
 */
export function appendBinDirToProfile(content: string, binDir: string): string {
  if (!needsProfileUpdate(content, binDir)) {
    return content;
  }
  const body = content.endsWith("\n") ? content : content + "\n";
  return `${body}${PROFILE_MARKER}\n${profileExportLine(binDir)}\n`;
}

/**
 * Windows User PATHを`;`区切りで分割する。空エントリ・前後空白を除去する。
 * @param userPath - User環境変数Pathの現在値
 * @returns 正規化されたエントリ一覧
 */
export function splitWindowsPath(userPath: string): string[] {
  return userPath.split(";").map((entry) => entry.trim()).filter((entry) => entry !== "");
}

/**
 * Windows User PATHに解決済みbinDirの追加が必要かを判定する。
 * `;`区切りエントリの大文字小文字を無視した完全一致で判定し、部分一致は誤検出しない。
 * @param userPath - User環境変数Pathの現在値
 * @param binDir - 解決済みインストール先binDir
 * @returns 追加が必要な場合にtrue
 */
export function needsWindowsPathUpdate(userPath: string, binDir: string): boolean {
  const want = binDir.toLowerCase();
  return !splitWindowsPath(userPath).some((entry) => entry.toLowerCase() === want);
}

/**
 * Windows User PATHに解決済みbinDirを追加した値を組み立てる。
 * 冪等であり、記載済みの場合は正規化された現在値を返す。空`userPath`時はbinDirのみを返す。
 * @param userPath - User環境変数Pathの現在値
 * @param binDir - 解決済みインストール先binDir
 * @returns 追加後のUser PATH値
 */
export function buildWindowsPath(userPath: string, binDir: string): string {
  const entries = splitWindowsPath(userPath);
  if (entries.some((entry) => entry.toLowerCase() === binDir.toLowerCase())) {
    return entries.join(";");
  }
  return [...entries, binDir].join(";");
}

/**
 * PowerShellのシングルクォート文字列用に値をエスケープする（`'`→`''`）。
 * @param value - エスケープ前の文字列
 * @returns エスケープ後の文字列
 */
export function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * OSに応じたプロファイルファイルを選択する。
 * @param os - Deno.build.os と同形式のOS名
 * @param home - HOMEディレクトリ
 * @returns プロファイルファイルのパス
 */
export function getProfileFile(os: string, home: string): string {
  return os === "darwin" ? join(home, ".zshrc") : join(home, ".bashrc");
}

/**
 * GitHub CLI をダウンロードし、指定されたディレクトリにインストールする。
 * 既に gh が存在する場合はダウンロードをスキップする。
 * @param binDir - インストール先ディレクトリのパス
 * @param os - オペレーティングシステム
 * @param arch - CPU アーキテクチャ
 * @param deps - 外部依存（省略時は実装依存を使用）
 */
export async function installGh(
  binDir: string,
  os: string,
  arch: string,
  deps: InstallGhDeps = defaultDeps,
): Promise<void> {
  let ghTarget = "";
  let isZip = false;

  if (os === "linux") {
    ghTarget = arch === "aarch64" ? "linux_arm64" : "linux_amd64";
  } else if (os === "darwin") {
    ghTarget = arch === "aarch64" ? "macOS_arm64" : "macOS_amd64";
    isZip = true;
  } else if (os === "windows") {
    ghTarget = "windows_amd64";
    isZip = true;
  }

  const ghExe = os === "windows" ? "gh.exe" : "gh";
  const ghPath = join(binDir, ghExe);

  if (!(await deps.fs.exists(ghPath))) {
    deps.logger.info(`Downloading GitHub CLI for ${os}_${arch}...`);
    const ghVersion = GH_VERSION;
    const ext = isZip ? "zip" : "tar.gz";
    const ghFile = `gh_${ghVersion.substring(1)}_${ghTarget}.${ext}`;
    const ghUrl = `https://github.com/cli/cli/releases/download/${ghVersion}/${ghFile}`;
    const downloadPath = join(binDir, ghFile);

    if (!(await deps.fs.exists(binDir))) {
      await deps.fs.mkdir(binDir, { recursive: true });
    }

    try {
      await deps.fs.downloadFile(ghUrl, downloadPath);

      if (os === "windows") {
        await deps.fs.extract(downloadPath, binDir);
        const extractDir = join(binDir, `gh_${ghVersion.substring(1)}_${ghTarget}`);
        await deps.fs.move(join(extractDir, "bin", "gh.exe"), ghPath);
        await deps.fs.remove(extractDir, { recursive: true });
        await deps.fs.remove(downloadPath);
      } else {
        if (isZip) {
          await deps.fs.extract(downloadPath, binDir);
          const extractDir = join(binDir, `gh_${ghVersion.substring(1)}_${ghTarget}`);
          await deps.fs.move(join(extractDir, "bin", "gh"), ghPath);
          await deps.fs.remove(extractDir, { recursive: true });
          await deps.fs.remove(downloadPath);
        } else {
          await deps.fs.extract(downloadPath, binDir, { stripComponents: 1 });
          await deps.fs.move(join(binDir, "bin", "gh"), ghPath);
          await deps.fs.remove(join(binDir, "bin"), { recursive: true });
          if (await deps.fs.exists(join(binDir, "share"))) {
            await deps.fs.remove(join(binDir, "share"), { recursive: true });
          }
          await deps.fs.remove(downloadPath);
        }
        await deps.cmd({ cmd: "chmod", args: ["+x", ghPath] });
      }
      deps.logger.info("GitHub CLI installed successfully.");
    } catch (error) {
      await deps.fs.remove(downloadPath, { recursive: true }).catch(() => {});
      throw error;
    }
  } else {
    deps.logger.info("GitHub CLI already exists.");
  }
}

async function main() {
  logger.info("Starting Deno-first environment setup...");

  const os = Deno.build.os;
  const arch = Deno.build.arch;

  const harnessRoot = PROJECT_ROOT;
  const binDir = resolveBinDir(harnessRoot);
  const configPath = join(harnessRoot, "config", "global-skills-path.txt");

  await installGh(binDir, os, arch);

  logger.info("Configuring PATH...");
  if (os === "windows") {
    const res = await executeCommand({
      cmd: "powershell",
      args: ["-Command", "[Environment]::GetEnvironmentVariable('Path', 'User')"],
    });
    const userPath = res.stdout.trim();
    if (needsWindowsPathUpdate(userPath, binDir)) {
      const newPath = buildWindowsPath(userPath, binDir);
      await executeCommand({
        cmd: "powershell",
        args: [
          "-Command",
          `[Environment]::SetEnvironmentVariable('Path', '${
            escapePowerShellString(newPath)
          }', 'User')`,
        ],
      });
      logger.info("Added to Windows User PATH. Please restart terminal.");
    }
  } else {
    const home = Deno.env.get("HOME") || "";
    const profileFile = getProfileFile(os, home);
    if (await fsUtil.exists(profileFile)) {
      const content = await fsUtil.readTextFile(profileFile);
      const next = appendBinDirToProfile(content, binDir);
      if (next !== content) {
        await fsUtil.writeTextFile(profileFile, next);
        logger.info(`Added to ${profileFile}. Please run 'source ${profileFile}'.`);
      }
    }
  }

  logger.info("Registering skills...");
  if (await fsUtil.exists(configPath)) {
    const configContent = await fsUtil.readTextFile(configPath);
    const lines = configContent.split(/\r?\n/);
    const skillsFilePath = join(
      Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "",
      ".gemini",
      "antigravity",
      "skills.txt",
    );

    let existingPaths: string[] = [];
    if (await fsUtil.exists(skillsFilePath)) {
      const existingContent = await fsUtil.readTextFile(skillsFilePath);
      existingPaths = existingContent.split(/\r?\n/).filter((p) => p.trim() !== "");
    }

    let modified = false;
    for (const line of lines) {
      if (line.trim() === "" || line.startsWith("#")) continue;
      const absPath = pathUtil.resolvePath(harnessRoot, line.trim());

      if (!(await fsUtil.exists(absPath))) {
        await Deno.mkdir(absPath, { recursive: true });
      }

      if (!existingPaths.includes(absPath)) {
        existingPaths.push(absPath);
        modified = true;
      }
    }

    if (modified) {
      const skillsDir = join(skillsFilePath, "..");
      if (!(await fsUtil.exists(skillsDir))) {
        await Deno.mkdir(skillsDir, { recursive: true });
      }
      await fsUtil.writeTextFile(skillsFilePath, existingPaths.join("\n") + "\n");
      logger.info("Updated skills.txt successfully.");
    } else {
      logger.info("Skills already registered.");
    }
  } else {
    logger.warn(`Config file not found: ${configPath}`);
  }

  logger.info("--- Setup Complete ---");
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    logger.error(`Setup failed: ${message}`);
    Deno.exit(1);
  });
}
