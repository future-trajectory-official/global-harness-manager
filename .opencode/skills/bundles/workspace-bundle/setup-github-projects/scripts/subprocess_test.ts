/**
 * subprocess モジュール（子プロセス実行・バイト列復号）のテスト（WP #763 レビュー指摘対応）。
 *
 * decodeUtf8 の復号と runCommandSync の成否分岐を検証する。
 * 実 gh 呼出は行わない（`gh` バイナリへの依存を避けるため `Deno.execPath()` を用いる）。
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { decodeUtf8, runCommandSync, runGh, runGhStatusSync } from "./subprocess.ts";

/**
 * ユースケース: バイト列をUTF-8文字列に復号できること
 * 検証意図: 日本語を含むバイト列が正しく復号されることを確認する
 */
Deno.test("decodeUtf8: バイト列をUTF-8文字列に復号する", () => {
  const bytes = new TextEncoder().encode("再利用3件・作成0件");
  assertEquals(decodeUtf8(bytes), "再利用3件・作成0件");
  assertEquals(decodeUtf8(new Uint8Array()), "");
});

/**
 * ユースケース: コマンドを同期実行できること
 * 検証意図: 正常終了時に終了コード0と出力が返ることを確認する
 */
Deno.test("runCommandSync: 正常終了時に出力を返す", () => {
  const result = runCommandSync(Deno.execPath(), ["--version"]);
  assertEquals(result.code, 0);
  assert(result.stdout.includes("deno"));
});

/**
 * ユースケース: 存在しないコマンドは Error になること
 * 検証意図: プロセス起動失敗時に日本語文言の Error を投げることを確認する
 */
Deno.test("異常系: 存在しないコマンドでErrorを投げる", () => {
  assertThrows(
    () => runCommandSync("definitely-not-a-command-xyz", []),
    Error,
    "呼出に失敗",
  );
});

/**
 * ユースケース: 起動失敗時は終了コード1の GhStatus に変換すること
 * 検証意図: runGhStatusSync が起動失敗を例外にせず GhStatus で返すことを確認する
 */
Deno.test("runGhStatusSync: 非ゼロ終了時にcodeを返す", () => {
  const result = runGhStatusSync(["project", "list", "--owner", "", "--format", "json"]);
  assert(typeof result.code === "number");
  assert(typeof result.stdout === "string");
  assert(typeof result.stderr === "string");
});

/**
 * ユースケース: env指定時も親環境を継承してghが実行できること
 * 検証意図: envが親環境の置換ではなくマージであること（PATH喪失による
 * 起動失敗の回帰を検出する。WP #785レビュー指摘C1のガード）
 */
Deno.test("runGh: env指定時も親環境を継承する", async () => {
  const result = await runGh(["--version"], { env: { GH_TOKEN: "dummy-token-for-test" } });
  assertEquals(result.code, 0);
  assert(result.stdout.includes("gh version"));
});
