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
        steps: [{ operation: "searchItems", params: { type: "Epic", keyword: this.keyword } }],
      };
    },
  };
}

Deno.test("epicUseCase - define should return Plan with createItem operation", () => {
  const plan = epicUseCase.define(makeId({ id: undefined }), makeStatement());
  assertEquals(plan.summary, "Define epic: Authentication");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "createItem");
  assertEquals(plan.steps[0].params.title, "Authentication");
  assertEquals(plan.steps[0].params.type, "Epic");
});

Deno.test("epicUseCase - define body should include description", () => {
  const plan = epicUseCase.define(makeId({ id: undefined }), makeStatement());
  const body = plan.steps[0].params.body as string;
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

Deno.test("epicUseCase - revise should return Plan with updateItem + addComment", () => {
  const plan = epicUseCase.revise(makeId(), makeStatement(), makeReason());
  assertEquals(plan.summary, "Revise epic: Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "updateItem");
  assertEquals(plan.steps[0].params.type, "Epic");
  assertEquals(plan.steps[1].operation, "addComment");
});

Deno.test("epicUseCase - revise should throw for empty reason", () => {
  assertThrows(
    () => epicUseCase.revise(makeId(), makeStatement(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - revise should throw for undefined id", () => {
  assertThrows(
    () => epicUseCase.revise(makeId({ id: undefined }), makeStatement(), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - find should return Plan with findItem step", () => {
  const plan = epicUseCase.find(makeId());
  assertEquals(plan.summary, "Find epic: Authentication");
  assertEquals(plan.steps[0].operation, "findItem");
});

Deno.test("epicUseCase - find should throw for undefined id", () => {
  assertThrows(
    () => epicUseCase.find(makeId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("epicUseCase - search should return Plan with searchItems step", () => {
  const condition = makeSearchCondition("auth");
  const plan = epicUseCase.search(condition);
  assertEquals(plan.steps[0].operation, "searchItems");
});

Deno.test("epicUseCase - search without keyword should return Plan with searchItems step", () => {
  const condition = makeSearchCondition();
  const plan = epicUseCase.search(condition);
  assertEquals(plan.steps[0].operation, "searchItems");
});
