/**
 * GitHub Project V2 カスタムフィールド作成機能（WP #763 AC-1）。
 *
 * 作成対象は `BOARD_FIELDS[board]` に準拠する。`HARNESS_FIELDS` の直書きは禁止し、
 * `BOARD_FIELDS`（および必要時は `FIELD`）のみを参照する。既存フィールドは
 * スキップし、不足分のみ作成する。削除・型変更は行わない（破壊防止）。
 *
 * フィールド型は `gh project field-list` の実査を前提とし、型未確定でも動作する
 * よう型名は引数化する（既定は TEXT）。型が不明な場合は作成を中断して PO へ
 * 報告すること（下記 PO 報告ガード参照）。
 *
 * 正の定義は `.opencode/core/gateway/field-registry.ts` の `BOARD_FIELDS` を参照。
 */

import { BOARD_FIELDS, type BoardKey } from "../../../../../core/gateway/field-registry.ts";
import { resolveOwnerTarget } from "./resolve-target-account.ts";
import { FIELDS_USAGE, handleTargetOrExit, parseCommonArgs } from "./cli-args.ts";
import { resolveRunnerOrExit } from "./gh-auth-env.ts";
import { runGh } from "./subprocess.ts";

/** gh 呼出の注入点（テスト用に差し替え可能）。 */
export interface FieldGhRunner {
  /**
   * ボード上の既存フィールド名一覧を取得する。
   *
   * @param boardNumber 対象ボードの番号
   * @param owner ボード所有者（Organization または個人アカウント。空文字時は省略）
   */
  readonly listFields: (
    boardNumber: number,
    owner: string,
  ) => Promise<readonly string[]>;
  /**
   * フィールドを1件作成する。
   *
   * @param boardNumber 対象ボードの番号
   * @param owner ボード所有者（Organization または個人アカウント。空文字時は省略）
   * @param name 作成するフィールド名（`BOARD_FIELDS[board]` の要素）
   * @param dataType 作成時のフィールド型（既定は TEXT）
   */
  readonly createField: (
    boardNumber: number,
    owner: string,
    name: string,
    dataType: string,
  ) => Promise<void>;
}

/** フィールド型未確定時の既定値（`gh project field-create --data-type` に渡す）。 */
export const DEFAULT_FIELD_DATA_TYPE = "TEXT";

/**
 * 指定ボードの作成対象フィールド名を返す（純関数）。
 *
 * 戻り値は `BOARD_FIELDS[board]` と同一であり、正の定義へのドリフトは
 * `create-fields_test.ts` の準拠テストで検出する。
 *
 * @param board ボード識別子（`BOARDS` のキー）
 * @returns 作成対象のフィールド名一覧（`BOARD_FIELDS[board]` と同一参照）
 */
export function fieldsForBoard(board: BoardKey): readonly string[] {
  return BOARD_FIELDS[board];
}

/**
 * 不足フィールドのみ作成し、作成した名前を返す。
 *
 * 既存フィールドはスキップする。
 *
 * PO 報告ガード: `dataType` が不明な場合（実査で型が確定できない場合）は
 * 本関数を呼ばず、PO へ「ボード番号・フィールド名・`gh project field-list` の
 * 実査結果」を報告して指示を仰ぐこと。推測で型を決めて作成してはならない。
 *
 * @param boardNumber 対象ボードの番号
 * @param board ボード識別子（`BOARDS` のキー）
 * @param runner gh 呼出の実装（既定は実 gh 呼出）
 * @param dataType 作成時のフィールド型（既定は TEXT）
 * @param owner ボード所有者（Organization または個人アカウント。空文字時は `--owner` を省略）
 * @returns 新規作成したフィールド名
 */
export async function ensureFields(
  boardNumber: number,
  board: BoardKey,
  runner: FieldGhRunner = defaultFieldGhRunner,
  dataType: string = DEFAULT_FIELD_DATA_TYPE,
  owner = "",
): Promise<string[]> {
  const existing = new Set(await runner.listFields(boardNumber, owner));
  const created: string[] = [];
  for (const name of fieldsForBoard(board)) {
    if (existing.has(name)) {
      continue;
    }
    await runner.createField(boardNumber, owner, name, dataType);
    created.push(name);
  }
  return created;
}

/**
 * `gh project field-list --format json` の生出力を解析する（純関数）。
 *
 * 実形式 `{"fields":[{"id":...,"name":N,"type":T,...}],"totalCount":N}` を
 * フィールド名一覧に変換する。不正JSON時は `Error` を投げる。
 * 名前を持たない要素は除外する。
 *
 * @param raw `gh project field-list --format json` の標準出力
 * @returns 検出したフィールド名一覧
 */
export function parseFieldListJson(raw: string): string[] {
  let parsed: { fields?: Array<{ name?: unknown }> };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("gh project field-list の JSON 形式が不正です");
  }
  return (parsed.fields ?? []).flatMap((field) =>
    typeof field.name === "string" ? [field.name] : []
  );
}

/** CLI引数の解析結果。 */
export interface CreateFieldsArgs {
  /** 対象ボードの番号（不正時は0）。 */
  readonly boardNumber: number;
  /** ボード識別子（`BOARDS` のキー。不正時は空文字）。 */
  readonly board: string;
  /** ボード所有者（`--owner`。未指定時は空文字）。 */
  readonly owner: string;
  /** 対象リポジトリの owner/repo（`--repo`。未指定時は null）。 */
  readonly repo: string | null;
  /** 作成時のフィールド型（`--data-type`。既定は TEXT）。 */
  readonly dataType: string;
  /** 作成を行わず実行計画の表示のみ行うか。 */
  readonly dryRun: boolean;
  /** 利用法を表示するか。 */
  readonly help: boolean;
}

/**
 * CLI引数を解析する（純関数）。
 *
 * 対応: `<board-number> <board>` / `--owner <owner>` / `--repo <owner/repo>` /
 * `--data-type <type>` / `--dry-run` / `--help`。共通オプションの解析は
 * `cli-args.ts` の `parseCommonArgs` に委譲する（`--data-type` は固有の値付き
 * フラグとして受ける）。未知の `--*` フラグ・各フラグの値欠落時・余剰の
 * 位置引数（3件目以降）がある場合は `Error` を投げる。
 *
 * `--owner` 明示時はそれを優先する（後方互換）。未指定時は `--repo`
 * （未指定時は git remote）から `resolve-target-account.ts` で解決する。
 * `--owner` 明示時も gh 認証の検証は行う（`resolveOwnerTarget` が担う）。
 *
 * @param args `Deno.args` 相当の引数列
 * @returns 解析済み引数
 */
export function parseCreateFieldsArgs(args: string[]): CreateFieldsArgs {
  const common = parseCommonArgs(args, {
    valueFlags: { "--data-type": "--data-type の値（TEXT等）が指定されていません" },
  });
  const dataType = common.extras["--data-type"] ?? DEFAULT_FIELD_DATA_TYPE;
  const positionals = common.positionals;
  if (positionals.length > 2) {
    throw new Error(
      `余剰の位置引数があります: ${positionals.slice(2).join(" ")}（利用法: ${FIELDS_USAGE}）`,
    );
  }
  let boardNumber = 0;
  let board = "";
  if (positionals.length > 0) {
    const parsed = Number(positionals[0]);
    boardNumber = Number.isInteger(parsed) ? parsed : 0;
  }
  if (positionals.length > 1) {
    board = positionals[1];
  }
  return {
    boardNumber,
    board,
    owner: common.owner,
    repo: common.repo,
    dataType,
    dryRun: common.dryRun,
    help: common.help,
  };
}

/** 実行計画の組み立て結果（純関数 `buildFieldsPlan` の戻り値）。 */
export interface FieldsPlan {
  /** 人間向け計画行（`skip ...` / `create ...`）。 */
  readonly lines: string[];
  /** 既存のためスキップする件数。 */
  readonly skipCount: number;
  /** 新規作成する件数。 */
  readonly createCount: number;
  /** 新規作成対象のフィールド名。 */
  readonly toCreate: string[];
}

/**
 * 既存一覧から実行計画を組み立てる（純関数・副作用なし）。
 *
 * 作成対象は `BOARD_FIELDS[board]` に準拠し、既存分はスキップする。
 *
 * @param board ボード識別子（`BOARDS` のキー）
 * @param existing 既存フィールド名一覧
 * @returns 実行計画
 */
export function buildFieldsPlan(
  board: BoardKey,
  existing: readonly string[],
): FieldsPlan {
  const known = new Set(existing);
  const lines: string[] = [];
  const toCreate: string[] = [];
  let skipCount = 0;
  for (const name of fieldsForBoard(board)) {
    if (known.has(name)) {
      skipCount++;
      lines.push(`skip ${board} "${name}"`);
    } else {
      toCreate.push(name);
      lines.push(`create ${board} "${name}"`);
    }
  }
  return { lines, skipCount, createCount: toCreate.length, toCreate };
}

/**
 * `--dry-run` の実行（読取のみ・作成呼出なし）。
 *
 * `listFields` で既存を確認し、実行計画を返す。
 * `createField` は呼び出さない（実フィールド新規作成の副作用なし）。
 *
 * @param boardNumber 対象ボードの番号
 * @param board ボード識別子（`BOARDS` のキー）
 * @param runner gh 呼出の実装（既定は実 gh 呼出）
 * @param dataType 作成時のフィールド型（既定は TEXT。計画表示のみに使用）
 * @param owner ボード所有者（Organization または個人アカウント。空文字時は省略）
 * @returns 計画表示（`スキップN件・作成M件` を含む）
 */
export async function dryRunFields(
  boardNumber: number,
  board: BoardKey,
  runner: FieldGhRunner = defaultFieldGhRunner,
  dataType: string = DEFAULT_FIELD_DATA_TYPE,
  owner = "",
): Promise<string> {
  const existing = await runner.listFields(boardNumber, owner);
  const plan = buildFieldsPlan(board, existing);
  return [
    `[DRY-RUN] board: ${board} #${boardNumber} owner: ${
      owner || "(default)"
    } data-type: ${dataType}`,
    ...plan.lines,
    `スキップ${plan.skipCount}件・作成${plan.createCount}件`,
  ].join("\n");
}

/**
 * `FieldGhRunner` の単一生成関数（WP #785 AC-1・レビュー指摘対応）。
 *
 * 既定 runner と env 付き runner の重複を一箇所に集約する。`env` 指定時は
 * `GH_TOKEN` の局所注入によりambient認証への暗黙依存を排除する（グローバル状態の
 * 書換は行わない）。`run` はテスト用の注入点。
 *
 * @param env 対象アカウントの env。未指定時はambient動作（後方互換）
 * @param run gh 実行関数（既定は実 gh 呼出）
 * @returns `FieldGhRunner`
 */
export function makeFieldGhRunner(
  env?: Record<string, string>,
  run: typeof runGh = runGh,
): FieldGhRunner {
  const exec = (args: string[]) => env ? run(args, { env }) : run(args);
  return {
    listFields: async (boardNumber: number, owner: string) => {
      const args = ["project", "field-list", String(boardNumber), "--format", "json"];
      if (owner) {
        args.push("--owner", owner);
      }
      const result = await exec(args);
      if (result.code !== 0) {
        throw new Error(
          `gh project field-list に失敗しました: ${result.stderr.trim()}`,
        );
      }
      return parseFieldListJson(result.stdout);
    },
    createField: async (
      boardNumber: number,
      owner: string,
      name: string,
      dataType: string,
    ) => {
      const args = ["project", "field-create", String(boardNumber)];
      if (owner) {
        args.push("--owner", owner);
      }
      args.push("--name", name, "--data-type", dataType);
      const result = await exec(args);
      if (result.code !== 0) {
        throw new Error(
          `gh project field-create に失敗しました: ${result.stderr.trim()}`,
        );
      }
    },
  };
}

/** 実 gh 呼出の既定実装（非同期IFに実非同期で応答する。`outputSync` の `Promise` 包みは行わない）。 */
export const defaultFieldGhRunner: FieldGhRunner = makeFieldGhRunner();

/**
 * 対象アイデンティティ認証の runner 生成関数（WP #785 AC-1）。
 *
 * `makeFieldGhRunner` の薄い別名（公開面の後方互換）。
 *
 * @param env 対象アカウントの env（`resolveGhEnvForAccount` の結果）
 * @returns env 付きの `FieldGhRunner`
 */
export function fieldGhRunnerWithEnv(env: Record<string, string>): FieldGhRunner {
  return makeFieldGhRunner(env);
}

if (import.meta.main) {
  let opts: CreateFieldsArgs;
  try {
    opts = parseCreateFieldsArgs(Deno.args);
  } catch (error) {
    console.error(`${FIELDS_USAGE}\n${(error as Error).message}`);
    Deno.exit(1);
  }
  if (opts.help) {
    console.log(FIELDS_USAGE);
  } else if (
    !Number.isInteger(opts.boardNumber) || opts.boardNumber <= 0 ||
    !Object.hasOwn(BOARD_FIELDS, opts.board)
  ) {
    console.error(FIELDS_USAGE);
    Deno.exit(1);
  } else {
    const target = resolveOwnerTarget(opts);
    const runner = resolveRunnerOrExit(target, defaultFieldGhRunner, fieldGhRunnerWithEnv);
    const owner = target.owner || handleTargetOrExit(target);
    if (opts.dryRun) {
      console.log(
        await dryRunFields(
          opts.boardNumber,
          opts.board as BoardKey,
          runner,
          opts.dataType,
          owner,
        ),
      );
    } else {
      // 1行形式のJSON: 機械可読を優先する意図（`--dry-run` の人間向け計画表示とは区別）。
      console.log(
        JSON.stringify(
          await ensureFields(
            opts.boardNumber,
            opts.board as BoardKey,
            runner,
            opts.dataType,
            owner,
          ),
        ),
      );
    }
  }
}
