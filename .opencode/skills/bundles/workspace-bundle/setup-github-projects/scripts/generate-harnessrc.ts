/**
 * `.harnessrc` 生成機能（WP #765 AC-1）。
 *
 * 本モジュールは純関数群（ボード番号とフィールド名からの JSON 文字列生成、CLI 引数解析、
 * ボード番号検証、アカウント特定）と CLI 入口（`runGenerateHarnessRc`）を提供する。
 * ファイル書込・標準入出力・アカウント特定は同モジュール内の CLI 入口が担う。
 *
 * GitHub Project V2 のボード番号を入力に、`.harnessrc.example` と同構成
 * （`projects` 3キー＋`fields` を `HARNESS_FIELDS` と同数保持する等値マップ）の
 * `.harnessrc` を JSON 文字列で生成する。フィールド名（fields）は不変であり、
 * 正の定義は `field-registry.ts` の `HARNESS_FIELDS` を単一の正源泉とする。
 *
 * 生成された `.harnessrc` は git 追跡対象外（`.github/schemas/.gitignore`）のため、
 * `Gateway 層（composition-root.ts）` が `loadHarnessRcConfig` で読み込む。
 */
import { dirname, join } from "@std/path";
import {
  identifyAccount,
  parseGitRemoteUrl,
  parseIdentities,
} from "../../../../../core/shared/account/account-identifier.ts";
import { verifyGhAuth } from "../../../../../core/shared/account/account-context.ts";
import { HARNESS_FIELDS } from "../../../../../core/gateway/field-registry.ts";

/** ボード種別と番号の対応（`.harnessrc` の projects キー）。 */
export interface HarnessRcBoards {
  readonly productBacklog: number;
  readonly sprintBoard: number;
  readonly retrospectiveBoard: number;
}

/** 生成物 `_comment` に反映する任意メタ情報（AC-3 のアカウント特定結果）。 */
export interface HarnessRcMeta {
  /** ボード所有者（リポジトリのオーナー）。未特定時は null。 */
  readonly owner?: string | null;
  /** 認証アカウント（identities.md の Account Name）。未特定時は null。 */
  readonly accountName?: string | null;
  /** gh 認証が Account Name と一致したか。 */
  readonly verified?: boolean;
}

/** リポジトリの認証アカウントを解決する関数（テスト用に注入可能）。 */
export type RepoAccountResolver = (
  repo: string,
  identitiesText: string,
) => {
  readonly accountName: string | null;
  readonly verified: boolean;
  readonly guidance: string | null;
};

/** 生成物の冒頭に付すメタ情報（キー構成の公開先・正の定義を明示する）。 */
const COMMENT =
  "GitHub Project V2 のボード番号を保持する設定ファイル。setup-github-projects スキルが自動生成し、Gateway 層（composition-root.ts）が読み込む。追跡対象外のため、キー構成の公開は .harnessrc.example を参照。ボード番号（projects）はアカウント・作成タイミングごとに異なる。フィールド名（fields）の正の定義は .opencode/core/gateway/field-registry.ts。";

/** ボード番号とフィールド名から `.harnessrc` の JSON 文字列を生成する（純関数）。 */
export function generateHarnessRc(
  boards: HarnessRcBoards,
  meta: HarnessRcMeta = {},
): string {
  const fields: Record<string, string> = {};
  for (const name of HARNESS_FIELDS) {
    fields[name] = name;
  }
  let comment = COMMENT;
  if (meta.owner) {
    comment += `\nボード所有者: ${meta.owner}`;
  }
  if (meta.accountName) {
    comment += `\n認証アカウント: ${meta.accountName}（gh 認証: ${
      meta.verified ? "一致" : "不一致"
    }）`;
  }
  const config = {
    _comment: comment,
    projects: { ...boards },
    fields,
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * CLI 引数を解析する（純関数）。
 *
 * 対応フラグ:
 * - `--boards-json <json>`: ボード番号（WP #763 の出力スタブ。`{"productBacklog":N,...}`）
 * - `--out <path>`: 出力先ファイルパス（省略時は `.github/schemas/.harnessrc`）
 * - `--repo <owner/repo>`: 対象リポジトリの owner/repo（AC-2 の生成先スコープ。任意）
 * - `--dry-run`: ファイルへ書かず標準出力へ出す
 * - `--help`: 利用法を表示
 *
 * 値欠落（フラグのみで終端）や不正な `--boards-json` は `Error` を投げる。
 */
export function parseArgs(
  args: string[],
): {
  readonly boards: HarnessRcBoards;
  readonly outPath: string;
  readonly repo: string | null;
  readonly dryRun: boolean;
  readonly help: boolean;
} {
  let boards: HarnessRcBoards = { productBacklog: 0, sprintBoard: 0, retrospectiveBoard: 0 };
  let outPath = "";
  let repo: string | null = null;
  let dryRun = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--boards-json": {
        const value = args[++i];
        if (value === undefined) {
          throw new Error("--boards-json の値（JSON 文字列）が指定されていません");
        }
        boards = parseBoardsJson(value);
        break;
      }
      case "--out": {
        const value = args[++i];
        if (value === undefined) {
          throw new Error("--out の値（出力先パス）が指定されていません");
        }
        outPath = value;
        break;
      }
      case "--repo": {
        const value = args[++i];
        if (value === undefined) {
          throw new Error("--repo の値（owner/repo）が指定されていません");
        }
        repo = value;
        break;
      }
      case "--dry-run":
        dryRun = true;
        break;
      case "--help":
        help = true;
        break;
    }
  }
  return {
    boards,
    outPath,
    repo,
    dryRun,
    help,
  };
}

/**
 * `--boards-json` の生文字列を検証付きで解析する（純関数）。
 *
 * JSON として解釈でき、3キー（productBacklog / sprintBoard / retrospectiveBoard）が
 * すべて**正整数（>0）**であることを検証する。不正時は明確なメッセージ付きで `Error` を投げる。
 *
 * @param raw `--boards-json` に渡された JSON 文字列
 * @returns 検証済みのボード番号
 */
export function parseBoardsJson(raw: string): HarnessRcBoards {
  let parsed: Record<string, number>;
  try {
    parsed = JSON.parse(raw) as Record<string, number>;
  } catch {
    throw new Error("--boards-json の JSON 形式が不正です");
  }
  const result: HarnessRcBoards = {
    productBacklog: parsed.productBacklog,
    sprintBoard: parsed.sprintBoard,
    retrospectiveBoard: parsed.retrospectiveBoard,
  };
  for (const [key, value] of Object.entries(result)) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `--boards-json の ${key} は正整数（>0）である必要があります（現在: ${value}）`,
      );
    }
  }
  return result;
}

/** 既定の出力先（`.harnessrc` の慣例パス。resolver 候補の第3位と一致）。 */
export const DEFAULT_OUT_PATH = join(".github", "schemas", ".harnessrc");

/**
 * `owner/repo` 文字列からボード所有者（Organization または個人アカウント）を導出する（純関数）。
 *
 * ボードの所有者はリポジトリのオーナーであり、認証アカウント（identities.md の Account Name）とは
 * 概念的に別物として扱う（plan.md 設計判断）。入力が `owner/repo` 形式でない場合は null。
 */
export function deriveBoardOwner(repo: string): string | null {
  const scope = parseGitRemoteUrl(`https://github.com/${repo}`);
  return scope?.owner ?? null;
}

/**
 * `identities.md` の対応表からリポジトリの Account Name を照合する（純関数）。
 *
 * 対象リポジトリの認証アカウントを特定する既定リゾルバから利用される。
 */
export function accountNameFromIdentities(repo: string, identitiesText: string): string | null {
  const identities = parseIdentities(identitiesText);
  const account = identifyAccount(`https://github.com/${repo}`, identities);
  return account;
}

/**
 * 既定の認証アカウントリゾルバ。
 *
 * `identitiesText` が空の場合は `config/identities.md`（既定ではカレントディレクトリ）を読み、
 * `accountNameFromIdentities` で照合し、`verifyGhAuth` で gh 認証を検証して返す。
 */
function defaultResolveRepoAccount(
  repo: string,
  identitiesText: string,
): {
  readonly accountName: string | null;
  readonly verified: boolean;
  readonly guidance: string | null;
} {
  const text = identitiesText || readDefaultIdentities();
  const accountName = accountNameFromIdentities(repo, text);
  if (!accountName) {
    return { accountName: null, verified: false, guidance: null };
  }
  const verification = verifyGhAuth(accountName);
  return { accountName, ...verification };
}

/** 既定の identities.md 本文を読み取る（`HARNESS_IDENTITIES_PATH` 優先、次に cwd の config/identities.md）。 */
function readDefaultIdentities(): string {
  const explicit = Deno.env.get("HARNESS_IDENTITIES_PATH");
  if (explicit) {
    try {
      return Deno.readTextFileSync(explicit);
    } catch {
      return "";
    }
  }
  try {
    return Deno.readTextFileSync(join("config", "identities.md"));
  } catch {
    return "";
  }
}

/**
 * 対象リポジトリの認証アカウントを特定する（`identities.md` 対応表＋`gh auth` 検証）。
 *
 * 既定リゾルバは `repo`（および必要時に `config/identities.md`）のみを参照し、実環境
 * （git remote）には依存しない。テスト時は `resolve` を依存注入で差し替え、誤アカウント混入を防ぐ。
 * 戻り値の `owner` はボード所有者（リポジトリのオーナー）、`accountName` は認証アカウント。
 *
 * @param repo 対象リポジトリの owner/repo。null の場合はすべて null を返す
 * @param resolve 認証アカウント解決関数（既定は `config/identities.md` 照合＋gh 検証）
 */
export function resolveRepoAccount(
  repo: string | null,
  resolve: RepoAccountResolver = defaultResolveRepoAccount,
): {
  readonly owner: string | null;
  readonly accountName: string | null;
  readonly verified: boolean;
  readonly guidance: string | null;
} {
  if (!repo) {
    return { owner: null, accountName: null, verified: false, guidance: null };
  }
  const owner = deriveBoardOwner(repo);
  const account = resolve(repo, "");
  return {
    owner,
    accountName: account.accountName,
    verified: account.verified,
    guidance: account.guidance,
  };
}

/** CLI の入口。生成物を指定パスへ書き込む（`--dry-run` 時は標準出力のみ）。 */
export function runGenerateHarnessRc(
  args: string[],
  resolve?: RepoAccountResolver,
): string {
  let opts;
  try {
    opts = parseArgs(args);
  } catch (error) {
    console.error((error as Error).message);
    throw error;
  }
  if (opts.help) {
    return "usage: generate-harnessrc [--boards-json <json>] [--out <path>] [--repo <owner/repo>] [--dry-run]";
  }
  if (!opts.boards.productBacklog || !opts.boards.sprintBoard || !opts.boards.retrospectiveBoard) {
    throw new Error(
      "--boards-json is required (productBacklog/sprintBoard/retrospectiveBoard)",
    );
  }
  const account = resolveRepoAccount(opts.repo, resolve);
  const meta: HarnessRcMeta = {
    owner: account.owner,
    accountName: account.accountName,
    verified: account.verified,
  };
  const json = generateHarnessRc(opts.boards, meta);
  if (opts.dryRun) {
    return json;
  }
  const outPath = opts.outPath || DEFAULT_OUT_PATH;
  Deno.mkdirSync(dirname(outPath), { recursive: true });
  Deno.writeTextFileSync(outPath, json);
  return `[OK] wrote ${outPath}`;
}

if (import.meta.main) {
  console.log(runGenerateHarnessRc(Deno.args));
}
