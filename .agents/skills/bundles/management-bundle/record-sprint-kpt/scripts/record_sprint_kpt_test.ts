import { assertEquals, assertThrows } from "@std/assert";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import {
  assertByteLimit,
  BYTE_LIMIT,
  byteLength,
} from "../../../../../core/shared/retrospective-utils.ts";
import { validateInput } from "./record_sprint_kpt.ts";

const VALID_INPUT = {
  sprintNumber: 20,
  code: "670",
  kpta: {
    keep: "Keep doing X",
    problem: "Problem with Y",
    try: "Try Z next",
    advise: "Advise W",
  },
  reason: { description: "Sprint 20 retrospective" },
};

/**
 * @description recordSprintKpt が正しい Plan（recordSprintKpt操作）を生成すること
 * @verify itemId に code、kpta が反映されること
 */
Deno.test("record_sprint_kpt - recordSprintKpt builds correct plan", () => {
  const scope = { owner: "future-trajectory-official", repository: "global-harness-manager" };
  const identifier = identify(scope, "Sprint 20 Retrospective", "670", "670");
  const plan = retrospectiveUseCase.recordSprintKpt(
    identifier,
    VALID_INPUT.kpta,
    VALID_INPUT.reason,
  ) as Plan;
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[1].operation, "recordSprintKpt");
  const params = plan.steps[1].params as { itemId: string; kpta: typeof VALID_INPUT.kpta };
  assertEquals(params.itemId, "670");
  assertEquals(params.kpta.keep, "Keep doing X");
});

/**
 * @description validateInput が正しい入力を拒否しないこと
 * @verify 例外が発生しないこと
 */
Deno.test("record_sprint_kpt - validateInput accepts valid input", () => {
  validateInput(VALID_INPUT);
});

/**
 * @description validateInput が code と sprintNumber の両方欠落を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_kpt - validateInput rejects missing code and sprintNumber", () => {
  const { code, sprintNumber, ...rest } = VALID_INPUT;
  assertThrows(
    () => validateInput(rest as typeof VALID_INPUT),
    Error,
    "INVALID_INPUT",
  );
  void code;
  void sprintNumber;
});

/**
 * @description validateInput が空 code を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_kpt - validateInput rejects empty code", () => {
  assertThrows(
    () => validateInput({ ...VALID_INPUT, code: "" }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が非正の sprintNumber を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_kpt - validateInput rejects non-positive sprintNumber", () => {
  assertThrows(
    () => validateInput({ ...VALID_INPUT, sprintNumber: 0 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が小数の sprintNumber を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_kpt - validateInput rejects non-integer sprintNumber", () => {
  assertThrows(
    () => validateInput({ ...VALID_INPUT, sprintNumber: 20.5 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が空の keep を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_kpt - validateInput rejects empty keep", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        kpta: { ...VALID_INPUT.kpta, keep: "" },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が欠落した reason を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_kpt - validateInput rejects missing reason", () => {
  assertThrows(
    () => validateInput({ ...VALID_INPUT, reason: undefined }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が1024バイト超の kpta を拒否すること
 * @verify INVALID_INPUT エラー（バイト制限）が発生すること
 */
Deno.test("record_sprint_kpt - validateInput rejects kpta over 1024 bytes", () => {
  assertThrows(
    () =>
      validateInput({
        ...VALID_INPUT,
        kpta: { ...VALID_INPUT.kpta, keep: "あ".repeat(400) },
      }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description assertByteLimit が1024バイトちょうどを許可すること
 * @verify 例外が発生しないこと
 */
Deno.test("record_sprint_kpt - assertByteLimit allows exactly 1024 bytes", () => {
  assertByteLimit("a".repeat(BYTE_LIMIT), "kpta.keep");
});

/**
 * @description assertByteLimit が1024バイト超を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("record_sprint_kpt - assertByteLimit rejects over 1024 bytes", () => {
  assertThrows(
    () => assertByteLimit("a".repeat(BYTE_LIMIT + 1), "kpta.keep"),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description byteLength が日本語（3バイト）を正しく数えること
 * @verify "あ" が 3 バイトであること
 */
Deno.test("record_sprint_kpt - byteLength counts UTF-8 bytes", () => {
  assertEquals(byteLength("あ"), 3);
});
