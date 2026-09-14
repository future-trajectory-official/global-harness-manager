import { join } from "@std/path";
import {
  executeCommand,
  fsUtil,
  logger,
  pathUtil,
  PROJECT_ROOT,
} from "../../../../../../.agents/core/harness-core.ts";

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
    const ghVersion = "v2.47.0";
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
  const binDir = Deno.env.get("GLOBAL_HARNESS_BIN_DIR") || join(harnessRoot, "bin");
  const configPath = join(harnessRoot, "config", "global-skills-path.txt");

  await installGh(binDir, os, arch);

  logger.info("Configuring PATH...");
  if (os === "windows") {
    const res = await executeCommand({
      cmd: "powershell",
      args: ["-Command", "[Environment]::GetEnvironmentVariable('Path', 'User')"],
    });
    const userPath = res.stdout.trim();
    if (!userPath.includes(binDir)) {
      await executeCommand({
        cmd: "powershell",
        args: [
          "-Command",
          `[Environment]::SetEnvironmentVariable('Path', '${userPath};${binDir}', 'User')`,
        ],
      });
      logger.info("Added to Windows User PATH. Please restart terminal.");
    }
  } else {
    const home = Deno.env.get("HOME") || "";
    const profileFile = os === "darwin" ? join(home, ".zshrc") : join(home, ".bashrc");
    if (await fsUtil.exists(profileFile)) {
      const content = await fsUtil.readTextFile(profileFile);
      if (!content.includes(binDir)) {
        await fsUtil.writeTextFile(
          profileFile,
          content + `\n# global-harness-manager\nexport PATH="$PATH:${binDir}"\n`,
        );
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
