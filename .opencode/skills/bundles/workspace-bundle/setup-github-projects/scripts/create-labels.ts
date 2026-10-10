/**
 * リポジトリのハーネス用 Issue ラベル作成機能。
 *
 * 作成対象は `.opencode/core/domain/label-types.ts` の `LabelTypes`
 * （`getAllLabelDefinitions()`）に準拠する。定義の直書きは禁止し、
 * 正の定義へのドリフトは `create-labels_test.ts` の準拠テストで検出する。
 * 既存ラベルはスキップし、不足分のみ作成する。削除・改名・型変更は行わない
 * （破壊防止）。
 *
 * 正の定義は `.opencode/core/domain/label-types.ts` を参照。
 */

import {
  getAllLabelDefinitions,
  type LabelDefinition,
} from "../../../../../core/domain/label-types.ts";
import { resolveOwnerTarget } from "./resolve-target-account.ts";
import { handleTargetOrExit, LABELS_USAGE, parseCommonArgs } from "./cli-args.ts";
import { resolveRunnerOrExit } from "./gh-auth-env.ts";
import { runGh } from "./subprocess.ts";

/** gh 呼出の注入点（テスト用に差し替え可能）。 */
export interface LabelGhRunner {
  /**
   * リポジトリ上の既存ラベル名一覧を取得する。
   *
   * @param repo 対象リポジトリ（`owner/repo`）
   */
  readonly listLabels: (repo: string) => Promise<readonly string[]>;
  /**
   * ラベルを1件作成する。
   *
   * @param repo 対象リポジトリ（`owner/repo`）
   * @param label 作成するラベルの定義（`LabelTypes` の要素）
   */
  readonly createLabel: (repo: string, label: LabelDefinition) => Promise<void>;
}

/**
 * `ensureLabels()` の実行結果。
 *
 * 作成・スキップ・失敗を区別できる構造体。
 * - `created`: 新規作成したラベル名
 * - `skipped`: 既存のためスキップしたラベル名
 * - `failed`: 作成に失敗したラベル名
 */
export interface EnsureLabelsResult {
  readonly created: string[];
  readonly skipped: string[];
  readonly failed: { readonly label: string; readonly error: string }[];
}

/**
 * 作成対象のラベル定義一覧を返す（純関数）。
 *
 * 戻り値は `getAllLabelDefinitions()` と同一であり、正の定義へのドリフトは
 * `create-labels_test.ts` の準拠テストで検出する。
 *
 * @returns 作成対象のラベル定義一覧
 */
export function labelsToCreate(): readonly LabelDefinition[] {
  return getAllLabelDefinitions();
}

/**
 * 不足ラベルのみ作成し、作成・スキップ・失敗を区別して返す。
 *
 * 既存ラベルはスキップする。作成に失敗したラベルは `failed` に含める。
 *
 * @param repo 対象リポジトリ（`owner/repo`）
 * @param runner gh 呼出の実装（既定は実 gh 呼出）
 * @returns 作成・スキップ・失敗を区別した実行結果
 */
export async function ensureLabels(
  repo: string,
  runner: LabelGhRunner = defaultLabelGhRunner,
): Promise<EnsureLabelsResult> {
  const existing = new Set(await runner.listLabels(repo));
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: EnsureLabelsResult["failed"][number][] = [];
  for (const label of labelsToCreate()) {
    if (existing.has(label.name)) {
      skipped.push(label.name);
      continue;
    }
    try {
      await runner.createLabel(repo, label);
      created.push(label.name);
    } catch (error) {
      failed.push({
        label: label.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { created, skipped, failed };
}

/**
 * `gh label list --json` の生出力を解析する（純関数）。
 *
 * 実形式 `[{"name":N,"color":C,"description":D},...]` をラベル名一覧に
 * 変換する。不正JSON時・配列外形式時は `Error` を投げる。
 * 名前を持たない要素は除外する。
 *
 * @param raw `gh label list --json name,color,description` の標準出力
 * @returns 検出したラベル名一覧
 */
export function parseLabelListJson(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("gh label list の JSON 形式が不正です");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("gh label list の結果が配列ではありません");
  }
  return (parsed as Array<{ name?: unknown }>).flatMap((label) =>
    typeof label?.name === "string" ? [label.name] : []
  );
}

/** CLI引数の解析結果。 */
export interface CreateLabelsArgs {
  /** 対象リポジトリの owner/repo（`--repo`。未指定時は null）。 */
  readonly repo: string | null;
  /** 所有者オーバーライド（ラベル操作は repo スコープのため常に空文字）。 */
  readonly owner: string;
  /** 作成を行わず実行計画の表示のみ行うか。 */
  readonly dryRun: boolean;
  /** 利用法を表示するか。 */
  readonly help: boolean;
}

/**
 * CLI引数を解析する（純関数）。
 *
 * 対応: `--repo <owner/repo>` / `--dry-run` / `--help`。
 * 共通オプションの解析は `cli-args.ts` の `parseCommonArgs` に委譲する。
 * 未知の `--*` フラグ・各フラグの値欠落時は `Error` を投げる。
 * 余剰の位置引数がある場合は `Error` を投げる（ラベル作成に対象指定は
 * `--repo` のみを用い、位置引数は受け付けない）。
 * `--owner` は明示指定時に `Error` を投げる（ラベル操作は repo スコープで
 * あり所有者指定の効果がないため、誤解を招く指定は fail-fast で拒否する）。
 *
 * @param args `Deno.args` 相当の引数列
 * @returns 解析済み引数
 */
export function parseCreateLabelsArgs(args: string[]): CreateLabelsArgs {
  const common = parseCommonArgs(args);
  if (common.owner !== "") {
    throw new Error(
      `--owner はサポートしていません（利用法: ${LABELS_USAGE}）`,
    );
  }
  if (common.positionals.length > 0) {
    throw new Error(
      `余剰の位置引数があります: ${common.positionals.join(" ")}（利用法: ${LABELS_USAGE}）`,
    );
  }
  return {
    repo: common.repo,
    owner: common.owner,
    dryRun: common.dryRun,
    help: common.help,
  };
}

/** 実行計画の組み立て結果（純関数 `buildLabelsPlan` の戻り値）。 */
export interface LabelsPlan {
  /** 人間向け計画行（`skip ...` / `create ...`）。 */
  readonly lines: string[];
  /** 既存のためスキップする件数。 */
  readonly skipCount: number;
  /** 新規作成する件数。 */
  readonly createCount: number;
  /** 新規作成対象のラベル定義。 */
  readonly toCreate: LabelDefinition[];
}

/**
 * 既存一覧から実行計画を組み立てる（純関数・副作用なし）。
 *
 * 作成対象は `labelsToCreate()` に準拠し、既存分はスキップする。
 *
 * @param existing 既存ラベル名一覧
 * @returns 実行計画
 */
export function buildLabelsPlan(existing: readonly string[]): LabelsPlan {
  const known = new Set(existing);
  const lines: string[] = [];
  const toCreate: LabelDefinition[] = [];
  let skipCount = 0;
  for (const label of labelsToCreate()) {
    if (known.has(label.name)) {
      skipCount++;
      lines.push(`skip "${label.name}"`);
    } else {
      toCreate.push(label);
      lines.push(`create "${label.name}"`);
    }
  }
  return { lines, skipCount, createCount: toCreate.length, toCreate };
}

/**
 * `--dry-run` の実行（読取のみ・作成呼出なし）。
 *
 * `listLabels` で既存を確認し、実行計画を返す。
 * `createLabel` は呼び出さない（実ラベル新規作成の副作用なし）。
 *
 * @param repo 対象リポジトリ（`owner/repo`）
 * @param runner gh 呼出の実装（既定は実 gh 呼出）
 * @returns 計画表示（`スキップN件・作成M件` を含む）
 */
export async function dryRunLabels(
  repo: string,
  runner: LabelGhRunner = defaultLabelGhRunner,
): Promise<string> {
  const existing = await runner.listLabels(repo);
  const plan = buildLabelsPlan(existing);
  return [
    `[DRY-RUN] repo: ${repo}`,
    ...plan.lines,
    `スキップ${plan.skipCount}件・作成${plan.createCount}件`,
  ].join("\n");
}

/**
 * `LabelGhRunner` の単一生成関数。
 *
 * `makeFieldGhRunner` と同様、env 付き runner と既定 runner の重複を
 * 一箇所に集約する。`env` 指定時は `GH_TOKEN` の局所注入によりambient認証への
 * 暗黙依存を排除する（グローバル状態の書換は行わない）。`run` はテスト用の注入点。
 *
 * @param env 対象アカウントの env。未指定時はambient動作（後方互換）
 * @param run gh 実行関数（既定は実 gh 呼出）
 * @returns `LabelGhRunner`
 */
export function makeLabelGhRunner(
  env?: Record<string, string>,
  run: typeof runGh = runGh,
): LabelGhRunner {
  const exec = (args: string[]) => env ? run(args, { env }) : run(args);
  return {
    listLabels: async (repo: string) => {
      const result = await exec([
        "label",
        "list",
        "--repo",
        repo,
        "--json",
        "name,color,description",
        "--limit",
        "100",
      ]);
      if (result.code !== 0) {
        throw new Error(
          `gh label list に失敗しました: ${result.stderr.trim()}`,
        );
      }
      return parseLabelListJson(result.stdout);
    },
    createLabel: async (repo: string, label: LabelDefinition) => {
      const result = await exec([
        "label",
        "create",
        label.name,
        "--repo",
        repo,
        "--color",
        label.color.replace(/^#/, ""),
        "--description",
        label.description,
      ]);
      if (result.code !== 0) {
        throw new Error(
          `gh label create に失敗しました: ${result.stderr.trim()}`,
        );
      }
    },
  };
}

/** 実 gh 呼出の既定実装。 */
export const defaultLabelGhRunner: LabelGhRunner = makeLabelGhRunner();

/**
 * 対象アイデンティティ認証の runner 生成関数。
 *
 * `labelGhRunnerWithEnv` の薄い別名に相当する公開面（`fieldGhRunnerWithEnv`
 * との対称性を保つ）。
 *
 * @param env 対象アカウントの env（`resolveGhEnvForAccount` の結果）
 * @returns env 付きの `LabelGhRunner`
 */
export function labelGhRunnerWithEnv(env: Record<string, string>): LabelGhRunner {
  return makeLabelGhRunner(env);
}

if (import.meta.main) {
  let opts: CreateLabelsArgs;
  try {
    opts = parseCreateLabelsArgs(Deno.args);
  } catch (error) {
    console.error(`${LABELS_USAGE}\n${(error as Error).message}`);
    Deno.exit(1);
  }
  if (opts.help) {
    console.log(LABELS_USAGE);
  } else if (!opts.repo || !opts.repo.includes("/")) {
    console.error(`${LABELS_USAGE}\n--repo の値（owner/repo）が指定されていません`);
    Deno.exit(1);
  } else {
    const target = resolveOwnerTarget(opts);
    const runner = resolveRunnerOrExit(target, defaultLabelGhRunner, labelGhRunnerWithEnv);
    handleTargetOrExit(target);
    if (opts.dryRun) {
      console.log(await dryRunLabels(opts.repo, runner));
    } else {
      // 1行形式のJSON: 機械可読を優先する意図（`--dry-run` の人間向け計画表示とは区別）。
      console.log(JSON.stringify(await ensureLabels(opts.repo, runner)));
    }
  }
}
