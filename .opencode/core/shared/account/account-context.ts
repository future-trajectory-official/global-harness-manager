/**
 * アカウント別グローバル設定の解決ヘルパー。
 *
 * 呼出元リポジトリの git remote から Account Name を特定し（AC1）、
 * 明示パス解決済みの `.harnessrc` から設定切替情報を読み（AC2）、
 * `gh auth status` で認証を検証してアカウント毎の設定を選択する（AC3）。
 * 不一致時は自動で切り替えず、`gh auth switch` の誘導文を返す
 * （plan.md 設計判断・セキュリティ優先）。
 *
 * 本モジュールは同期処理で実装し、`composition-root.ts` のモジュール初期化時
 * から呼び出せるようにする。依存は引数で注入可能にし、純粋にテスト可能にする。
 */
import { join } from "@std/path";
import { identifyAccount, parseIdentities } from "./account-identifier.ts";
import {
  type HarnessRcConfig,
  loadHarnessRcConfig,
  resolveHarnessRcPath,
} from "./harnessrc-resolver.ts";

/** `gh auth status` 実行結果の最小表現。 */
export interface GhStatus {
  /** 終了コード。 */
  readonly code: number;
  /** 標準出力。 */
  readonly stdout: string;
  /** 標準エラー出力。 */
  readonly stderr: string;
}

/** gh 認証の検証結果。 */
export interface GhVerification {
  /** gh の認証アカウントが特定アカウントと一致したか。 */
  readonly verified: boolean;
  /** 不一致・失敗時の誘導文。一致時は null。 */
  readonly guidance: string | null;
}

/** 解決済みのアカウント別設定。 */
export interface AccountContext {
  /** 特定した Account Name。対象外の場合は null。 */
  readonly accountName: string | null;
  /** 設定切替情報。解決不可の場合は null。 */
  readonly config: HarnessRcConfig | null;
  /**
   * gh 認証が一致したか。`accountName` が null（対象外）の場合は検証を
   * 行わないため false となり、「検証失敗」との区別は `guidance` が
   * null であることで判断する（対象外時は誘導不要のため）。
   */
  readonly verified: boolean;
  /** 切替・認証の誘導文。不要時は null。 */
  readonly guidance: string | null;
}

/** `resolveAccountContext` への依存注入用入力。 */
export interface AccountContextDeps {
  /** `git remote get-url origin` 相当の取得。失敗時は null。 */
  readonly gitRemoteUrl: () => string | null;
  /** identities.md 本文の取得。不在時は null。 */
  readonly identitiesText: () => string | null;
  /** 解決済み `.harnessrc` パスの取得。 */
  readonly harnessRcPath: () => string | null;
  /** `.harnessrc` の読込。 */
  readonly readHarnessRc: (path: string) => string;
  /** `gh auth status` 相当の実行。 */
  readonly ghStatus: () => GhStatus;
}

/**
 * gh の認証アカウントが特定アカウントと一致するか検証する。
 *
 * stdout と stderr を結合した出力から空白・クォート・括弧区切りのトークンを
 * 切り出し、Account Name と完全一致するトークンの有無で判定する
 * （部分一致は誤検証のため採用しない）。
 *
 * @param accountName 照合対象の Account Name
 * @param run `gh auth status` 相当の実行関数（テスト用に注入可能）
 * @returns 検証結果。不一致・失敗時は誘導文を含む
 */
export function verifyGhAuth(
  accountName: string,
  run: () => GhStatus = defaultGhStatus,
): GhVerification {
  const result = run();
  if (result.code !== 0) {
    const detail = result.stderr.trim();
    return {
      verified: false,
      guidance: detail
        ? `gh 認証を確認できません（${detail}）。\`gh auth login\` で認証してください。`
        : "`gh 認証を確認できません。`gh auth login` で認証してください。",
    };
  }
  const tokens = `${result.stdout}\n${result.stderr}`.split(/[\s"'(),[\]{}]+/);
  if (tokens.includes(accountName)) {
    return { verified: true, guidance: null };
  }
  return {
    verified: false,
    guidance:
      `現在の gh 認証は '${accountName}' ではありません。\`gh auth switch --user ${accountName}\` で切り替えてください。`,
  };
}

/**
 * アカウント別設定を一連で解決する。
 *
 * 手順: git remote 取得 → identities 照合 → `.harnessrc` 読込 → gh 検証。
 * アカウント特定に失敗した場合は gh 検証をスキップする。
 * `.harnessrc` 読込はアカウント特定の成否と独立に行う。
 *
 * @param deps 依存注入用オプション（部分指定可。既定は `Deno` 環境）
 * @returns 解決済みのアカウント別設定
 */
export function resolveAccountContext(
  deps: Partial<AccountContextDeps> = {},
): AccountContext {
  const merged: AccountContextDeps = {
    gitRemoteUrl: defaultGitRemoteUrl,
    identitiesText: defaultIdentitiesText,
    harnessRcPath: () => resolveHarnessRcPath(),
    readHarnessRc: (path) => Deno.readTextFileSync(path),
    ghStatus: defaultGhStatus,
    ...deps,
  };
  const remoteUrl = merged.gitRemoteUrl();
  const identities = parseIdentities(merged.identitiesText() ?? "");
  const accountName = remoteUrl ? identifyAccount(remoteUrl, identities) : null;
  const config = loadHarnessRcConfig(merged.harnessRcPath(), merged.readHarnessRc);
  if (!accountName) {
    return { accountName: null, config, verified: false, guidance: null };
  }
  const verification = verifyGhAuth(accountName, merged.ghStatus);
  return { accountName, config, ...verification };
}

const utf8Decoder = new TextDecoder("utf-8");

function decode(output: Uint8Array): string {
  return utf8Decoder.decode(output);
}

function defaultGitRemoteUrl(): string | null {
  try {
    const result = new Deno.Command("git", {
      args: ["remote", "get-url", "origin"],
      stdout: "piped",
      stderr: "null",
    }).outputSync();
    if (result.code !== 0) return null;
    return decode(result.stdout).trim() || null;
  } catch {
    return null;
  }
}

function defaultIdentitiesText(): string | null {
  try {
    const explicit = Deno.env.get("HARNESS_IDENTITIES_PATH");
    const workspaceRoot = Deno.env.get("HARNESS_WORKSPACE_ROOT");
    const path = explicit ??
      (workspaceRoot ? join(workspaceRoot, "config", "identities.md") : null);
    if (!path) return null;
    return Deno.readTextFileSync(path);
  } catch {
    return null;
  }
}

function defaultGhStatus(): GhStatus {
  try {
    const result = new Deno.Command("gh", {
      args: ["auth", "status"],
      stdout: "piped",
      stderr: "piped",
    }).outputSync();
    return {
      code: result.code,
      stdout: decode(result.stdout),
      stderr: decode(result.stderr),
    };
  } catch (error) {
    return { code: 1, stdout: "", stderr: (error as Error).message };
  }
}
