import { assertEquals, assertThrows } from "@std/assert";
import { Size } from "./types.ts";
import {
  createEffortRecord,
  createSize,
  createSizeVariance,
  withActual,
  withPlannedEstimate,
  withSizeActual,
  withSizeEstimate,
  withVarianceReason,
} from "./value-objects.ts";

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

Deno.test("value-objects - createEffortRecord should return record with initialEstimate only", () => {
  const record = createEffortRecord(1);
  assertEquals(record.initialEstimate, 1);
  assertEquals(record.plannedEstimate, undefined);
  assertEquals(record.actual, undefined);
});

Deno.test("value-objects - createEffortRecord should throw for negative initialEstimate", () => {
  assertThrows(
    () => createEffortRecord(-1),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createEffortRecord should throw for NaN", () => {
  assertThrows(
    () => createEffortRecord(NaN),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createEffortRecord should throw for Infinity", () => {
  assertThrows(
    () => createEffortRecord(Infinity),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createEffortRecord should accept zero", () => {
  const record = createEffortRecord(0);
  assertEquals(record.initialEstimate, 0);
  assertEquals(record.plannedEstimate, undefined);
});

Deno.test("value-objects - withPlannedEstimate should add plannedEstimate", () => {
  const record = createEffortRecord(1);
  const updated = withPlannedEstimate(record, 2);
  assertEquals(updated.initialEstimate, 1);
  assertEquals(updated.plannedEstimate, 2);
  assertEquals(updated.actual, undefined);
});

Deno.test("value-objects - withPlannedEstimate should not mutate original", () => {
  const record = createEffortRecord(1);
  withPlannedEstimate(record, 2);
  assertEquals(record.plannedEstimate, undefined);
});

Deno.test("value-objects - withPlannedEstimate should throw for negative", () => {
  assertThrows(
    () => withPlannedEstimate(createEffortRecord(1), -1),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - withPlannedEstimate should throw when less than initialEstimate", () => {
  assertThrows(
    () => withPlannedEstimate(createEffortRecord(3), 1),
    Error,
    "initialEstimate",
  );
});

Deno.test("value-objects - withPlannedEstimate should allow equal to initialEstimate", () => {
  const updated = withPlannedEstimate(createEffortRecord(2), 2);
  assertEquals(updated.plannedEstimate, 2);
});

Deno.test("value-objects - withActual should add actual", () => {
  const record = createEffortRecord(1);
  const withPlanned = withPlannedEstimate(record, 2);
  const completed = withActual(withPlanned, 3);
  assertEquals(completed.initialEstimate, 1);
  assertEquals(completed.plannedEstimate, 2);
  assertEquals(completed.actual, 3);
});

Deno.test("value-objects - withActual should throw for negative", () => {
  assertThrows(
    () => withActual(createEffortRecord(1), -5),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("value-objects - createSizeVariance should start empty", () => {
  const sv = createSizeVariance();
  assertEquals(sv.estimate, undefined);
  assertEquals(sv.actual, undefined);
  assertEquals(sv.varianceReason, undefined);
});

Deno.test("value-objects - withSizeEstimate should set estimate", () => {
  const sv = createSizeVariance();
  const updated = withSizeEstimate(sv, Size.M);
  assertEquals(updated.estimate?.toString(), "M");
  assertEquals(updated.actual, undefined);
});

Deno.test("value-objects - withSizeActual should set actual", () => {
  const sv = createSizeVariance();
  const updated = withSizeActual(sv, Size.S);
  assertEquals(updated.actual?.toString(), "S");
});

Deno.test("value-objects - withVarianceReason should set reason", () => {
  const sv = createSizeVariance();
  const updated = withVarianceReason(sv, "Overestimated");
  assertEquals(updated.varianceReason, "Overestimated");
});

Deno.test("value-objects - SizeVariance builder should compose incrementally", () => {
  const sv = withVarianceReason(
    withSizeActual(
      withSizeEstimate(createSizeVariance(), Size.L),
      Size.M,
    ),
    "Slightly over",
  );
  assertEquals(sv.estimate?.toWeight(), 5);
  assertEquals(sv.actual?.toWeight(), 3);
  assertEquals(sv.varianceReason, "Slightly over");
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
