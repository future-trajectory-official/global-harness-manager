import { assertEquals } from "@std/assert";
import type { DomainErrorCode } from "./domain-error.ts";
import {
  createDomainError,
  createDomainErrorWithDefaultMessage,
  isDomainError,
} from "./domain-error.ts";

Deno.test("domain-error - createDomainError should return valid DomainError", () => {
  const err = createDomainError("INVALID_INPUT", "入力値が不正です");
  assertEquals(err.code, "INVALID_INPUT");
  assertEquals(err.message, "入力値が不正です");
  assertEquals(err.details, undefined);
});

Deno.test("domain-error - createDomainError should accept details", () => {
  const err = createDomainError(
    "PARENT_NOT_FOUND",
    "親PBIが見つかりません",
    { pbiId: "PBI-123" },
  );
  assertEquals(err.code, "PARENT_NOT_FOUND");
  assertEquals(err.details, { pbiId: "PBI-123" });
});

Deno.test("domain-error - createDomainErrorWithDefaultMessage should return default message", () => {
  const err = createDomainErrorWithDefaultMessage("ALREADY_COMPLETED");
  assertEquals(err.code, "ALREADY_COMPLETED");
  assertEquals(err.message, "既に完了している操作です");
});

Deno.test("domain-error - createDomainErrorWithDefaultMessage should return message for all error codes", () => {
  const codes: DomainErrorCode[] = [
    "INVALID_INPUT",
    "MISSING_REQUIRED_FIELD",
    "INVALID_STATE_TRANSITION",
    "ALREADY_COMPLETED",
    "ALREADY_ARCHIVED",
    "PARENT_NOT_FOUND",
    "CHILD_WPS_REMAINING",
    "DUPLICATE_AC_NUMBER",
    "UNEXPECTED",
  ];
  for (const code of codes) {
    const err = createDomainErrorWithDefaultMessage(code);
    assertEquals(err.code, code);
    assertEquals(typeof err.message, "string");
    assertEquals(err.message.length > 0, true);
  }
});

Deno.test("domain-error - isDomainError should identify DomainError objects", () => {
  const err = createDomainError("INVALID_INPUT", "test");
  assertEquals(isDomainError(err), true);
});

Deno.test("domain-error - isDomainError should reject non-objects", () => {
  assertEquals(isDomainError(null), false);
  assertEquals(isDomainError("string"), false);
  assertEquals(isDomainError(42), false);
  assertEquals(isDomainError(undefined), false);
});

Deno.test("domain-error - isDomainError should reject plain objects", () => {
  assertEquals(isDomainError({ foo: "bar" }), false);
});

Deno.test("domain-error - isDomainError should reject Error instances", () => {
  const error = new Error("test");
  assertEquals(isDomainError(error), false);
});

Deno.test("domain-error - createDomainError should be immutable", () => {
  const err = createDomainError("UNEXPECTED", "unexpected error");
  assertEquals(Object.isFrozen(err), true);
});
