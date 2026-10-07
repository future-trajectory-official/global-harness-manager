/**
 * create-boards／create-fields 共通のCLI引数パーサ（WP #763 レビュー指摘対応）。
 *
 * `--owner`／`--repo`／`--dry-run`／`--help` の解析を本モジュールに一元化し、
 * 両CLI間の文言driftを防止する。各CLI固有の要素（位置引数の解釈・固有フラグ・
 * 利用法文字列）は呼出元が担い、本モジュールは共通部分のみ扱う。
 *
 * 厳格化の仕様（両CLI同一）:
 * - 未知の `--*` フラグは `Error` を投げる（タイポ時の実作成への進行を防止）。
 * - 余剰の位置引数は各CLIの解析関数が利用法エラー（`Error`）として扱う。
 */

import type { TargetAccount } from "./resolve-target-account.ts";

/** 所有者未指定時に投げるエラーの文言（日英混在を排除した日本語文言）。 */
export const OWNER_REQUIRED_MESSAGE = "所有者の指定が必要です（Organization または個人アカウント）";

/** create-boards の利用法（`--help` 表示・引数エラーの報告で共用）。 */
export const BOARDS_USAGE =
  "usage: create-boards [--owner <owner>] [--repo <owner/repo>] [--dry-run] [<owner>]";

/** create-fields の利用法（`--help` 表示・引数エラーの報告で共用）。 */
export const FIELDS_USAGE =
  "usage: create-fields [--owner <owner>] [--repo <owner/repo>] [--dry-run] <board-number> <productBacklog|sprintBoard|retrospectiveBoard>";

/** 共通オプション（`--owner`／`--repo`／`--dry-run`／`--help`）の解析結果。 */
export interface CommonCliOptions {
  /** ボード所有者（`--owner`。未指定時は空文字）。 */
  readonly owner: string;
  /** 対象リポジトリの owner/repo（`--repo`。未指定時は null）。 */
  readonly repo: string | null;
  /** 作成を行わず実行計画の表示のみ行うか。 */
  readonly dryRun: boolean;
  /** 利用法を表示するか。 */
  readonly help: boolean;
}

/** 共通オプション解析の結果（共通オプション＋位置引数＋固有フラグ値）。 */
export interface CommonParseResult extends CommonCliOptions {
  /** `--` で始まらない位置引数（解釈は呼出元が行う）。 */
  readonly positionals: string[];
  /** 固有フラグ（`valueFlags` 指定）の値。キーはフラグ名（例: `--data-type`）。 */
  readonly extras: Record<string, string>;
}

/**
 * 共通オプションを解析する（純関数）。
 *
 * `Deno.args` 相当の引数列から共通オプションを抽出し、位置引数と固有フラグ値を
 * 分離して返す。未知の `--*` フラグは `Error` を投げる（タイポ時の実作成への
 * 進行を防止するため）。値欠落時も `Error` を投げる。
 *
 * @param args `Deno.args` 相当の引数列
 * @param opts 呼出元固有の値付きフラグ（キー: フラグ名、値: 値欠落時の文言）
 * @returns 共通オプション・位置引数・固有フラグ値
 */
export function parseCommonArgs(
  args: string[],
  opts: { readonly valueFlags?: Readonly<Record<string, string>> } = {},
): CommonParseResult {
  const valueFlags = opts.valueFlags ?? {};
  let owner = "";
  let repo: string | null = null;
  let dryRun = false;
  let help = false;
  const positionals: string[] = [];
  const extras: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--owner": {
        const value = args[++i];
        if (value === undefined) {
          throw new Error("--owner の値（Organization または個人アカウント）が指定されていません");
        }
        owner = value;
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
      default:
        if (arg.startsWith("--")) {
          const missingMessage = valueFlags[arg];
          if (missingMessage === undefined) {
            throw new Error(`未知のオプションです: ${arg}（--help で利用法を確認してください）`);
          }
          const value = args[++i];
          if (value === undefined) {
            throw new Error(missingMessage);
          }
          extras[arg] = value;
        } else {
          positionals.push(arg);
        }
        break;
    }
  }
  return { owner, repo, dryRun, help, positionals, extras };
}

/**
 * 解決済みの対象アカウントを検証し、所有者を返す。検証失敗時は終了する。
 *
 * create-boards／create-fields の `import.meta.main` 入口で重複していた
 * ガード（誘導文表示＋非ゼロ終了・所有者未特定時の報告＋非ゼロ終了）を集約した
 * 共通ハンドラ。`console.error` の文言・終了コード（1）は従来どおり不変。
 *
 * @param target `resolveOwnerTarget` の解決結果
 * @returns 検証済みのボード所有者（失敗時は戻らず終了コード1で終了する）
 */
export function handleTargetOrExit(target: TargetAccount): string {
  if (target.guidance) {
    console.error(target.guidance);
    Deno.exit(1);
  }
  if (!target.owner) {
    console.error("owner を特定できません。--owner または --repo を指定してください。");
    Deno.exit(1);
  }
  return target.owner;
}
