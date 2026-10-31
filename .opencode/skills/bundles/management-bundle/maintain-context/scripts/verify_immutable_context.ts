/**
 * verify_immutable_context.ts — 不変正本（management.md）の編集後ガード
 *
 * `maintain-context` が `product.md` を編集した後、不変であるべき
 * `.github/context/management.md` / `.github/context/product.md.example` に
 * 差分が無いことを検証する。
 *
 * ## なぜ `git diff` を先に打たないのか
 *
 * 配布先リポジトリには正本が存在しないことがある。その状態で
 * 未追跡パスに `git diff` を打つと、git がパスをリビジョンと解釈して
 * `fatal: ambiguous argument` で停止する。本スクリプトは `git ls-files` で
 * **追跡有無を先に判定**し、追跡されていない場合は差分検証を行わない。
 * また、追跡下の判定は `git status --porcelain` を使う（`git diff` だけでは
 * ステージ済みの改変を見逃すため）。
 *
 * ## 判定
 *
 * - 追跡済み かつ 差分なし → `ok`
 * - 追跡済み かつ 差分あり（**ステージ済みを含む**）→ `violation`（ok=false / exit 1 の fail-closed）
 * - 差分を取得できない → `error`（ok=false。検証未完了を成功扱いにしない）
 * - 未追跡 → 差分検証を行わず `skipped`。正本がローカルに無ければ
 *   グローバル `~/.harness/context/management.md` を参照先として報告する（`source: "global"`）
 * - どちらにも無い → `source: "none"` ＋ warning で exit 0（環境不備の判定は他スキルの責務）
 * - git リポジトリ外 → `source: "no-git"` ＋ warning で exit 0（ガードは環境検査器ではない）
 *
 * 使用方法:
 *   deno run -A verify_immutable_context.ts [--cwd <path>] [--home <path>]
 */

import { parseArgs } from "@std/cli";
import { join } from "@std/path";

/** 不変正本（git追跡対象・編集禁止） */
const MANAGEMENT_PATH = ".github/context/management.md";

/** 構造見本（git追跡対象・編集禁止） */
const EXAMPLE_PATH = ".github/context/product.md.example";

/** グローバル配置の正本（参照専用） */
const GLOBAL_MANAGEMENT_PATH = ".harness/context/management.md";

/**
 * コマンド実行結果。
 * @property code - 終了コード
 * @property stdout - 標準出力
 * @property stderr - 標準エラー出力
 */
export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * コマンド実行関数（テストで差し替え可能）。
 */
export type CommandRunner = (
  cmd: string,
  args: string[],
  cwd: string,
) => Promise<CommandResult>;

/**
 * 1ファイル分の判定結果。
 * @property path - リポジトリ相対パス
 * @property tracked - git 追跡下かどうか
 * @property status - ok / violation / skipped / error
 * @property detail - 補足説明
 */
export interface CheckResult {
  path: string;
  tracked: boolean;
  status: "ok" | "violation" | "skipped" | "error";
  detail?: string;
}

/**
 * ガード全体の結果。
 * @property ok - 違反が無ければ true
 * @property source - 不変正本の参照元（local / global / none / no-git）
 * @property checks - ファイルごとの判定
 * @property warnings - 停止はしないが注意すべき事項
 */
export interface VerifyResult {
  ok: boolean;
  source: "local" | "global" | "none" | "no-git";
  checks: CheckResult[];
  warnings: string[];
}

/**
 * 検証オプション。
 * @property cwd - 対象リポジトリのディレクトリ
 * @property home - グローバル配置の基点（既定は HOME）
 * @property run - コマンド実行関数
 */
export interface VerifyOptions {
  cwd?: string;
  home?: string;
  run?: CommandRunner;
}

/**
 * 実プロセスでコマンドを実行する既定の実行関数。実行ファイル不在でも例外にしない。
 * @param cmd - 実行ファイル名
 * @param args - 引数リスト
 * @param cwd - 実行ディレクトリ
 * @returns 終了コードと出力
 */
export async function defaultRunner(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> {
  try {
    const output = await new Deno.Command(cmd, {
      args,
      cwd,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const decoder = new TextDecoder("utf-8");
    return {
      code: output.code,
      stdout: decoder.decode(output.stdout),
      stderr: decoder.decode(output.stderr),
    };
  } catch (error) {
    return { code: 127, stdout: "", stderr: String(error) };
  }
}

/**
 * ファイルが存在するかどうか（ディレクトリは false）。
 * @param path - 対象パス
 * @returns 通常ファイルとして存在すれば true
 */
async function isFile(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch {
    return false;
  }
}

/**
 * 対象ファイルごとの設定。`primary` は不変正本（management.md）を表す。
 */
const TARGETS = [
  { path: MANAGEMENT_PATH, primary: true },
  { path: EXAMPLE_PATH, primary: false },
] as const;

/**
 * 追跡済みファイルの差分有無を判定する。
 * staged / unstaged の双方を検出するため `git status --porcelain` を使う。
 * @param run - コマンド実行関数
 * @param root - リポジトリルート
 * @param relPath - リポジトリ相対パス
 * @returns 判定結果と、失敗時の警告文
 */
async function inspectTracked(
  run: CommandRunner,
  root: string,
  relPath: string,
): Promise<{ check: CheckResult; warning?: string }> {
  const status = await run("git", ["status", "--porcelain", "--", relPath], root);
  if (status.code !== 0) {
    return {
      check: {
        path: relPath,
        tracked: true,
        status: "error",
        detail: "git status を取得できませんでした（検証未完了）。",
      },
      warning: `${relPath} の差分を取得できませんでした（fail-closed）。`,
    };
  }

  const changed = status.stdout.trim().length > 0;
  return {
    check: {
      path: relPath,
      tracked: true,
      status: changed ? "violation" : "ok",
    },
  };
}

/**
 * 追跡外ファイルの判定。未追跡パスへの `git diff` は fatal になるため実行しない。
 * @param root - リポジトリルート
 * @param relPath - リポジトリ相対パス
 * @returns 判定結果と、ファイルが存在したかどうか
 */
async function inspectUntracked(
  root: string,
  relPath: string,
): Promise<{ check: CheckResult; exists: boolean }> {
  const exists = await isFile(join(root, relPath));
  return {
    exists,
    check: {
      path: relPath,
      tracked: false,
      status: "skipped",
      detail: exists
        ? "git 追跡対象外のため差分検証をスキップしました。"
        : "ファイルが存在しません。",
    },
  };
}

/**
 * 正本が未追跡のとき、参照先（グローバル or なし）を決める。
 * どちらにも無くても停止しない（環境不備の判定は他スキルの責務）。
 * @param home - グローバル配置の基点
 * @returns 参照元と警告
 */
async function resolveMissingManagementSource(
  home: string,
): Promise<{ source: "global" | "none"; warnings: string[] }> {
  const globalPath = home ? join(home, GLOBAL_MANAGEMENT_PATH) : "";
  if (globalPath && await isFile(globalPath)) {
    return { source: "global", warnings: [] };
  }
  return {
    source: "none",
    warnings: [
      "ローカルにもグローバル（~/.harness/context/management.md）にも management.md が無いため、不変ガードを検証できませんでした。",
    ],
  };
}

/**
 * 不変正本の編集後ガードを実行する。例外を投げず、常に結果を返す。
 * @param options - 検証オプション
 * @returns 判定結果
 */
export async function verifyImmutableContext(
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const cwd = options.cwd ?? Deno.cwd();
  const home = options.home ?? Deno.env.get("HOME") ?? "";
  const run = options.run ?? defaultRunner;

  const toplevel = await run("git", ["rev-parse", "--show-toplevel"], cwd);
  if (toplevel.code !== 0) {
    return {
      ok: true,
      source: "no-git",
      checks: [],
      warnings: [
        "git リポジトリではないため、不変ガードの検証をスキップしました。",
      ],
    };
  }

  const root = toplevel.stdout.trim() || cwd;
  const checks: CheckResult[] = [];
  const warnings: string[] = [];
  let source: VerifyResult["source"] = "none";

  for (const target of TARGETS) {
    const trackedResult = await run(
      "git",
      ["ls-files", "--error-unmatch", "--", target.path],
      root,
    );

    if (trackedResult.code !== 0) {
      const { check, exists } = await inspectUntracked(root, target.path);
      checks.push(check);

      if (target.primary) {
        const resolved = await resolveMissingManagementSource(home);
        source = resolved.source;
        warnings.push(...resolved.warnings);
        if (exists) {
          warnings.push(
            "management.md が git 追跡対象外です。追跡下にある場合のみ差分検証が可能です。",
          );
        }
      }
      continue;
    }

    if (target.primary) source = "local";

    const inspected = await inspectTracked(run, root, target.path);
    checks.push(inspected.check);
    if (inspected.warning) warnings.push(inspected.warning);
  }

  return {
    ok: checks.every((check) => check.status === "ok" || check.status === "skipped"),
    source,
    checks,
    warnings,
  };
}

/**
 * CLI のメイン処理。違反時のみ exit 1、それ以外は exit 0。
 */
async function main(): Promise<void> {
  const args = parseArgs(Deno.args, { string: ["cwd", "home"] });

  try {
    const result = await verifyImmutableContext({
      cwd: args.cwd,
      home: args.home,
    });

    console.log(JSON.stringify(result, null, 2));
    for (const warning of result.warnings) {
      console.error(`[verify_immutable_context] ${warning}`);
    }
    Deno.exit(result.ok ? 0 : 1);
  } catch (error) {
    // ガードは環境検査器ではないため、想定外の失敗で作業を止めない
    console.error(`[verify_immutable_context] 検証を実行できませんでした: ${String(error)}`);
    Deno.exit(0);
  }
}

if (import.meta.main) {
  await main();
}
