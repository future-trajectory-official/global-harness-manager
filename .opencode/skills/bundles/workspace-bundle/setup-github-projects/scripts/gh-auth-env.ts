/**
 * 対象アイデンティティ認証の env 構築機能（WP #785 AC-1）。
 *
 * `gh auth switch` によるグローバル状態の書換を行わず、プロセス単位の
 * `GH_TOKEN` 環境変数で対象アカウントとして gh を実行するための関数群。
 * トークンの出所は gh 設定の `hosts.yml` の `users:` 配下
 * `oauth_token`（読取専用・書換なし）。`gh` は `GH_TOKEN` を最優先で
 * 使用するため、active user の変更なしに別アカウント操作が可能。
 *
 * 前提条件:
 * - Account Name（identities.md）は hosts.yml の `users:` キー（gh
 *   ユーザー名）と一致すること。不一致時は env 検証が失敗し実行しない
 *   （fail-closed）。
 * - 対象ホストは `github.com` のみ。GHES等は対象外。
 * - 旧形式（`users:` なしで直下に `oauth_token`）は非対応。
 */

import { parse } from "@std/yaml";
import {
  type GhStatus,
  type GhVerification,
  verifyGhAuth,
} from "../../../../../core/shared/account/account-context.ts";
import type { TargetAccount } from "./resolve-target-account.ts";
import { runGhStatusSync } from "./subprocess.ts";

/** hosts.yml の `users:` 配下から抽出したユーザー別トークン表。 */
export type HostsUserTokens = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * hosts.yml 本文からユーザー別トークン表を抽出する（純関数）。
 *
 * `users:` 不在・解析不能時は空表を返す（例外を投げない）。
 * 空白のみのトークンは除外する。
 *
 * @param hostsYaml hosts.yml の本文
 * @returns ユーザー名から oauth_token への写像
 */
export function parseHostsUserTokens(hostsYaml: string): HostsUserTokens {
  let doc: unknown;
  try {
    doc = parse(hostsYaml);
  } catch {
    return {};
  }
  if (!isRecord(doc)) return {};
  const github = doc["github.com"];
  if (!isRecord(github)) return {};
  const users = github["users"];
  if (!isRecord(users)) return {};
  const tokens: HostsUserTokens = {};
  for (const [name, entry] of Object.entries(users)) {
    if (isRecord(entry)) {
      const token = entry["oauth_token"];
      if (typeof token === "string" && token.trim().length > 0) {
        tokens[name] = token;
      }
    }
  }
  return tokens;
}

/**
 * 対象アカウントの gh 実行用 env を構築する（純関数）。
 *
 * トークン不在時は null を返し、呼出元は実行せず誘導文で終了すること。
 *
 * @param tokens `parseHostsUserTokens` の結果
 * @param accountName 対象の Account Name（hosts.yml の users キーと一致すること）
 * @returns `GH_TOKEN` を含む env。トークン不在時は null
 */
export function buildGhEnvForUser(
  tokens: HostsUserTokens,
  accountName: string,
): Record<string, string> | null {
  const token = tokens[accountName];
  if (!token) return null;
  return { GH_TOKEN: token };
}

/**
 * gh 設定ディレクトリ配下の hosts.yml パスを解決する。
 *
 * 解決順は `GH_CONFIG_DIR` → `XDG_CONFIG_HOME/gh` → `HOME/.config/gh`。
 * いずれも未設定時は null を返す（`~` の非展開フォールバックは行わない）。
 *
 * @returns hosts.yml のパス。不定時は null
 */
export function resolveHostsPath(): string | null {
  const explicit = Deno.env.get("GH_CONFIG_DIR");
  if (explicit) return `${explicit}/hosts.yml`;
  const xdg = Deno.env.get("XDG_CONFIG_HOME");
  if (xdg) return `${xdg}/gh/hosts.yml`;
  const home = Deno.env.get("HOME");
  if (home) return `${home}/.config/gh/hosts.yml`;
  return null;
}

/**
 * hosts.yml を読み、ユーザー別トークン表を返す。
 *
 * 読込失敗時は空表を返す（例外を投げない）。
 *
 * @param hostsPath hosts.yml のパス（既定は `resolveHostsPath` の結果）
 * @returns ユーザー名から oauth_token への写像
 */
export function readHostsUserTokens(hostsPath?: string): HostsUserTokens {
  const path = hostsPath ?? resolveHostsPath();
  if (!path) return {};
  let text: string;
  try {
    text = Deno.readTextFileSync(path);
  } catch {
    return {};
  }
  return parseHostsUserTokens(text);
}

/**
 * 対象アカウントの gh 実行用 env を解決する（純関数・I/Oなし）。
 *
 * トークン不在時は `Error` を投げる（ambient認証での代替実行を防ぐため、
 * 誘導文付きで呼出元は非ゼロ終了すること）。
 *
 * @param accountName 対象の Account Name
 * @param tokens ユーザー別トークン表（呼出側で `readHostsUserTokens` 等により用意する）
 * @returns `GH_TOKEN` を含む env
 */
export function resolveGhEnvForAccount(
  accountName: string,
  tokens: HostsUserTokens,
): Record<string, string> {
  const env = buildGhEnvForUser(tokens, accountName);
  if (!env) {
    throw new Error(
      `対象アカウント ${accountName} のトークンが hosts.yml にありません。` +
        "`gh auth login` で認証を追加してください。",
    );
  }
  return env;
}

/**
 * env 配下の gh 認証状態が対象アカウントと一致するか検証する。
 *
 * `verifyGhAuth` に env 経由の状態取得を注入し、ambient認証への依存を排除する。
 * `runStatus` には env が必ず渡されるため、スタブ注入時も env 転送を検証できる。
 *
 * @param accountName 照合対象の Account Name
 * @param env 対象アカウントの env（`resolveGhEnvForAccount` の結果）
 * @param runStatus env を受けて `gh auth status` 相当を実行する関数
 * @returns 検証結果。不一致時は誘導文を含む
 */
export function verifyTargetAuth(
  accountName: string,
  env: Record<string, string>,
  runStatus: (env: Record<string, string>) => GhStatus = (e) =>
    runGhStatusSync(["auth", "status"], { env: e }),
): GhVerification {
  return verifyGhAuth(accountName, () => runStatus(env));
}

/** runner解決への依存注入用入力。 */
export interface RunnerResolveDeps {
  /** トークン表の取得（既定は実 hosts.yml から読込）。 */
  readonly readTokens: () => HostsUserTokens;
  /** env を受けて `gh auth status` 相当を実行する（既定は実 gh 呼出）。 */
  readonly runStatus: (env: Record<string, string>) => GhStatus;
}

/** runner解決の結果（純粋値。プロセス終了は含まない）。 */
export type RunnerResolveResult<T> =
  | { readonly ok: true; readonly runner: T }
  | { readonly ok: false; readonly message: string };

/**
 * 解決済み対象アカウントに応じた gh 実行 runner を決定する（純粋値・副作用なし）。
 *
 * 対象アカウント特定時（`accountName` あり）は対象トークンの env を解決・検証し、
 * env 付き runner を返す。検証失敗・トークン不在時は `{ ok: false }`
 * を返す（ambient認証での代替実行は行わない）。対象外時は既定 runner を返す
 * （従来の ambient 動作を維持）。
 *
 * @param target `resolveOwnerTarget` の解決結果
 * @param defaultRunner 既定 runner（対象外時・後方互換）
 * @param runnerWithEnv env 付き runner の生成関数
 * @param deps 依存注入（テスト用。既定は実環境）
 * @returns runner または失敗理由
 */
export function resolveRunnerResult<T>(
  target: TargetAccount,
  defaultRunner: T,
  runnerWithEnv: (env: Record<string, string>) => T,
  deps: Partial<RunnerResolveDeps> = {},
): RunnerResolveResult<T> {
  if (!target.accountName) return { ok: true, runner: defaultRunner };
  const merged: RunnerResolveDeps = {
    readTokens: readHostsUserTokens,
    runStatus: (env) => runGhStatusSync(["auth", "status"], { env }),
    ...deps,
  };
  let env: Record<string, string>;
  try {
    env = resolveGhEnvForAccount(target.accountName, merged.readTokens());
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  const verification = verifyGhAuth(target.accountName, () => merged.runStatus(env));
  if (!verification.verified) {
    return {
      ok: false,
      message: verification.guidance ?? "gh 認証を確認できません。",
    };
  }
  return { ok: true, runner: runnerWithEnv(env) };
}

/**
 * 解決済み対象アカウントに応じた gh 実行 runner を決定する。
 *
 * `resolveRunnerResult` の薄いラッパー。失敗時は誘導文を表示して終了コード1で
 * 終了する。
 *
 * @param target `resolveOwnerTarget` の解決結果
 * @param defaultRunner 既定 runner（対象外時・後方互換）
 * @param runnerWithEnv env 付き runner の生成関数
 * @param deps 依存注入（テスト用。既定は実環境）
 * @returns 使用すべき runner（失敗時は戻らず終了コード1で終了する）
 */
export function resolveRunnerOrExit<T>(
  target: TargetAccount,
  defaultRunner: T,
  runnerWithEnv: (env: Record<string, string>) => T,
  deps: Partial<RunnerResolveDeps> = {},
): T {
  const result = resolveRunnerResult(target, defaultRunner, runnerWithEnv, deps);
  if (!result.ok) {
    console.error(result.message);
    Deno.exit(1);
  }
  return result.runner;
}
