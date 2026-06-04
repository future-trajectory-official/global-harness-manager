import { assertEquals, assertInstanceOf, assertStringIncludes } from "@std/assert";
import { errorUtil } from "./error.ts";

Deno.test("errorUtil.toError - should return the same Error object if passed an Error", () => {
  const originalError = new Error("Test error");
  const result = errorUtil.toError(originalError);
  assertEquals(result, originalError);
  assertInstanceOf(result, Error);
});

/**
 * errorUtil.toError - 文字列が Error オブジェクトにラップされることを検証する。
 * エラーメッセージとして文字列を渡した場合、そのメッセージを持つ Error インスタンスが
 * 生成されることを確認する。
 */
Deno.test("errorUtil.toError - should wrap string in Error object", () => {
  const message = "Test string error";
  const result = errorUtil.toError(message);
  assertInstanceOf(result, Error);
  assertEquals(result.message, message);
});

/**
 * errorUtil.toError - オブジェクトが JSON 文字列化されて Error にラップされることを検証する。
 * プレーンオブジェクトを渡した場合、JSON.stringify されたメッセージが設定されることを確認する。
 */
Deno.test("errorUtil.toError - should stringify non-string, non-Error objects", () => {
  const obj = { code: 500, msg: "server error" };
  const result = errorUtil.toError(obj);
  assertInstanceOf(result, Error);
  assertEquals(result.message, JSON.stringify(obj));
});

/**
 * errorUtil.toError - null および undefined が "null" / "undefined" 文字列として
 * Error に変換されることを検証する。特殊な falsy 値でもエラーなくハンドリングされることを確認する。
 */
Deno.test("errorUtil.toError - should handle null and undefined", () => {
  assertEquals(errorUtil.toError(null).message, "null");
  assertEquals(errorUtil.toError(undefined).message, "undefined");
});

/**
 * errorUtil.log - console.error にスタックトレースが出力されることを検証する。
 * Error オブジェクトとコンテキスト文字列を渡した際、スタックトレースが
 * 正しくコンソールに書き出されることを確認する。
 */
Deno.test("errorUtil.log - should log error message and stack trace", () => {
  // Capture console.error output
  const originalConsoleError = console.error;
  let capturedError = "";
  console.error = (msg: string) => {
    capturedError += msg;
  };

  try {
    const err = new Error("Custom error message");
    err.stack = "Custom stack trace";
    errorUtil.log(err, "TestContext");

    // The logger might write to stdout or stderr depending on its implementation.
    // errorUtil.log explicitly calls console.error(error.stack).
    assertStringIncludes(capturedError, "Custom stack trace");
  } finally {
    // Restore console.error
    console.error = originalConsoleError;
  }
});
