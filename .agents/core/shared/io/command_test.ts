import { assertEquals, assertStringIncludes } from "@std/assert";
import { executeCommand } from "./command.ts";

/**
 * command - executeCommand がデフォルトで PROJECT_ROOT で実行されることを検証する。
 * プロジェクトルートにある deno.json を ls で参照できることで、カレントディレクトリが
 * 期待通りであることを確認する。
 */
Deno.test("command - executeCommand should run in PROJECT_ROOT by default", async () => {
  // プロジェクトルートにあるはずの deno.json を確認するコマンドを実行
  const result = await executeCommand({
    cmd: "ls",
    args: ["deno.json"],
  });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "deno.json");
});

/**
 * command - executeCommand にカスタム cwd を指定して実行できることを検証する。
 * .agents/core ディレクトリを cwd として指定し、そのディレクトリ内のファイルが
 * 参照できることを確認する。
 */
Deno.test("command - executeCommand should respect custom cwd", async () => {
  const result = await executeCommand({
    cmd: "ls",
    args: ["harness-core.ts"],
    cwd: "./.agents/core",
  });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "harness-core.ts");
});

/**
 * command - executeCommand の dryRun モードでコマンドが実行されないことを検証する。
 * dryRun=true の場合、stdout が空で code=0 が返されることを確認する。
 */
Deno.test("command - executeCommand should support dryRun mode", async () => {
  const result = await executeCommand({
    cmd: "echo",
    args: ["hello"],
    dryRun: true,
  });

  assertEquals(result.code, 0);
  assertEquals(result.stdout, "");
});

/**
 * command - executeCommand の interactive モードでコマンドが実行できることを検証する。
 * 対話的なコマンド（即座に終了する true コマンド）で interactive=true が
 * 正常に動作することを確認する。
 */
Deno.test("command - executeCommand should support interactive mode", async () => {
  // 実際に入力を待つとテストが止まるため、すぐに終了するコマンドでテスト
  const result = await executeCommand({
    cmd: "true",
    interactive: true,
  });

  assertEquals(result.code, 0);
});

/**
 * command - executeCommand がコマンド失敗時に非ゼロの終了コードを返すことを検証する。
 * 存在しないファイルを ls した場合に code=2 が返される異常系を確認する。
 */
Deno.test("command - executeCommand should handle command failure and return non-zero code", async () => {
  const result = await executeCommand({
    cmd: "ls",
    args: ["non-existent-file-12345"],
  });

  assertEquals(result.code, 2); // ls returns 2 for not found on many systems
  assertStringIncludes(result.stderr, "No such file or directory");
});

/**
 * command - executeCommand にカスタム環境変数を渡せることを検証する。
 * env オプションで指定した TEST_VAR が子プロセスから参照できることを確認する。
 */
Deno.test("command - executeCommand should support custom environment variables", async () => {
  const result = await executeCommand({
    cmd: "sh",
    args: ["-c", "echo $TEST_VAR"],
    env: { TEST_VAR: "harness-test" },
  });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "harness-test");
});

/**
 * command - executeCommand が標準エラー出力なしで失敗した場合の動作を検証する。
 * `exit 1` のように stderr を出力せずにエラー終了するコマンドで code=1 かつ
 * stderr が空文字になることを確認する。
 */
Deno.test("command - executeCommand should handle failure without stderr", async () => {
  // 標準エラーを出さずに終了コード 1 を返す
  const result = await executeCommand({
    cmd: "sh",
    args: ["-c", "exit 1"],
  });

  assertEquals(result.code, 1);
  assertEquals(result.stderr, "");
});

/**
 * command - executeCommand が存在しないコマンド実行時に例外パスを通じて
 * 非ゼロコードを返すことを検証する。存在しないバイナリを実行した場合に code=1 かつ
 * エラーメッセージが stderr に出力されることを確認する。
 */
Deno.test("command - executeCommand should return non-zero code for invalid command (exception path)", async () => {
  const result = await executeCommand({
    cmd: "non-existent-command-xyz",
  });

  assertEquals(result.code, 1);
  assertStringIncludes(result.stderr, "entity not found");
});
