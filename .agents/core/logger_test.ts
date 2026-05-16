import { assertEquals } from "@std/assert";
import { logger } from "./logger.ts";

Deno.test("logger - should provide all expected methods", () => {
  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
  assertEquals(typeof logger.dryRun, "function");
  assertEquals(typeof logger.success, "function");
  assertEquals(typeof logger.debug, "function");
});

Deno.test("logger - methods should execute without throwing", () => {
  // コンソール出力されるため、例外が起きないことだけを確認
  logger.info("Test info");
  logger.warn("Test warn");
  logger.error("Test error");
  logger.dryRun("Test dryRun");
  logger.success("Test success");
  logger.debug("Test debug");
});
