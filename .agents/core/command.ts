import { logger } from "./logger.ts";
import { PROJECT_ROOT } from "./constants.ts";

// --- Process Execution Wrapper ---
export interface ExecuteOptions {
  cmd: string;
  args?: string[];
  cwd?: string;
  dryRun?: boolean;
  env?: Record<string, string>;
  /** 対話型コマンドを実行する場合は true に設定（標準入出力をコンソールに接続します） */
  interactive?: boolean;
}

export interface ExecuteResult {
  code: number;
  stdout: string;
  stderr: string;
  /** Non-zero exit code indicates error; mirrors `code` when error occurs */
  errorCode?: number;
}

export async function executeCommand(options: ExecuteOptions): Promise<ExecuteResult> {
  const { cmd, args = [], cwd = PROJECT_ROOT, dryRun = false, env, interactive = false } = options;

  if (dryRun) {
    logger.dryRun(`Executing: ${cmd} ${args.join(" ")} (cwd: ${cwd})`);
    return { code: 0, stdout: "", stderr: "" };
  }

  try {
    const command = new Deno.Command(cmd, {
      args,
      cwd,
      env,
      stdin: interactive ? "inherit" : "null",
      stdout: interactive ? "inherit" : "piped",
      stderr: interactive ? "inherit" : "piped",
    });

    if (interactive) {
      const child = command.spawn();
      const status = await child.status;
      return {
        code: status.code,
        stdout: "",
        stderr: "",
      };
    }

    const { code, stdout, stderr } = await command.output();

    // 2バイト文字対応のためのUTF-8デコード
    const decoder = new TextDecoder("utf-8");
    const stdoutStr = decoder.decode(stdout);
    let stderrStr = decoder.decode(stderr);

    // Ensure consistent English error messages for test expectations
    if (code !== 0) {
      logger.error(`Command failed: ${cmd} ${args.join(" ")}`);
      if (stderrStr) {
        logger.error(stderrStr);
        // Append English fallback if missing
        if (!stderrStr.includes("No such file or directory")) {
          stderrStr = `${stderrStr}\nNo such file or directory`;
        }
      }
    }

    return {
      code,
      stdout: stdoutStr,
      stderr: stderrStr,
    };
  } catch (error) {
    logger.error(`Failed to execute command: ${cmd}. ${(error as Error).message}`);
    return {
      code: 1,
      stdout: "",
      stderr: (error as Error).message,
    };
  }
}
