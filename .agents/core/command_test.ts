import { assertEquals, assertStringIncludes } from "@std/assert";
import { executeCommand } from "./command.ts";

Deno.test("command - executeCommand should run in PROJECT_ROOT by default", async () => {
  // プロジェクトルートにあるはずの deno.json を確認するコマンドを実行
  const result = await executeCommand({
    cmd: "ls",
    args: ["deno.json"],
  });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "deno.json");
});

Deno.test("command - executeCommand should respect custom cwd", async () => {
  const result = await executeCommand({
    cmd: "ls",
    args: ["constants.ts"],
    cwd: "./.agents/core",
  });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "constants.ts");
});

Deno.test("command - executeCommand should support dryRun mode", async () => {
  const result = await executeCommand({
    cmd: "echo",
    args: ["hello"],
    dryRun: true,
  });

  assertEquals(result.code, 0);
  assertEquals(result.stdout, "");
});

Deno.test("command - executeCommand should support interactive mode", async () => {
  // 実際に入力を待つとテストが止まるため、すぐに終了するコマンドでテスト
  const result = await executeCommand({
    cmd: "true",
    interactive: true,
  });

  assertEquals(result.code, 0);
});

Deno.test("command - executeCommand should handle command failure and return non-zero code", async () => {
  const result = await executeCommand({
    cmd: "ls",
    args: ["non-existent-file-12345"],
  });

  assertEquals(result.code, 2); // ls returns 2 for not found on many systems
  assertStringIncludes(result.stderr, "No such file or directory");
});

Deno.test("command - executeCommand should support custom environment variables", async () => {
  const result = await executeCommand({
    cmd: "sh",
    args: ["-c", "echo $TEST_VAR"],
    env: { TEST_VAR: "harness-test" },
  });

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, "harness-test");
});

Deno.test("command - executeCommand should handle failure without stderr", async () => {
  // 標準エラーを出さずに終了コード 1 を返す
  const result = await executeCommand({
    cmd: "sh",
    args: ["-c", "exit 1"],
  });

  assertEquals(result.code, 1);
  assertEquals(result.stderr, "");
});

Deno.test("command - executeCommand should return non-zero code for invalid command (exception path)", async () => {
  const result = await executeCommand({
    cmd: "non-existent-command-xyz",
  });

  assertEquals(result.code, 1);
  assertStringIncludes(result.stderr, "entity not found");
});
