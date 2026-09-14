/**
 * GitHub Operations 設計原則遵守の検証用 grep ターゲット定数。
 * テストで grep 検証を行う際に使用する。
 */

/** body への `parent: #N` 追記 workaround を禁止 */
export const PARENT_STRING_TARGET = "parent:";

/** GraphQL クエリ内の文字列エスケープ `replace(/"/g, ...)` を禁止 */
export const REPLACE_QUOTE_TARGET = 'replace(/\\"'; // 検索対象として `replace(/\"` を grep

/** gh 呼び出しに `--repo` フラグが必須 */
export const REPO_FLAG_TARGET = "--repo"; // 簡易 grep ターゲット
// 注意: 正確な検証は `gh` 呼び出しの各コマンドライン引数で `--repo owner/repo` 形式を確認する
// ここでは grep ターゲット文字列として定義する

/** 型名・クラス名の命名規則検証（省略形禁止） */
export const ABBREVIATION_TARGETS = ["ctx", "repo", "opts", "num"];

/**
 * 指定された文字列がコード内に存在しないことを検証するためのヘルパー。
 * @param code - 検索対象のコード文字列
 * @param forbidden - 禁止文字列の配列
 * @returns 検出された禁止文字列の配列
 */
export function findForbiddenStrings(code: string, forbidden: string[]): string[] {
  const found: string[] = [];
  for (const str of forbidden) {
    if (code.includes(str)) {
      found.push(str);
    }
  }
  return found;
}
