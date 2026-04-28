import { assertEquals, assertInstanceOf } from "@std/assert";
import { errorUtil } from "./error.ts";

Deno.test("errorUtil.toError - should return the same Error object if passed an Error", () => {
  const originalError = new Error("Test error");
  const result = errorUtil.toError(originalError);
  assertEquals(result, originalError);
  assertInstanceOf(result, Error);
});

Deno.test("errorUtil.toError - should wrap string in Error object", () => {
  const message = "Test string error";
  const result = errorUtil.toError(message);
  assertInstanceOf(result, Error);
  assertEquals(result.message, message);
});

Deno.test("errorUtil.toError - should stringify non-string, non-Error objects", () => {
  const obj = { code: 500, msg: "server error" };
  const result = errorUtil.toError(obj);
  assertInstanceOf(result, Error);
  assertEquals(result.message, JSON.stringify(obj));
});

Deno.test("errorUtil.toError - should handle null and undefined", () => {
  assertEquals(errorUtil.toError(null).message, "null");
  assertEquals(errorUtil.toError(undefined).message, "undefined");
});
