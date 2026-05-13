import { assertEquals, assertStringIncludes } from "https://deno.land/std/testing/asserts.ts";
import { appendMetrics, showSummary } from "./record.ts";
import { join } from "https://deno.land/std/path/mod.ts";

Deno.test("record-session-metrics refactor tests", async (t) => {
  // Create a unique temporary directory for this test run
  const tempDir = await Deno.makeTempDir();
  const testFile = join(tempDir, "metrics.jsonl");

  await t.step("appendMetrics - should append a valid JSON line with timestamp", async () => {
    const data = { intent: "5", constraint: "5", context: "5", stability: "5" };
    await appendMetrics(data, testFile);

    const content = await Deno.readTextFile(testFile);
    const parsed = JSON.parse(content.trim());

    assertEquals(parsed.intent, "5");
    // Verify timestamp is a valid date
    const timestamp = new Date(parsed.timestamp);
    assertEquals(isNaN(timestamp.getTime()), false);
  });

  await t.step("showSummary - should return formatted table with YYYY/MM/DD date", async () => {
    // Already has one entry from previous step
    const summary = await showSummary(testFile);
    assertStringIncludes(summary, "| Date | Intent |");
    
    const today = new Date();
    const expectedDate = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${
      today.getDate().toString().padStart(2, "0")
    }`;
    assertStringIncludes(summary, expectedDate);
    assertStringIncludes(summary, "| 5 | 5 | 5 | 5 |");
  });

  await t.step("showSummary - should handle missing file gracefully", async () => {
    const missingFile = join(tempDir, "not_found.jsonl");
    const summary = await showSummary(missingFile);
    assertStringIncludes(summary, "No metrics recorded yet");
  });

  // Cleanup: Remove the temporary directory and all its contents
  await Deno.remove(tempDir, { recursive: true });
});
