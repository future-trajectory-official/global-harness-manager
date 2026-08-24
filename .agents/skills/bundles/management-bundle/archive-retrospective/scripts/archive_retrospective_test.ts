import { assertEquals, assertThrows } from "@std/assert";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { identify } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { validateInput } from "./archive_retrospective.ts";

/**
 * @description archive が正しい Plan（archive操作・close）を生成すること
 * @verify itemId に code、state が closed であること
 */
Deno.test("archive_retrospective - archive builds correct plan", () => {
  const scope = { owner: "future-trajectory-official", repository: "global-harness-manager" };
  const identifier = identify(scope, "Sprint 20 Retrospective", "670", "670");
  const plan = retrospectiveUseCase.archive(identifier) as Plan;
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[1].entity, "Retrospective");
  assertEquals(plan.steps[1].operation, "archive");
  const params = plan.steps[1].params as { itemId: string; state: string };
  assertEquals(params.itemId, "670");
  assertEquals(params.state, "closed");
});

/**
 * @description validateInput が code 指定を受理すること
 * @verify 例外が発生しないこと
 */
Deno.test("archive_retrospective - validateInput accepts code", () => {
  validateInput({ code: "670" });
});

/**
 * @description validateInput が sprintNumber 指定を受理すること
 * @verify 例外が発生しないこと
 */
Deno.test("archive_retrospective - validateInput accepts sprintNumber", () => {
  validateInput({ sprintNumber: 20 });
});

/**
 * @description validateInput が code と sprintNumber の両方欠落を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("archive_retrospective - validateInput rejects missing identifiers", () => {
  assertThrows(
    () => validateInput({}),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が非正の sprintNumber を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("archive_retrospective - validateInput rejects non-positive sprintNumber", () => {
  assertThrows(
    () => validateInput({ sprintNumber: 0 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が小数の sprintNumber を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("archive_retrospective - validateInput rejects non-integer sprintNumber", () => {
  assertThrows(
    () => validateInput({ sprintNumber: 20.5 }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が空 code を拒否すること
 * @verify INVALID_INPUT エラーが発生すること
 */
Deno.test("archive_retrospective - validateInput rejects empty code", () => {
  assertThrows(
    () => validateInput({ code: "" }),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * @description validateInput が code と sprintNumber の同時指定を受理すること
 * @verify 例外が発生しないこと
 */
Deno.test("archive_retrospective - validateInput accepts code with sprintNumber", () => {
  validateInput({ code: "670", sprintNumber: 20 });
});
