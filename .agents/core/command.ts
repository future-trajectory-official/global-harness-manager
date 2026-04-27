import { logger } from "./logger.ts";

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
}

export async function executeCommand(options: ExecuteOptions): Promise<ExecuteResult> {
  const { cmd, args = [], cwd, dryRun = false, env, interactive = false } = options;

  if (dryRun) {
    logger.dryRun(`Executing: ${cmd} ${args.join(" ")}${cwd ? ` (cwd: ${cwd})` : ""}`);
    return { code: 0, stdout: "", stderr: "" };
  }

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
  const stderrStr = decoder.decode(stderr);

  if (code !== 0) {
    logger.error(`Command failed: ${cmd} ${args.join(" ")}`);
    if (stderrStr) logger.error(stderrStr);
  }

  return {
    code,
    stdout: stdoutStr,
    stderr: stderrStr,
  };
}
