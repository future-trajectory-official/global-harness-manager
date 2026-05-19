import { assertEquals, assertStringIncludes } from "@std/assert";
import { appendMetrics, type SessionMetrics, showSummary, validateMetrics } from "./record.ts";
import { join } from "@std/path";

Deno.test("validateMetrics - should pass for valid data", () => {
  const valid = { intent: "5", constraint: "4", context: "3", stability: "5" };
  const result = validateMetrics(valid);
  assertEquals(result, true);
});

Deno.test("validateMetrics - should throw for missing fields", () => {
  const invalid = { intent: "5" };
  try {
    validateMetrics(invalid as unknown as SessionMetrics);
    assertEquals(true, false, "Should have thrown");
  } catch (e) {
    assertStringIncludes((e as Error).message, "Missing required field");
  }
});

Deno.test("validateMetrics - should throw for out of range values", () => {
  const invalid = { intent: "6", constraint: "5", context: "5", stability: "5" };
  try {
    validateMetrics(invalid as unknown as SessionMetrics);
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

  await t.step("showSummary - should skip empty lines in file", async () => {
    const fileWithEmptyLine = join(tempDir, "metrics_empty_line.jsonl");
    await Deno.writeTextFile(
      fileWithEmptyLine,
      '{"timestamp":"2026-01-01T00:00:00.000Z","intent":"3","constraint":"3","context":"3","stability":"3"}\n\n',
    );
    const summary = await showSummary(fileWithEmptyLine);
    assertStringIncludes(summary, "| 3 | 3 | 3 | 3 |");
  });

  await t.step(
    'showSummary - should show "Unknown" for entries without timestamp',
    async () => {
      const fileNoTs = join(tempDir, "metrics_no_ts.jsonl");
      await Deno.writeTextFile(
        fileNoTs,
        '{"intent":"2","constraint":"2","context":"2","stability":"2"}\n',
      );
      const summary = await showSummary(fileNoTs);
      assertStringIncludes(summary, "Unknown");
    },
  );

  await Deno.remove(tempDir, { recursive: true });
});
