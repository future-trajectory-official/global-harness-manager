/**
 * GitHub Project V2 ボード作成機能（WP #763 AC-1）。
 *
 * `BOARDS` キー固定（productBacklog / sprintBoard / retrospectiveBoard）の
 * 3ボードを対象に、存在チェック→作成→再利用を行う。既存ボードの削除・改名は
 * 行わない（破壊防止）。ボード番号の型 `HarnessRcBoards` は
 * `field-registry.ts` の定義を参照し、本モジュールでは重複定義しない
 * （`generate-harnessrc.ts` からの再エクスポートでも取得可能）。
 *
 * gh 呼出は `BoardGhRunner` に分離し、テスト時はモックを注入する。
 * 正の定義は `.opencode/core/gateway/field-registry.ts` の `BOARDS` を参照。
 */

import {
  type BoardKey,
  emptyBoardNumbers,
  type HarnessRcBoards,
} from "../../../../../core/gateway/field-registry.ts";
import { resolveOwnerTarget } from "./resolve-target-account.ts";
import {
  BOARDS_USAGE,
  handleTargetOrExit,
  OWNER_REQUIRED_MESSAGE,
  parseCommonArgs,
} from "./cli-args.ts";
import { resolveRunnerOrExit } from "./gh-auth-env.ts";
import { runGh } from "./subprocess.ts";

/** `gh project list` 相当の結果の最小表現。 */
export interface BoardSummary {
  readonly number: number;
  readonly name: string;
}

/** gh 呼出の注入点（テスト用に差し替え可能）。 */
export interface BoardGhRunner {
  /** 所有者の既存ボード一覧を取得する。 */
  readonly listBoards: (owner: string) => Promise<readonly BoardSummary[]>;
  /** ボードを1件作成し番号を返す。 */
  readonly createBoard: (
    owner: string,
    title: string,
  ) => Promise<{ readonly number: number }>;
}

/** ボードキーと作成時タイトルの対応（`BOARDS` キー固定）。 */
export const BOARD_TITLES: Record<BoardKey, string> = {
  productBacklog: "Product Backlog",
  sprintBoard: "Sprint Board",
  retrospectiveBoard: "Retrospective Board",
};

const BOARD_ORDER: readonly BoardKey[] = [
  "productBacklog",
  "sprintBoard",
  "retrospectiveBoard",
];

/**
 * 既存一覧から再利用可能なボード番号を探す（純関数）。
 *
 * @param existing `listBoards` の結果
 * @param title 再利用対象のタイトル
 * @returns 一致した番号。不存在時は null
 */
export function findExistingBoardNumber(
  existing: readonly BoardSummary[],
  title: string,
): number | null {
  const found = existing.find((board) => board.name === title);
  return found ? found.number : null;
}

/**
 * 3ボードの存在チェック→作成→再利用を行う。
 *
 * 既存ボードは番号を再利用し、不在のボードのみ作成する。
 *
 * @param owner ボード所有者（Organization または個人アカウント）
 * @param runner gh 呼出の実装（既定は実 gh 呼出）
 * @returns `HarnessRcBoards` 形式のボード番号
 */
export async function ensureBoards(
  owner: string,
  runner: BoardGhRunner = defaultBoardGhRunner,
): Promise<HarnessRcBoards> {
  const existing = await runner.listBoards(owner);
  const numbers: Record<BoardKey, number> = { ...emptyBoardNumbers() };
  for (const key of BOARD_ORDER) {
    const reused = findExistingBoardNumber(existing, BOARD_TITLES[key]);
    if (reused !== null) {
      numbers[key] = reused;
      continue;
    }
    const created = await runner.createBoard(owner, BOARD_TITLES[key]);
    numbers[key] = created.number;
  }
  return { ...numbers };
}

/** CLI の入口。結果を `--boards-json` 形式で返す。1行形式のJSON（機械可読を優先し `generate-harnessrc.ts` の `--boards-json` へパイプ受け渡し可能にする意図）。 */
export async function runCreateBoards(
  owner: string,
  runner: BoardGhRunner = defaultBoardGhRunner,
): Promise<string> {
  if (!owner) {
    throw new Error(OWNER_REQUIRED_MESSAGE);
  }
  const boards = await ensureBoards(owner, runner);
  return JSON.stringify(boards);
}

/**
 * `gh project list --owner <owner> --format json` の生出力を解析する（純関数）。
 *
 * 実形式 `{"projects":[{"number":N,"title":T,...}],"totalCount":3}` を
 * `BoardSummary[]` に変換する。不正JSON時は `Error` を投げる。
 * 番号・タイトルを持たない要素は除外する。
 *
 * @param raw `gh project list --format json` の標準出力
 * @returns 検出したボード一覧
 */
export function parseProjectListJson(raw: string): BoardSummary[] {
  let parsed: { projects?: Array<{ number?: unknown; title?: unknown }> };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("gh project list の JSON 形式が不正です");
  }
  return (parsed.projects ?? []).flatMap((project) =>
    typeof project.number === "number" && typeof project.title === "string"
      ? [{ number: project.number, name: project.title }]
      : []
  );
}

/**
 * `gh project create --format json` の生出力を解析する（純関数）。
 *
 * 実形式 `{"number":N,...}` からボード番号を抽出する。不正JSON時・番号欠落時は
 * `Error` を投げる。
 *
 * @param raw `gh project create --format json` の標準出力
 * @returns 作成されたボード番号
 */
export function parseProjectCreateJson(raw: string): { readonly number: number } {
  let parsed: { number?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("gh project create の JSON 形式が不正です");
  }
  if (typeof parsed.number !== "number") {
    throw new Error("gh project create の結果に番号が含まれていません");
  }
  return { number: parsed.number };
}

/** CLI引数の解析結果。 */
export interface CreateBoardsArgs {
  /** ボード所有者（`--owner` または位置引数）。未指定時は空文字。 */
  readonly owner: string;
  /** 対象リポジトリの owner/repo（`--repo`。未指定時は null）。 */
  readonly repo: string | null;
  /** 作成を行わず実行計画の表示のみ行うか。 */
  readonly dryRun: boolean;
  /** 利用法を表示するか。 */
  readonly help: boolean;
}

/**
 * CLI引数を解析する（純関数）。
 *
 * 対応: `--owner <owner>` / `--repo <owner/repo>` / `--dry-run` / `--help` /
 * 位置引数 `<owner>`
 * （SKILL.mdの既存形式と互換）。共通オプションの解析は `cli-args.ts` の
 * `parseCommonArgs` に委譲する。未知の `--*` フラグ・`--owner`・`--repo` の
 * 値欠落時・余剰の位置引数がある場合は `Error` を投げる。
 * 標準出力のJSONは `generate-harnessrc.ts` の `--boards-json` 入力と互換
 * （`HarnessRcBoards` 形式）である。
 *
 * `--owner` 明示時はそれを優先する（後方互換）。未指定時は `--repo`
 * （未指定時は git remote）から `resolve-target-account.ts` で解決する。
 * `--owner` 明示時も gh 認証の検証は行う（`resolveOwnerTarget` が担う）。
 *
 * @param args `Deno.args` 相当の引数列
 * @returns 解析済み引数
 */
export function parseCreateBoardsArgs(args: string[]): CreateBoardsArgs {
  const common = parseCommonArgs(args);
  let owner = common.owner;
  let consumed = 0;
  if (!owner && common.positionals.length > 0) {
    owner = common.positionals[0];
    consumed = 1;
  }
  const surplus = common.positionals.slice(consumed);
  if (surplus.length > 0) {
    throw new Error(`余剰の位置引数があります: ${surplus.join(" ")}（利用法: ${BOARDS_USAGE}）`);
  }
  return { owner, repo: common.repo, dryRun: common.dryRun, help: common.help };
}

/** 実行計画の組み立て結果（純関数 `buildBoardsPlan` の戻り値）。 */
export interface BoardsPlan {
  /** 人間向け計画行（`reuse ...` / `create ...`）。 */
  readonly lines: string[];
  /** 再利用する件数。 */
  readonly reuseCount: number;
  /** 新規作成する件数。 */
  readonly createCount: number;
  /** 確定番号（未作成分は0。`HarnessRcBoards` 形式）。 */
  readonly boards: HarnessRcBoards;
}

/**
 * 既存一覧から実行計画を組み立てる（純関数・副作用なし）。
 *
 * 既存ボードは番号を再利用し、不在のボードは作成対象とする。
 * 作成対象の番号は dry-run 時点では確定しないため0とする。
 *
 * @param existing `listBoards` 相当の既存一覧
 * @returns 実行計画
 */
export function buildBoardsPlan(
  existing: readonly BoardSummary[],
): BoardsPlan {
  const lines: string[] = [];
  const numbers: Record<BoardKey, number> = { ...emptyBoardNumbers() };
  let reuseCount = 0;
  let createCount = 0;
  for (const key of BOARD_ORDER) {
    const reused = findExistingBoardNumber(existing, BOARD_TITLES[key]);
    if (reused !== null) {
      numbers[key] = reused;
      reuseCount++;
      lines.push(`reuse ${key} "${BOARD_TITLES[key]}" #${reused}`);
    } else {
      createCount++;
      lines.push(`create ${key} "${BOARD_TITLES[key]}"`);
    }
  }
  return { lines, reuseCount, createCount, boards: { ...numbers } };
}

/**
 * `--dry-run` の実行（読取のみ・作成呼出なし）。
 *
 * `listBoards` で既存を確認し、実行計画と確定番号JSONを返す。
 * `createBoard` は呼び出さない（実ボード新規作成の副作用なし）。
 *
 * @param owner ボード所有者（Organization または個人アカウント）
 * @param runner gh 呼出の実装（既定は実 gh 呼出）
 * @returns 計画表示（最終行に `--boards-json` 互換の番号JSONを含む）
 */
export async function dryRunBoards(
  owner: string,
  runner: BoardGhRunner = defaultBoardGhRunner,
): Promise<string> {
  if (!owner) {
    throw new Error(OWNER_REQUIRED_MESSAGE);
  }
  const existing = await runner.listBoards(owner);
  const plan = buildBoardsPlan(existing);
  return [
    `[DRY-RUN] owner: ${owner}`,
    ...plan.lines,
    `再利用${plan.reuseCount}件・作成${plan.createCount}件`,
    // 整形形式のJSON: 人間向け計画表示に埋め込むため可読性を優先する意図。
    // 機械受け渡し用（`--boards-json` 互換）は `runCreateBoards` の1行形式を用いる。
    JSON.stringify(plan.boards, null, 2),
  ].join("\n");
}

/**
 * `BoardGhRunner` の単一生成関数（WP #785 AC-1・レビュー指摘対応）。
 *
 * 既定 runner と env 付き runner の重複を一箇所に集約する。`env` 指定時は
 * `GH_TOKEN` の局所注入によりambient認証への暗黙依存を排除する（グローバル状態の
 * 書換は行わない）。`run` はテスト用の注入点。
 *
 * @param env 対象アカウントの env。未指定時はambient動作（後方互換）
 * @param run gh 実行関数（既定は実 gh 呼出）
 * @returns `BoardGhRunner`
 */
export function makeBoardGhRunner(
  env?: Record<string, string>,
  run: typeof runGh = runGh,
): BoardGhRunner {
  const exec = (args: string[]) => env ? run(args, { env }) : run(args);
  return {
    listBoards: async (owner: string) => {
      const result = await exec(["project", "list", "--owner", owner, "--format", "json"]);
      if (result.code !== 0) {
        throw new Error(`gh project list に失敗しました: ${result.stderr.trim()}`);
      }
      return parseProjectListJson(result.stdout);
    },
    createBoard: async (owner: string, title: string) => {
      const result = await exec(
        ["project", "create", "--owner", owner, "--title", title, "--format", "json"],
      );
      if (result.code !== 0) {
        throw new Error(`gh project create に失敗しました: ${result.stderr.trim()}`);
      }
      return parseProjectCreateJson(result.stdout);
    },
  };
}

/** 実 gh 呼出の既定実装（非同期IFに実非同期で応答する。`outputSync` の `Promise` 包みは行わない）。 */
export const defaultBoardGhRunner: BoardGhRunner = makeBoardGhRunner();

/**
 * 対象アイデンティティ認証の runner 生成関数（WP #785 AC-1）。
 *
 * `makeBoardGhRunner` の薄い別名（公開面の後方互換）。
 *
 * @param env 対象アカウントの env（`resolveGhEnvForAccount` の結果）
 * @returns env 付きの `BoardGhRunner`
 */
export function boardGhRunnerWithEnv(env: Record<string, string>): BoardGhRunner {
  return makeBoardGhRunner(env);
}

if (import.meta.main) {
  let opts: CreateBoardsArgs;
  try {
    opts = parseCreateBoardsArgs(Deno.args);
  } catch (error) {
    console.error(`${BOARDS_USAGE}\n${(error as Error).message}`);
    Deno.exit(1);
  }
  if (opts.help) {
    console.log(BOARDS_USAGE);
  } else {
    const target = resolveOwnerTarget(opts);
    const runner = resolveRunnerOrExit(target, defaultBoardGhRunner, boardGhRunnerWithEnv);
    const owner = target.owner || handleTargetOrExit(target);
    if (opts.dryRun) {
      console.log(await dryRunBoards(owner, runner));
    } else {
      console.log(await runCreateBoards(owner, runner));
    }
  }
}
