/**
 * 子プロセス実行・バイト列復号の共有ヘルパー（WP #763 レビュー指摘対応）。
 *
 * `create-boards.ts`・`create-fields.ts`・`resolve-target-account.ts` に分散していた
 * `decode`／`TextDecoder`／gh呼出エラーハンドリングの三重複を本モジュールに集約する。
 * バイト列復号は `decodeUtf8` に名称統一する。
 *
 * 同期・非同期の使い分け（見せかけの非同期の排除）:
 * - 公開IFが非同期の箇所（`BoardGhRunner`・`FieldGhRunner`）は `runGh`（実非同期・
 *   `Deno.Command.output` 使用）に統一し、`outputSync` の `Promise` 包みは行わない。
 * - 公開IFが同期の箇所（`resolve-target-account.ts` の既定依存）は `runCommandSync`
 *   に統一する。IFと実装の同期性が一致しているため見せかけの非同期には当たらない。
 */

import type { GhStatus } from "../../../../../core/shared/account/account-context.ts";

/** 子プロセス実行結果の最小表現（復号済み文字列）。 */
export interface CommandResult {
  /** 終了コード。 */
  readonly code: number;
  /** 標準出力（UTF-8復号済み）。 */
  readonly stdout: string;
  /** 標準エラー出力（UTF-8復号済み）。 */
  readonly stderr: string;
}

const utf8Decoder = new TextDecoder("utf-8");

/**
 * バイト列をUTF-8文字列に復号する。
 *
 * 旧名 `decode`（3モジュールで重複定義・変数名不統一）を本関数に統一した。
 *
 * @param output 復号対象のバイト列（子プロセスの標準出力・標準エラー出力）
 * @returns UTF-8復号済み文字列
 */
export function decodeUtf8(output: Uint8Array): string {
  return utf8Decoder.decode(output);
}

/**
 * コマンドを同期実行し、結果を復号済みで返す。
 *
 * 同期IFの既定依存（git remote取得等）から使用する。プロセス起動自体に失敗した
 * 場合は `Error` を投げる。非ゼロ終了は `Error` にせず `code` で返す
 * （呼出元が成否に応じた文言で報告するため）。
 *
 * @param cmd 実行コマンド名（例: `git`）
 * @param args コマンド引数
 * @returns 実行結果（終了コード・標準出力・標準エラー出力）
 */
export function runCommandSync(cmd: string, args: string[]): CommandResult {
  let result: Deno.CommandOutput;
  try {
    result = new Deno.Command(cmd, {
      args,
      stdout: "piped",
      stderr: "piped",
    }).outputSync();
  } catch (error) {
    throw new Error(`${cmd} 呼出に失敗しました: ${(error as Error).message}`);
  }
  return {
    code: result.code,
    stdout: decodeUtf8(result.stdout),
    stderr: decodeUtf8(result.stderr),
  };
}

/**
 * `gh` を実非同期で実行し、結果を復号済みで返す。
 *
 * 非同期IFの既定実装（`BoardGhRunner`・`FieldGhRunner`）から使用する。
 * `outputSync` の `Promise` 包み（見せかけの非同期）は行わず、
 * `Deno.Command.output` による実非同期に統一する。
 * プロセス起動自体に失敗した場合は `Error` を投げる。非ゼロ終了は `Error` にせず
 * `code` で返す（呼出元が操作種別に応じた文言で報告するため）。
 *
 * @param args `gh` への引数（例: `["project", "list", ...]`）
 * @returns 実行結果（終了コード・標準出力・標準エラー出力）
 */
export async function runGh(args: string[]): Promise<CommandResult> {
  let result: Deno.CommandOutput;
  try {
    result = await new Deno.Command("gh", {
      args,
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    throw new Error(`gh 呼出に失敗しました: ${(error as Error).message}`);
  }
  return {
    code: result.code,
    stdout: decodeUtf8(result.stdout),
    stderr: decodeUtf8(result.stderr),
  };
}

/**
 * `gh` の実行結果を `GhStatus` 形式で返す（`verifyGhAuth` への注入用）。
 *
 * 同期IFの既定依存（`defaultGhStatus`）から使用する。起動失敗時は従来どおり
 * 終了コード1の `GhStatus` に変換する（既存振る舞いを維持）。
 *
 * @param args `gh` への引数（例: `["auth", "status"]`）
 * @returns `gh` 実行結果の `GhStatus` 表現
 */
export function runGhStatusSync(args: string[]): GhStatus {
  try {
    return runCommandSync("gh", args);
  } catch (error) {
    return { code: 1, stdout: "", stderr: (error as Error).message };
  }
}
