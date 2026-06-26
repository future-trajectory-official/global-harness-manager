import { assertEquals, assertThrows } from "@std/assert";
import { Size } from "./types.ts";
import { createEffortRecord, createSize, createSizeVariance } from "./value-objects.ts";

Deno.test("value-objects - createSize should return valid Size", () => {
  const size = createSize("M");
  assertEquals(size.toString(), "M");
  assertEquals(size.toWeight(), 3);
});

Deno.test("value-objects - createSize should throw for invalid value", () => {
  assertThrows(
    () => createSize("XXL"),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createSize should throw for empty string", () => {
  assertThrows(
    () => createSize(""),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createEffortRecord should return valid record", () => {
  const record = createEffortRecord(1, 2, 3);
  assertEquals(record.initialEstimate, 1);
  assertEquals(record.plannedEstimate, 2);
  assertEquals(record.actual, 3);
});

Deno.test("value-objects - createEffortRecord should throw for negative initialEstimate", () => {
  assertThrows(
    () => createEffortRecord(-1, 2, 3),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createEffortRecord should throw for NaN", () => {
  assertThrows(
    () => createEffortRecord(NaN, 2, 3),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createEffortRecord should throw for Infinity", () => {
  assertThrows(
    () => createEffortRecord(Infinity, 2, 3),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createEffortRecord should accept zero", () => {
  const record = createEffortRecord(0, 0, 0);
  assertEquals(record.actual, 0);
});

Deno.test("value-objects - createSizeVariance should accept all fields", () => {
  const sv = createSizeVariance({
    estimate: Size.M,
    actual: Size.S,
    varianceReason: "Overestimated",
  });
  assertEquals(sv.estimate?.toString(), "M");
  assertEquals(sv.actual?.toString(), "S");
  assertEquals(sv.varianceReason, "Overestimated");
});

Deno.test("value-objects - createSizeVariance should accept partial fields", () => {
  const sv = createSizeVariance({ estimate: Size.L });
  assertEquals(sv.estimate?.toWeight(), 5);
  assertEquals(sv.actual, undefined);
  assertEquals(sv.varianceReason, undefined);
});

Deno.test("value-objects - createSizeVariance should accept empty options", () => {
  const sv = createSizeVariance({});
  assertEquals(sv.estimate, undefined);
  assertEquals(sv.actual, undefined);
  assertEquals(sv.varianceReason, undefined);
});

Deno.test("value-objects - Size fromString should return Size for valid input", () => {
  assertEquals(Size.fromString("XS"), Size.XS);
  assertEquals(Size.fromString("S"), Size.S);
  assertEquals(Size.fromString("M"), Size.M);
  assertEquals(Size.fromString("L"), Size.L);
  assertEquals(Size.fromString("XL"), Size.XL);
});

Deno.test("value-objects - Size fromString should return undefined for invalid input", () => {
  assertEquals(Size.fromString("XXL"), undefined);
  assertEquals(Size.fromString("xs"), undefined);
  assertEquals(Size.fromString(""), undefined);
  assertEquals(Size.fromString("medium"), undefined);
});

Deno.test("value-objects - Size should have correct weight values", () => {
  assertEquals(Size.XS.toWeight(), 1);
  assertEquals(Size.S.toWeight(), 2);
  assertEquals(Size.M.toWeight(), 3);
  assertEquals(Size.L.toWeight(), 5);
  assertEquals(Size.XL.toWeight(), 8);
});

Deno.test("value-objects - Size.values should contain all instances", () => {
  assertEquals(Size.values.length, 5);
  assertEquals(Size.values, [Size.XS, Size.S, Size.M, Size.L, Size.XL]);
});
