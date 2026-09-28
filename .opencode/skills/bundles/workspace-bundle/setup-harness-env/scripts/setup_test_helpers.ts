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
