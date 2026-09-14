import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import type { EpicIdentifier, EpicSearchCondition, EpicStatement } from "./types.ts";
import { epicUseCase } from "./epic-usecase.ts";
import type { ChangeReason } from "./types.ts";

const scope = { owner: "my-org", repository: "my-repo" };

function makeId(overrides?: Partial<EpicIdentifier>): EpicIdentifier {
  return {
    scope,
    title: { value: "Authentication" },
    id: "epic-1",
    code: "42",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeStatement(description = "User authentication feature group"): EpicStatement {
  return { description };
}

function makeReason(description = "Scope change"): ChangeReason {
  return { description };
}

function makeSearchCondition(keyword?: string): EpicSearchCondition {
  return {
    keyword,
    describe() {
      return {
        summary: `Search epics with keyword: ${this.keyword ?? "(none)"}`,
        steps: [{
          entity: "Epic",
          operation: "search",
          params: { labelType: "Epic", keyword: this.keyword },
        }],
      };
    },
  };
}

Deno.test("epicUseCase - define should return Plan with create operation", () => {
  const plan = epicUseCase.define(makeId({ id: undefined }), makeStatement());
  assertEquals(plan.summary, "Define epic: Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "create");
  assertEquals(plan.steps[1].params.title, "Authentication");
});

Deno.test("epicUseCase - define body should include description", () => {
  const plan = epicUseCase.define(makeId({ id: undefined }), makeStatement());
  const body = plan.steps[1].params.body as string;
  assertStringIncludes(body, "User authentication feature group");
});

Deno.test("epicUseCase - define should throw for empty title", () => {
  assertThrows(
    () => epicUseCase.define(makeId({ title: { value: "" }, id: undefined }), makeStatement()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - define should throw for empty description", () => {
  assertThrows(
    () => epicUseCase.define(makeId({ id: undefined }), makeStatement("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - revise should return Plan with update + comment", () => {
  const plan = epicUseCase.revise(makeId(), makeStatement(), makeReason());
  assertEquals(plan.summary, "Revise epic: Authentication");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "update");
  assertEquals(plan.steps[2].operation, "comment");
});

Deno.test("epicUseCase - revise should throw for empty reason", () => {
  assertThrows(
    () => epicUseCase.revise(makeId(), makeStatement(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - revise should succeed with code even if id is undefined", () => {
  const plan = epicUseCase.revise(makeId({ id: undefined }), makeStatement(), makeReason());
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[1].params.itemId, "42");
});

Deno.test("epicUseCase - find should return Plan with view step", () => {
  const plan = epicUseCase.find(makeId());
  assertEquals(plan.summary, "Find epic: Authentication");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
});

/**
 * find の正常系（codeのみ）。id が undefined でも code があれば Plan が返ることを確認する。
 * @description read-project-state スキルは Issue 番号（code）を主キーに find を呼ぶため、id 無しで成立すること
 * @verify code="42" を保持したまま find が Plan を返し、view 操作を含むこと
 */
Deno.test("epicUseCase - find should succeed with code even if id is undefined", () => {
  const plan = epicUseCase.find(makeId({ id: undefined }));
  assertEquals(plan.summary, "Find epic: Authentication");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
});

/**
 * find の異常系。id と code の両方が undefined の場合にエラーがスローされることを確認する。
 * @description 参照識別子（id/code）が完全に欠落している場合に INVALID_INPUT エラーが発生すること
 * @verify assertThrows で Error("INVALID_INPUT") がスローされること
 */
Deno.test("epicUseCase - find should throw when both id and code are undefined", () => {
  assertThrows(
    () => epicUseCase.find(makeId({ id: undefined, code: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - search should return Plan with search step", () => {
  const condition = makeSearchCondition("auth");
  const plan = epicUseCase.search(condition);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "search");
});

Deno.test("epicUseCase - search without keyword should return Plan with search step", () => {
  const condition = makeSearchCondition();
  const plan = epicUseCase.search(condition);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "search");
});

Deno.test("epicUseCase - showHierarchy should return Plan with showHierarchy step", () => {
  const plan = epicUseCase.showHierarchy(makeId());
  assertEquals(plan.summary, "Show hierarchy: Authentication");
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].entity, "Epic");
  assertEquals(plan.steps[1].operation, "showHierarchy");
  assertEquals(plan.steps[1].params.itemId, "42");
});

Deno.test("epicUseCase - showHierarchy should throw for undefined id", () => {
  assertThrows(
    () => epicUseCase.showHierarchy(makeId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - showHierarchy should throw for empty title", () => {
  assertThrows(
    () => epicUseCase.showHierarchy(makeId({ title: { value: "" } })),
    Error,
    "INVALID_INPUT",
  );
});
