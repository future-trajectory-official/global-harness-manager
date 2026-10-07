/**
 * 非git cwd でも対象リポジトリの git remote を引けるよう、`git -C <dir>` の
 * 基準ディレクトリを per-repo で解決するヘルパー（WP #806）。
 *
 * グローバルな repo 固定を避け multi-repo 正しさを保つため、リポジトリ固有の
 * 既存機構（`HARNESS_WORKSPACE_ROOT` 環境変数、および per-repo の `.harnessrc`）に
 * のみ依存する。いずれも未設定なら null を返し、呼び出し元は ambient cwd
 * フォールバックで従来動作を維持する。
 */
import { dirname } from "@std/path";
import { resolveHarnessRcPath } from "./account/harnessrc-resolver.ts";
import type { ExecuteResult } from "./io/command.ts";

/** 子プロセス実行関数（テスト注入用。gateway/sprint-utils の runner と同形）。 */
export type RemoteCommandRunner = (cmd: string, args: string[]) => Promise<ExecuteResult>;

/** `origin` remote URL 解決結果。 */
export interface OriginResolution {
  /** 解決成功時 true。 */
  readonly ok: boolean;
  /** 解決された origin URL（ok 時のみ）。 */
  readonly url?: string;
  /** 失敗理由（!ok 時のみ）。 */
  readonly error?: string;
}

/** 解決に必要な依存（テスト注入用）。 */
export interface RepoDirDeps {
  /** 環境変数取得。 */
  readonly env: (key: string) => string | undefined;
  /** 解決済み `.harnessrc` パス（未存在時 null）。 */
  readonly harnessRcPath: () => string | null;
}

/**
 * `git -C` の基準ディレクトリを解決する。
 *
 * 優先順: `HARNESS_WORKSPACE_ROOT` → 解決済み `.harnessrc` の所在ディレクトリ → null。
 * `.harnessrc` は onboarding で repo ごとに生成される固有設定のため、per-repo 性が保たれる。
 *
 * @param deps 依存注入（既定は `Deno` 環境）
 * @returns 基準ディレクトリ、決定不能時は null（呼び出し元が cwd にフォールバック）
 */
export function resolveRepoDir(
  deps: RepoDirDeps = {
    env: (key) => Deno.env.get(key),
    harnessRcPath: () => resolveHarnessRcPath(),
  },
): string | null {
  const workspaceRoot = deps.env("HARNESS_WORKSPACE_ROOT");
  if (workspaceRoot) return workspaceRoot;
  const rcPath = deps.harnessRcPath();
  return rcPath ? dirname(rcPath) : null;
}

/**
 * `git remote get-url origin` の URL を解決する（WP #806 M1/M4/M5）。
 *
 * 解決順: ① ambient cwd（cwd が git repo のとき最優先＝stale env で別 repo に誤解決しない）
 * ② 非git cwd 時は repoDir（`HARNESS_WORKSPACE_ROOT`→`.harnessrc` 所在 dir）に対し
 * `git -C <repoDir>` で再試行。両失敗時は失敗理由を返す。
 * 呼出組立をここに一本化し、gateway と sprint-utils の重複を解消する。
 *
 * @param run 子プロセス実行関数（`git` を呼ぶ）
 * @param resolveDir repoDir 解決関数（既定は `resolveRepoDir`、テスト注入可）
 * @returns 解決された origin URL または失敗理由
 */
export async function readOriginRemoteUrl(
  run: RemoteCommandRunner,
  resolveDir: () => string | null = () => resolveRepoDir(),
): Promise<OriginResolution> {
  const cwdResult = await run("git", ["remote", "get-url", "origin"]);
  if (cwdResult.code === 0 && cwdResult.stdout.trim()) {
    return { ok: true, url: cwdResult.stdout.trim() };
  }
  const repoDir = resolveDir();
  if (repoDir) {
    const dirResult = await run("git", ["-C", repoDir, "remote", "get-url", "origin"]);
    if (dirResult.code === 0 && dirResult.stdout.trim()) {
      return { ok: true, url: dirResult.stdout.trim() };
    }
    return {
      ok: false,
      error: `Failed to resolve scope from git remote (cwd と repoDir=${repoDir} 双方失敗): ${
        dirResult.stderr || cwdResult.stderr
      }`,
    };
  }
  return {
    ok: false,
    error: `Failed to resolve scope from git remote: ${cwdResult.stderr}`,
  };
}
