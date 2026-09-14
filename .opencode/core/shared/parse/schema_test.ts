import { assertEquals } from "@std/assert";
import { validateInput } from "./schema.ts";

Deno.test("schema - validateInput should pass valid input", () => {
  const rules = [
    { field: "title", type: "string" as const, required: true },
    { field: "count", type: "number" as const },
  ];
  const result = validateInput({ title: "hello", count: 42 }, rules);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("schema - validateInput should fail on missing required field", () => {
  const rules = [
    { field: "title", type: "string" as const, required: true },
  ];
  const result = validateInput({}, rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0].path, "title");
});

Deno.test("schema - validateInput should fail on wrong type", () => {
  const rules = [
    { field: "count", type: "number" as const },
  ];
  const result = validateInput({ count: "not-a-number" }, rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0].path, "count");
});

Deno.test("schema - validateInput should enforce minLength", () => {
  const rules = [
    { field: "name", type: "string" as const, minLength: 3 },
  ];
  const result = validateInput({ name: "ab" }, rules);
  assertEquals(result.valid, false);
});

Deno.test("schema - validateInput should enforce enum constraint", () => {
  const rules = [
    { field: "status", type: "string" as const, enum: ["open", "closed"] },
  ];
  const result = validateInput({ status: "pending" }, rules);
  assertEquals(result.valid, false);
});

Deno.test("schema - validateInput should pass valid enum value", () => {
  const rules = [
    { field: "status", type: "string" as const, enum: ["open", "closed"] },
  ];
  const result = validateInput({ status: "open" }, rules);
  assertEquals(result.valid, true);
});

Deno.test("schema - validateInput should allow optional field to be missing", () => {
  const rules = [
    { field: "title", type: "string" as const, required: false },
  ];
  const result = validateInput({}, rules);
  assertEquals(result.valid, true);
});
