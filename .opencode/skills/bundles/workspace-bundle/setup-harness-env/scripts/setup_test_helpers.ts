import type { InstallGhDeps } from "./setup.ts";

/**
 * テスト用の一時ディレクトリを提供する。
 * @param fn - 一時ディレクトリパスを受け取るテスト本体
 * @returns テスト本体の戻り値
 */
export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir();
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

/**
 * テスト中のみ環境変数を上書きする（同期版）。
 * @param vars - 上書きする変数（undefined指定で削除）
 * @param fn - テスト本体
 */
export function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const prev = new Map<string, string | undefined>();
  for (const key of Object.keys(vars)) {
    prev.set(key, Deno.env.get(key));
    const value = vars[key];
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
  try {
    fn();
  } finally {
    for (const [key, value] of prev) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

/**
 * テスト中のみ環境変数を上書きする（非同期版）。
 * @param vars - 上書きする変数（undefined指定で削除）
 * @param fn - テスト本体
 * @returns テスト本体の戻り値
 */
export async function withEnvAsync<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = new Map<string, string | undefined>();
  for (const key of Object.keys(vars)) {
    prev.set(key, Deno.env.get(key));
    const value = vars[key];
    if (value === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of prev) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

/**
 * 何もしないロガーを生成する。
 * @returns 静寂なロガー依存
 */
export function silentLogger(): InstallGhDeps["logger"] {
  return { info: () => {}, warn: () => {}, error: () => {}, success: () => {} };
}

/**
 * パス操作を記録する隔離済み依存を生成する。
 * @param record - タッチされたパスを記録する配列ホルダー
 * @returns 隔離済みInstallGhDeps
 */
export function createIsolatedDeps(record: { paths: string[] }): InstallGhDeps {
  return {
    fs: {
      downloadFile: (_url: string, destPath: string) => {
        record.paths.push(destPath);
        return Promise.resolve();
      },
      extract: () => Promise.resolve(),
      exists: () => Promise.resolve(false),
      move: (src: string, dest: string) => {
        record.paths.push(src);
        record.paths.push(dest);
        return Promise.resolve();
      },
      remove: () => Promise.resolve(),
      mkdir: (path: string, _options?: { recursive?: boolean }) => {
        record.paths.push(path);
        return Promise.resolve();
      },
    },
    cmd: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
    logger: silentLogger(),
  };
}
