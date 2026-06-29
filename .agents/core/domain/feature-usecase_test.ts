import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import type {
  ChangeReason,
  EpicIdentifier,
  FeatureIdentifier,
  FeatureSearchCondition,
  FeatureStatement,
} from "./types.ts";
import { featureUseCase } from "./feature-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

function makeId(overrides?: Partial<FeatureIdentifier>): FeatureIdentifier {
  return {
    scope,
    title: { value: "Login" },
    id: "feature-1",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeStatement(description = "Login page feature"): FeatureStatement {
  return { description };
}

function makeEpicId(overrides?: Partial<EpicIdentifier>): EpicIdentifier {
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

function makeReason(description = "Scope refinement"): ChangeReason {
  return { description };
}

function makeSearchCondition(
  keyword?: string,
  parentEpic?: EpicIdentifier,
): FeatureSearchCondition {
  return {
    keyword,
    parentEpic,
    describe() {
      return {
        summary: `Search features with keyword: ${this.keyword ?? "(none)"}`,
        steps: [{
          entity: "Feature",
          operation: "search",
          params: { labelType: "Feature", keyword: this.keyword },
        }],
      };
    },
  };
}

Deno.test("featureUseCase - define should return Plan with create operation", () => {
  const plan = featureUseCase.define(makeId({ id: undefined }), makeStatement());
  assertEquals(plan.summary, "Define feature: Login");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "create");
  assertEquals(plan.steps[0].params.title, "Login");
});

Deno.test("featureUseCase - define body should include description", () => {
  const plan = featureUseCase.define(makeId({ id: undefined }), makeStatement());
  const body = plan.steps[0].params.body as string;
  assertStringIncludes(body, "Login page feature");
});

Deno.test("featureUseCase - define with parentEpic should include parent reference", () => {
  const epic = makeEpicId();
  const plan = featureUseCase.define(makeId({ id: undefined }), makeStatement(), epic);
  assertEquals(plan.steps[0].params.parentEpic, "epic-1");
});

Deno.test("featureUseCase - define should throw for empty title", () => {
  assertThrows(
    () => featureUseCase.define(makeId({ title: { value: "" }, id: undefined }), makeStatement()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - define should throw for empty description", () => {
  assertThrows(
    () => featureUseCase.define(makeId({ id: undefined }), makeStatement("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - define should throw for parentEpic with undefined id", () => {
  const epic = makeEpicId({ id: undefined });
  assertThrows(
    () => featureUseCase.define(makeId({ id: undefined }), makeStatement(), epic),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - revise should return Plan with update + comment", () => {
  const plan = featureUseCase.revise(makeId(), makeStatement(), makeReason());
  assertEquals(plan.summary, "Revise feature: Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].operation, "update");
  assertEquals(plan.steps[1].operation, "comment");
});

Deno.test("featureUseCase - revise should throw for empty reason", () => {
  assertThrows(
    () => featureUseCase.revise(makeId(), makeStatement(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - revise should throw for undefined id", () => {
  assertThrows(
    () => featureUseCase.revise(makeId({ id: undefined }), makeStatement(), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - assignToEpic should return Plan with update", () => {
  const epic = makeEpicId();
  const plan = featureUseCase.assignToEpic(makeId(), epic);
  assertEquals(plan.summary, "Assign feature Login to epic Authentication");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "update");
  assertEquals(plan.steps[0].params.parentEpic, "epic-1");
});

Deno.test("featureUseCase - assignToEpic should throw for feature with undefined id", () => {
  assertThrows(
    () => featureUseCase.assignToEpic(makeId({ id: undefined }), makeEpicId()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - assignToEpic should throw for epic with undefined id", () => {
  assertThrows(
    () => featureUseCase.assignToEpic(makeId(), makeEpicId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - unassignFromEpic should return Plan with update", () => {
  const plan = featureUseCase.unassignFromEpic(makeId());
  assertEquals(plan.summary, "Unassign feature Login from epic");
  assertEquals(plan.steps.length, 1);
  assertEquals(plan.steps[0].operation, "update");
  assertEquals(plan.steps[0].params.parentEpic, undefined);
});

Deno.test("featureUseCase - unassignFromEpic should throw for undefined id", () => {
  assertThrows(
    () => featureUseCase.unassignFromEpic(makeId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - find should return Plan with view step", () => {
  const plan = featureUseCase.find(makeId());
  assertEquals(plan.summary, "Find feature: Login");
  assertEquals(plan.steps[0].operation, "view");
});

Deno.test("featureUseCase - find should throw for undefined id", () => {
  assertThrows(
    () => featureUseCase.find(makeId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("featureUseCase - search should return Plan with search step", () => {
  const condition = makeSearchCondition("login");
  const plan = featureUseCase.search(condition);
  assertEquals(plan.steps[0].operation, "search");
});

Deno.test("featureUseCase - search without keyword should return Plan with search step", () => {
  const condition = makeSearchCondition();
  const plan = featureUseCase.search(condition);
  assertEquals(plan.steps[0].operation, "search");
});
