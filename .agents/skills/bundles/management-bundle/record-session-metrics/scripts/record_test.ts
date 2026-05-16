import { assertEquals, assertStringIncludes } from "@std/assert";
import { appendMetrics, showSummary, validateMetrics } from "./record.ts";
import { join } from "@std/path";

Deno.test("validateMetrics - should pass for valid data", () => {
  const valid = { intent: "5", constraint: "4", context: "3", stability: "5" };
  const result = validateMetrics(valid);
  assertEquals(result, true);
});

Deno.test("validateMetrics - should throw for missing fields", () => {
  const invalid = { intent: "5" };
  try {
    validateMetrics(invalid as any);
    assertEquals(true, false, "Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, "Missing required field");
  }
});

Deno.test("validateMetrics - should throw for out of range values", () => {
  const invalid = { intent: "6", constraint: "5", context: "5", stability: "5" };
  try {
    validateMetrics(invalid as any);
    assertEquals(true, false, "Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, "between 1 and 5");
  }
});

Deno.test("record-session-metrics refactor tests", async (t) => {
  const tempDir = await Deno.makeTempDir();
  const testFile = join(tempDir, "metrics.jsonl");

  await t.step("appendMetrics - should append a valid JSON line with timestamp", async () => {
    const data = { intent: "5", constraint: "5", context: "5", stability: "5" };
    await appendMetrics(data, testFile);

    const content = await Deno.readTextFile(testFile);
    const parsed = JSON.parse(content.trim());

    assertEquals(parsed.intent, "5");
    const timestamp = new Date(parsed.timestamp);
    assertEquals(isNaN(timestamp.getTime()), false);
  });

  await t.step("showSummary - should return formatted table", async () => {
    const summary = await showSummary(testFile);
    assertStringIncludes(summary, "| Date | Intent |");
    assertStringIncludes(summary, "| 5 | 5 | 5 | 5 |");
  });

  await t.step("showSummary - should handle missing file gracefully", async () => {
    const missingFile = join(tempDir, "not_found.jsonl");
    const summary = await showSummary(missingFile);
    assertStringIncludes(summary, "No metrics recorded yet");
  });

  await Deno.remove(tempDir, { recursive: true });
});
