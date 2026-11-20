import { assertEquals } from "@std/assert";
import { stub } from "@std/testing/mock";
import { logger } from "./logger.ts";

/**
 * logger - logger オブジェクトが期待する全メソッド（info/warn/error/dryRun/success/debug）を
 * 備えていることを検証する。インターフェースの完全性を確認する。
 */
Deno.test("logger - should provide all expected methods", () => {
  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
  assertEquals(typeof logger.dryRun, "function");
  assertEquals(typeof logger.success, "function");
  assertEquals(typeof logger.debug, "function");
});

/**
 * logger - 全ログ出力メソッドを呼び出しても例外が発生しないことを検証する。
 * コンソール出力の内容ではなく、メソッドの実行自体が安全であることを確認する。
 */
Deno.test("logger - methods should execute without throwing", () => {
  // コンソール出力されるため、例外が起きないことだけを確認
  logger.info("Test info");
  logger.warn("Test warn");
  logger.error("Test error");
  logger.dryRun("Test dryRun");
  logger.success("Test success");
  logger.debug("Test debug");
});

/**
 * logger - debug の出力先が stderr であることを検証する。
 * スキルは JSON を stdout に出すため、debug が stdout へ戻ると出力契約が壊れる（WP #908）。
 */
Deno.test("logger - debug should write to stderr and keep stdout clean", () => {
  const errorStub = stub(console, "error");
  const logStub = stub(console, "log");
  try {
    logger.debug("debug-contract-check");

    assertEquals(errorStub.calls.length, 1);
    assertEquals(String(errorStub.calls[0].args[0]).includes("[DEBUG]"), true);
    assertEquals(String(errorStub.calls[0].args[0]).includes("debug-contract-check"), true);
    assertEquals(logStub.calls.length, 0, "debug が stdout に出力されている");
  } finally {
    errorStub.restore();
    logStub.restore();
  }
});
