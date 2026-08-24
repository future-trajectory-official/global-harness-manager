import { assertEquals, assertThrows } from "@std/assert";
import {
  assertByteLimit,
  BYTE_LIMIT,
  byteLength,
  dryRunTarget,
  matchRetrospectiveTitle,
} from "./retrospective-utils.ts";

/**
 * @description byteLength が ASCII 1文字を1バイトと数えること
 * @verify "a" が 1 バイトであること
 */
Deno.test("retrospective-utils - byteLength counts ASCII bytes", () => {
  assertEquals(byteLength("a"), 1);
});

/**
 * @description byteLength が日本語1文字を3バイトと数えること
 * @verify "あ" が 3 バイトであること
 */
Deno.test("retrospective-utils - byteLength counts UTF-8 multibyte", () => {
  assertEquals(byteLength("あ"), 3);
});

/**
 * @description assertByteLimit がちょうど1024バイトを許可すること
 * @verify 例外が発生しないこと
 */
Deno.test("retrospective-utils - assertByteLimit allows exactly 1024 bytes", () => {
  assertByteLimit("a".repeat(BYTE_LIMIT), "field");
});

/**
 * @description assertByteLimit が1025バイトを拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("retrospective-utils - assertByteLimit rejects over 1024 bytes", () => {
  assertThrows(
    () => assertByteLimit("a".repeat(BYTE_LIMIT + 1), "field"),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description assertByteLimit がマルチバイト境界（1023B許可・1026B拒否）を正しく扱うこと
 * @verify 日本語341文字（1023B）は許可、342文字（1026B）は拒否
 */
Deno.test("retrospective-utils - assertByteLimit handles multibyte boundary", () => {
  assertByteLimit("あ".repeat(341), "field");
  assertThrows(
    () => assertByteLimit("あ".repeat(342), "field"),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description matchRetrospectiveTitle が「Sprint N Retrospective」を一致と判定すること
 * @verify "Sprint 20 Retrospective" が true
 */
Deno.test("retrospective-utils - matchRetrospectiveTitle matches exact title", () => {
  assertEquals(matchRetrospectiveTitle("Sprint 20 Retrospective", 20), true);
});

/**
 * @description matchRetrospectiveTitle が前方一致衝突（Sprint 2 vs Sprint 20）を回避すること
 * @verify "Sprint 20 Retrospective" は sprintNumber=2 に一致しない
 */
Deno.test("retrospective-utils - matchRetrospectiveTitle avoids prefix collision", () => {
  assertEquals(matchRetrospectiveTitle("Sprint 20 Retrospective", 2), false);
  assertEquals(matchRetrospectiveTitle("Sprint 2 Retrospective", 2), true);
  assertEquals(matchRetrospectiveTitle("Sprint 21 Retrospective", 2), false);
});

/**
 * @description dryRunTarget が code 指定時に対象を確定して返すこと
 * @verify code/title が返ること
 */
Deno.test("retrospective-utils - dryRunTarget resolves with code", () => {
  assertEquals(dryRunTarget({ code: "670", title: "Sprint 20 Retrospective" }), {
    code: "670",
    title: "Sprint 20 Retrospective",
  });
});

/**
 * @description dryRunTarget が code 未指定時に null を返すこと
 * @verify 対象未確定（実実行時に検索）であること
 */
Deno.test("retrospective-utils - dryRunTarget returns null without code", () => {
  assertEquals(dryRunTarget({ sprintNumber: 20 }), null);
});

/**
 * @description dryRunTarget が空 code を null 扱いすること
 * @verify "" は null
 */
Deno.test("retrospective-utils - dryRunTarget treats empty code as null", () => {
  assertEquals(dryRunTarget({ code: "" }), null);
});
