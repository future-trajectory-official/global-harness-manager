/**
 * 対象アカウント解決機能（WP #763 AC-4）。
 *
 * アカウント特定（WP #764・WP-2連携）に基づき、ProjectV2 操作対象の
 * アカウントを解決する。git remote からの owner 抽出・identities 照合・
 * gh 認証検証はいずれも既存モジュールへの委譲で実装し、本モジュールでは
 * 再実装しない（正の定義は `account-identifier.ts` と `account-context.ts`）。
 * `gh auth switch` の実行は含まず、不一致時は誘導文の返却のみとする
 * （自動切替の禁止・`references/account-usage.md` 参照）。
 *
 * 依存（git remote・identities本文・gh status）は引数注入可能にし、
 * テスト容易性を保つ。`create-boards.ts`／`create-fields.ts` は
 * `resolveOwnerTarget` を介して本モジュールと接続する。
 */

import { join } from "@std/path";
import {
  identifyAccount,
  parseGitRemoteUrl,
  parseIdentities,
} from "../../../../../core/shared/account/account-identifier.ts";
import { type GhStatus, verifyGhAuth } from "../../../../../core/shared/account/account-context.ts";
import { runCommandSync, runGhStatusSync } from "./subprocess.ts";

/** 解決済みの対象アカウント。 */
export interface TargetAccount {
  /** ボード所有者（リポジトリのオーナー）。未特定時は null。 */
  readonly owner: string | null;
  /** 認証アカウント（identities.md の Account Name）。対象外時は null。 */
  readonly accountName: string | null;
  /** gh 認証が Account Name と一致したか。 */
  readonly verified: boolean;
  /** 不一致時の誘導文。一致時・対象外時は null。 */
  readonly guidance: string | null;
}

/** `resolveTargetAccount` への依存注入用入力。 */
export interface ResolveTargetAccountDeps {
  /** `git remote get-url origin` 相当の取得。失敗時は null。 */
  readonly gitRemoteUrl: () => string | null;
  /** identities.md 本文の取得。不在時は null。 */
  readonly identitiesText: () => string | null;
  /** `gh auth status` 相当の実行。 */
  readonly ghStatus: () => GhStatus;
}

/** 対象アカウントを解決する関数（テスト用に注入可能）。 */
export type TargetAccountResolver = (
  repo: string | null,
) => TargetAccount;

/**
 * 対象アカウントを解決する。
 *
 * 手順: remote URL 確定（`--repo` 指定時は合成、未指定時は git remote）→
 * owner 抽出（`parseGitRemoteUrl`）→ Account Name 照合（`identifyAccount`）→
 * gh 検証（`verifyGhAuth`）。対象外（accountName 未特定）時は gh 検証を
 * スキップし、誘導文なしで返す（誘導不要のため）。
 *
 * @param repo 対象リポジトリの owner/repo。null の場合は git remote を参照する
 * @param deps 依存注入用オプション（部分指定可。既定は `Deno` 環境）
 * @returns 解決済みの対象アカウント
 */
export function resolveTargetAccount(
  repo: string | null,
  deps: Partial<ResolveTargetAccountDeps> = {},
): TargetAccount {
  const merged: ResolveTargetAccountDeps = {
    gitRemoteUrl: defaultGitRemoteUrl,
    identitiesText: defaultIdentitiesText,
    ghStatus: defaultGhStatus,
    ...deps,
  };
  const remoteUrl = repo ? `https://github.com/${repo}` : merged.gitRemoteUrl();
  const owner = remoteUrl ? parseGitRemoteUrl(remoteUrl)?.owner ?? null : null;
  const accountName = remoteUrl
    ? identifyAccount(remoteUrl, parseIdentities(merged.identitiesText() ?? ""))
    : null;
  if (!accountName) {
    return { owner, accountName: null, verified: false, guidance: null };
  }
  const verification = verifyGhAuth(accountName, merged.ghStatus);
  return { owner, accountName, ...verification };
}

/**
 * `--owner` 優先・`--repo` 解決の共通決定（create-boards／create-fields 共用）。
 *
 * `--owner` 明示指定時はそれをボード所有者として優先する（後方互換）。
 * ただし gh 認証の検証は省略しない（WP #763 レビュー指摘対応による挙動変更）:
 * `--repo`（未指定時は git remote）から `resolve` で認証アカウントを解決・検証し、
 * 所有者のみ明示値で上書きする。不一致時の `guidance` はそのまま引き継ぐため、
 * 呼出元は作成を実行せず誘導文を表示して非ゼロ終了すること（`--dry-run` を含む）。
 *
 * @param args `--owner` と `--repo` を持つ引数解析結果
 * @param resolve 対象アカウント解決関数（既定は実環境）
 * @returns 解決済みの対象アカウント（`owner` は明示値優先、検証結果は `resolve` 由来）
 */
export function resolveOwnerTarget(
  args: { readonly owner: string; readonly repo: string | null },
  resolve: TargetAccountResolver = (target) => resolveTargetAccount(target),
): TargetAccount {
  if (!args.owner) {
    return resolve(args.repo);
  }
  const verified = resolve(args.repo);
  return { ...verified, owner: args.owner };
}

/**
 * 既定依存の取得群（`defaultGitRemoteUrl`・`defaultIdentitiesText`・`defaultGhStatus`）。
 *
 * `account-context.ts` の同名既定取得とは統合しない。差異は以下のとおり:
 * - 探索順が異なる（本モジュールは `HARNESS_WORKSPACE_ROOT` 優先・cwd 直下の
 *   `config/identities.md` へのフォールバックを持つ。`account-context.ts` 側は
 *   `HARNESS_IDENTITIES_PATH` のみで cwd フォールバックを持たない）。
 * - 不在時の契約が異なる（本モジュールは `null` を返し `resolveTargetAccount` が
 *   対象外として扱う。`account-context.ts` 側は異なる既定値契約を持つ）。
 * 無理な統一は行わず、バイト列復号・コマンド実行の重複のみ `subprocess.ts` に集約する。
 */

function defaultGitRemoteUrl(): string | null {
  try {
    const result = runCommandSync("git", ["remote", "get-url", "origin"]);
    if (result.code !== 0) return null;
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

function defaultIdentitiesText(): string | null {
  try {
    const explicit = Deno.env.get("HARNESS_IDENTITIES_PATH");
    if (explicit) return Deno.readTextFileSync(explicit);
    const workspaceRoot = Deno.env.get("HARNESS_WORKSPACE_ROOT");
    if (workspaceRoot) {
      return Deno.readTextFileSync(join(workspaceRoot, "config", "identities.md"));
    }
    return Deno.readTextFileSync(join("config", "identities.md"));
  } catch {
    return null;
  }
}

function defaultGhStatus(): GhStatus {
  return runGhStatusSync(["auth", "status"]);
}

if (import.meta.main) {
  const repo = Deno.args.includes("--repo")
    ? Deno.args[Deno.args.indexOf("--repo") + 1] ?? null
    : null;
  const target = resolveTargetAccount(repo);
  // 整形形式のJSON: 人間向けのデバッグ表示のため可読性を優先する意図。
  console.log(JSON.stringify(target, null, 2));
  if (target.guidance) {
    console.error(target.guidance);
    Deno.exit(1);
  }
}
