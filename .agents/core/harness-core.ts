import { resolve, normalize, join } from "jsr:@std/path";

// --- Logger ---
export const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  dryRun: (msg: string) => console.log(`[DRY-RUN] ${msg}`),
};

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

// --- Path and File System Utilities ---
export const pathUtil = {
  /**
   * 与えられたパスを絶対パスに変換し、区切り文字を正規化します。
   */
  resolvePath: (...pathSegments: string[]): string => {
    if (pathSegments.length === 0) return normalize(resolve());
    return normalize(resolve(pathSegments[0], ...pathSegments.slice(1)));
  },
  /**
   * パスの結合を行います
   */
  joinPath: (...pathSegments: string[]): string => {
    if (pathSegments.length === 0) return "";
    return join(pathSegments[0], ...pathSegments.slice(1));
  }
};

export const fsUtil = {
  /**
   * テキストファイルを読み込みます（UTF-8）
   */
  readTextFile: async (filePath: string): Promise<string> => {
    return await Deno.readTextFile(filePath);
  },
  /**
   * テキストファイルを書き込みます（UTF-8）
   * @param dryRun true の場合、実際の書き込みは行いません
   */
  writeTextFile: async (filePath: string, content: string, dryRun = false): Promise<void> => {
    if (dryRun) {
      logger.dryRun(`Write to file: ${filePath}`);
      return;
    }
    await Deno.writeTextFile(filePath, content);
  },
  /**
   * ディレクトリやファイルが存在するか確認します
   */
  exists: async (filePath: string): Promise<boolean> => {
    try {
      await Deno.stat(filePath);
      return true;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return false;
      }
      throw e;
    }
  }
};
