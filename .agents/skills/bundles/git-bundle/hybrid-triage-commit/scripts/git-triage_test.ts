/**
 * git-triage_test.ts — git-triage.ts の論理境界バリデーション機能のユニットテスト
 *
 * 検証対象:
 * - classifyFileType: ファイルパスから論理カテゴリを正しく分類できるか
 * - suggestTypeFromFiles: ファイル群から最適なコミットタイプを推奨できるか
 * - validateTypeConsistency: 異なる論理役割の混在を検出できるか
 */

import { assertEquals } from "@std/assert";
import { classifyFileType, suggestTypeFromFiles, validateTypeConsistency } from "./git-triage.ts";

/**
 * テスト用の StagedFile オブジェクトを生成するヘルパー。
 * @param path - ファイルパス
 * @param status - gitステータス（デフォルト: "M"）
 * @returns StagedFile オブジェクト
 */
interface StagedFile {
  path: string;
  status: string;
}

const mkFile = (path: string, status = "M"): StagedFile => ({ path, status });

Deno.test("classifyFileType - source files", () => {
  // .ts 拡張子のファイルは "source" に分類される
  assertEquals(classifyFileType("src/main.ts"), "source");
  assertEquals(classifyFileType("lib/utils.ts"), "source");
});

Deno.test("classifyFileType - test files", () => {
  // _test.ts で終わるファイルは "test" に分類される
  assertEquals(classifyFileType("src/main_test.ts"), "test");
  assertEquals(classifyFileType("lib/utils_test.ts"), "test");
});

Deno.test("classifyFileType - doc files", () => {
  // .md 拡張子のファイルは "docs" に分類される
  assertEquals(classifyFileType("README.md"), "docs");
  assertEquals(classifyFileType("docs/guide.md"), "docs");
});

Deno.test("classifyFileType - config files", () => {
  // .json / .jsonc のファイルは "config" に分類される
  assertEquals(classifyFileType("deno.json"), "config");
  assertEquals(classifyFileType(".vscode/settings.json"), "config");
  assertEquals(classifyFileType("tsconfig.jsonc"), "config");
});

Deno.test("classifyFileType - other files", () => {
  // 既知の拡張子以外は "other" に分類される
  assertEquals(classifyFileType("Makefile"), "other");
  assertEquals(classifyFileType("Dockerfile"), "other");
});

Deno.test("suggestTypeFromFiles - all test files suggests test", () => {
  // テストファイルのみで構成される場合、推奨タイプは "test"
  const result = suggestTypeFromFiles([
    mkFile("src/main_test.ts"),
    mkFile("lib/utils_test.ts"),
  ]);
  assertEquals(result, "test");
});

Deno.test("suggestTypeFromFiles - all doc files suggests docs", () => {
  // ドキュメントファイルのみで構成される場合、推奨タイプは "docs"
  const result = suggestTypeFromFiles([
    mkFile("README.md"),
    mkFile("docs/guide.md"),
  ]);
  assertEquals(result, "docs");
});

Deno.test("suggestTypeFromFiles - all config files suggests chore", () => {
  // 設定ファイルのみで構成される場合、推奨タイプは "chore"
  const result = suggestTypeFromFiles([
    mkFile("deno.json"),
    mkFile("tsconfig.jsonc"),
  ]);
  assertEquals(result, "chore");
});

Deno.test("suggestTypeFromFiles - all source files suggests feat", () => {
  // ソースファイルのみで構成される場合、推奨タイプは "feat"
  const result = suggestTypeFromFiles([
    mkFile("src/main.ts"),
    mkFile("lib/utils.ts"),
  ]);
  assertEquals(result, "feat");
});

Deno.test("suggestTypeFromFiles - mixed files returns null", () => {
  // 異なるカテゴリ（source + docs）が混在する場合、推奨不可 = null
  const result = suggestTypeFromFiles([
    mkFile("src/main.ts"),
    mkFile("README.md"),
  ]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - valid type passes", () => {
  // ソースファイルに feat タイプは適切 → 警告なし
  const result = validateTypeConsistency("feat", [mkFile("src/main.ts")]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - invalid type returns error", () => {
  // 存在しないコミットタイプを指定した場合、エラーメッセージを返す
  const result = validateTypeConsistency("invalid", [mkFile("src/main.ts")]);
  assertEquals(
    result,
    'invalid conventional commit type: "invalid". Valid types: feat, fix, docs, style, refactor, test, chore',
  );
});

Deno.test("validateTypeConsistency - docs type with non-doc files warns", () => {
  // docs タイプにソースコードが含まれる場合、警告メッセージを返す
  const result = validateTypeConsistency("docs", [mkFile("src/main.ts")]);
  assertEquals(result, 'type is "docs" but 1 non-documentation files are included');
});

Deno.test("validateTypeConsistency - docs type with only md files passes", () => {
  // docs タイプにドキュメントファイルのみ → 警告なし
  const result = validateTypeConsistency("docs", [mkFile("README.md")]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - test type with non-test files warns", () => {
  // test タイプに非テストファイルが含まれる場合、警告メッセージを返す
  const result = validateTypeConsistency("test", [mkFile("src/main.ts")]);
  assertEquals(result, 'type is "test" but 1 non-test files are included');
});

Deno.test("validateTypeConsistency - test type with test files passes", () => {
  // test タイプにテストファイルのみ → 警告なし
  const result = validateTypeConsistency("test", [mkFile("src/main_test.ts")]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - feat type with doc/config files warns", () => {
  // feat/fix/refactor タイプにドキュメントや設定ファイルが混在する場合、警告
  const featResult = validateTypeConsistency("feat", [
    mkFile("src/main.ts"),
    mkFile("README.md"),
  ]);
  assertEquals(featResult, 'type is "feat" but includes documentation/config files: README.md');

  const fixResult = validateTypeConsistency("fix", [
    mkFile("src/main.ts"),
    mkFile("deno.json"),
  ]);
  assertEquals(fixResult, 'type is "fix" but includes documentation/config files: deno.json');
});
