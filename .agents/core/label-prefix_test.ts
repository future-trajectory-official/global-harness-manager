import { assertEquals } from "@std/assert";
import { applyLabelPrefix, filterLabelsByPrefix, stripLabelPrefix } from "./label-prefix.ts";

Deno.test("label-prefix - applyLabelPrefix should add prefix to unprefixed labels", () => {
  const result = applyLabelPrefix(["bug", "enhancement"], "status:");
  assertEquals(result, ["status:bug", "status:enhancement"]);
});

Deno.test("label-prefix - applyLabelPrefix should not double-prefix", () => {
  const result = applyLabelPrefix(["status:bug", "priority:high"], "status:");
  assertEquals(result, ["status:bug", "priority:high"]);
});

Deno.test("label-prefix - stripLabelPrefix should remove prefix", () => {
  const result = stripLabelPrefix(["status:bug", "status:enhancement"], "status:");
  assertEquals(result, ["bug", "enhancement"]);
});

Deno.test("label-prefix - filterLabelsByPrefix should filter matching labels", () => {
  const result = filterLabelsByPrefix(["status:bug", "priority:high", "status:done"], "status:");
  assertEquals(result, ["status:bug", "status:done"]);
});

Deno.test("label-prefix - applyLabelPrefix should handle empty array", () => {
  const result = applyLabelPrefix([], "status:");
  assertEquals(result, []);
});
