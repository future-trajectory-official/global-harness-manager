import { assertEquals, assertThrows } from "@std/assert";
import type {
  ChangeReason,
  EffortRecord,
  ProcessAnalysis,
  ProductBacklogItemIdentifier,
  SessionMetrics,
  SprintIdentifier,
  WorkPackageIdentifier,
  WorkPackageSearchCondition,
  WorkPackageStatement,
} from "./types.ts";
import { workPackageUseCase } from "./workpackage-usecase.ts";

const scope = { owner: "my-org", repository: "my-repo" };

function makeWpId(
  overrides?: Partial<WorkPackageIdentifier>,
): WorkPackageIdentifier {
  return {
    scope,
    title: { value: "Implement Login" },
    id: "wp-1",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeStatement(): WorkPackageStatement {
  return {
    acceptanceCriteria: {
      items: [
        { number: "1", description: "Login form works", judgment: "unchecked" },
        { number: "2", description: "Token refresh works", judgment: "unchecked" },
      ],
    },
  };
}

function makeEmptyStatement(): WorkPackageStatement {
  return { acceptanceCriteria: { items: [] } };
}

function makeParentPbi(
  overrides?: Partial<ProductBacklogItemIdentifier>,
): ProductBacklogItemIdentifier {
  return {
    scope,
    title: { value: "User Authentication" },
    id: "pbi-1",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeSprintId(overrides?: Partial<SprintIdentifier>): SprintIdentifier {
  return {
    scope,
    title: { value: "Sprint 15" },
    id: "sprint-15",
    describe() {
      return { summary: "describe", steps: [] };
    },
    ...overrides,
  };
}

function makeReason(description = "Scope change"): ChangeReason {
  return { description };
}

function makeEffort(): EffortRecord {
  return { initialEstimate: 3, plannedEstimate: 5, actual: 5 };
}

function makeAnalysis(): ProcessAnalysis {
  return {
    planningReview: "Good planning",
    executionReview: "Smooth execution",
    improvementSuggestions: "Add more tests",
  };
}

function makeMetrics(): SessionMetrics {
  return {
    intentAlignmentRate: 5,
    constraintAdherenceScore: 4,
    contextExtractionQuality: 4,
    workSizeStability: 3,
    comment: "Good session",
  };
}

function makeSearchCondition(): WorkPackageSearchCondition {
  return {
    parentPbi: makeParentPbi(),
    describe() {
      return {
        summary: "Search WP for PBI: User Authentication",
        steps: [{
          entity: "WorkPackage",
          operation: "search",
          params: { labelType: "WP", parentPbi: "pbi-1" },
        }],
      };
    },
  };
}

// ===== define =====

Deno.test("define should return Plan with define step", () => {
  const plan = workPackageUseCase.define(
    makeWpId({ id: undefined }),
    makeStatement(),
    makeParentPbi(),
  );
  assertEquals(plan.summary, "Define WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "define");
  assertEquals(plan.steps[1].params.title, "Implement Login");
  assertEquals(plan.steps[1].params.parentPbi, "pbi-1");
});

Deno.test("define should throw for empty title", () => {
  assertThrows(
    () =>
      workPackageUseCase.define(
        makeWpId({ title: { value: "" }, id: undefined }),
        makeStatement(),
        makeParentPbi(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("define should throw for empty acceptance criteria", () => {
  assertThrows(
    () =>
      workPackageUseCase.define(
        makeWpId({ id: undefined }),
        makeEmptyStatement(),
        makeParentPbi(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("define should throw for undefined parent PBI id", () => {
  assertThrows(
    () =>
      workPackageUseCase.define(
        makeWpId({ id: undefined }),
        makeStatement(),
        makeParentPbi({ id: undefined }),
      ),
    Error,
    "INVALID_INPUT",
  );
});

// ===== commit =====

Deno.test("commit should return Plan with commit and update", () => {
  const plan = workPackageUseCase.commit(makeWpId(), makeSprintId());
  assertEquals(plan.summary, "Commit WP Implement Login to Sprint 15");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "commit");
  assertEquals(plan.steps[1].params.stage, "todo");
  assertEquals(plan.steps[1].params.state, "open");
});

Deno.test("commit should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.commit(makeWpId({ id: undefined }), makeSprintId()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("commit should throw for empty sprint title", () => {
  assertThrows(
    () => workPackageUseCase.commit(makeWpId(), makeSprintId({ title: { value: "" } })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== revise =====

Deno.test("revise should return Plan with update and comment", () => {
  const plan = workPackageUseCase.revise(makeWpId(), makeStatement(), makeReason());
  assertEquals(plan.summary, "Revise WP: Implement Login");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "update");
  assertEquals(plan.steps[2].operation, "comment");
});

Deno.test("revise should throw for empty title", () => {
  assertThrows(
    () =>
      workPackageUseCase.revise(
        makeWpId({ title: { value: "" } }),
        makeStatement(),
        makeReason(),
      ),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("revise should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.revise(makeWpId({ id: undefined }), makeStatement(), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("revise should throw for empty acceptance criteria", () => {
  assertThrows(
    () => workPackageUseCase.revise(makeWpId(), makeEmptyStatement(), makeReason()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("revise should throw for empty reason", () => {
  assertThrows(
    () => workPackageUseCase.revise(makeWpId(), makeStatement(), makeReason("")),
    Error,
    "INVALID_INPUT",
  );
});

// ===== start =====

Deno.test("start should return Plan with start stage=inProgress", () => {
  const plan = workPackageUseCase.start(makeWpId());
  assertEquals(plan.summary, "Start WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "start");
  assertEquals(plan.steps[1].params.stage, "inProgress");
  assertEquals(plan.steps[1].params.state, "open");
});

Deno.test("start should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.start(makeWpId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("start should throw for empty title", () => {
  assertThrows(
    () => workPackageUseCase.start(makeWpId({ title: { value: "" } })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== complete =====

Deno.test("complete should return Plan with complete stage=done and update (no parent promotion)", () => {
  const plan = workPackageUseCase.complete(makeWpId());
  assertEquals(plan.summary, "Complete WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "complete");
  assertEquals(plan.steps[1].params.stage, "done");
  assertEquals(plan.steps[1].params.state, "open");
});

Deno.test("complete should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.complete(makeWpId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("complete should throw for empty title", () => {
  assertThrows(
    () => workPackageUseCase.complete(makeWpId({ title: { value: "" } })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== archive =====

Deno.test("archive should return Plan with archive", () => {
  const plan = workPackageUseCase.archive(makeWpId());
  assertEquals(plan.summary, "Archive WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "archive");
  assertEquals(plan.steps[1].params.stage, "done");
  assertEquals(plan.steps[1].params.state, "closed");
});

Deno.test("archive should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.archive(makeWpId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== assignToProductBacklogItem =====

Deno.test("assignToProductBacklogItem should return Plan with assignToProductBacklogItem", () => {
  const pbi = makeParentPbi();
  const plan = workPackageUseCase.assignToProductBacklogItem(makeWpId(), pbi);
  assertEquals(plan.summary, "Assign WP Implement Login to PBI User Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "assignToProductBacklogItem");
  assertEquals(plan.steps[1].params.parentPbi, "pbi-1");
});

Deno.test("assignToProductBacklogItem should throw for undefined wp id", () => {
  assertThrows(
    () =>
      workPackageUseCase.assignToProductBacklogItem(makeWpId({ id: undefined }), makeParentPbi()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("assignToProductBacklogItem should throw for undefined pbi id", () => {
  assertThrows(
    () =>
      workPackageUseCase.assignToProductBacklogItem(makeWpId(), makeParentPbi({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== unassignFromProductBacklogItem =====

Deno.test("unassignFromProductBacklogItem should return Plan with unassignFromProductBacklogItem", () => {
  const plan = workPackageUseCase.unassignFromProductBacklogItem(makeWpId());
  assertEquals(plan.summary, "Unassign WP Implement Login from PBI");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "unassignFromProductBacklogItem");
});

Deno.test("unassignFromProductBacklogItem should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.unassignFromProductBacklogItem(makeWpId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== estimateInitialEffort =====

Deno.test("estimateInitialEffort should return Plan with estimateInitialEffort", () => {
  const plan = workPackageUseCase.estimateInitialEffort(makeWpId(), makeEffort());
  assertEquals(plan.summary, "Estimate initial effort for WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "estimateInitialEffort");
  assertEquals(plan.steps[1].params.effortInitial, 3);
});

Deno.test("estimateInitialEffort should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.estimateInitialEffort(makeWpId({ id: undefined }), makeEffort()),
    Error,
    "INVALID_INPUT",
  );
});

// ===== estimatePlannedEffort =====

Deno.test("estimatePlannedEffort should return Plan with estimatePlannedEffort", () => {
  const plan = workPackageUseCase.estimatePlannedEffort(makeWpId(), makeEffort());
  assertEquals(plan.summary, "Estimate planned effort for WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "estimatePlannedEffort");
  assertEquals(plan.steps[1].params.effortPlanned, 5);
});

Deno.test("estimatePlannedEffort should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.estimatePlannedEffort(makeWpId({ id: undefined }), makeEffort()),
    Error,
    "INVALID_INPUT",
  );
});

// ===== recordActualEffort =====

Deno.test("recordActualEffort should return Plan with recordActualEffort", () => {
  const plan = workPackageUseCase.recordActualEffort(makeWpId(), makeEffort());
  assertEquals(plan.summary, "Record actual effort for WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "recordActualEffort");
  assertEquals(plan.steps[1].params.effortActual, 5);
});

Deno.test("recordActualEffort should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.recordActualEffort(makeWpId({ id: undefined }), makeEffort()),
    Error,
    "INVALID_INPUT",
  );
});

// ===== recordAnalysis =====

Deno.test("recordAnalysis should return Plan with recordAnalysis", () => {
  const plan = workPackageUseCase.recordAnalysis(makeWpId(), makeAnalysis());
  assertEquals(plan.summary, "Record analysis for WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "recordAnalysis");
});

Deno.test("recordAnalysis should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.recordAnalysis(makeWpId({ id: undefined }), makeAnalysis()),
    Error,
    "INVALID_INPUT",
  );
});

Deno.test("recordAnalysis should throw for empty planningReview", () => {
  assertThrows(
    () =>
      workPackageUseCase.recordAnalysis(
        makeWpId(),
        { planningReview: "", executionReview: "OK", improvementSuggestions: "OK" },
      ),
    Error,
    "INVALID_INPUT",
  );
});

// ===== recordSessionMetrics =====

Deno.test("recordSessionMetrics should return Plan with recordSessionMetrics", () => {
  const plan = workPackageUseCase.recordSessionMetrics(makeWpId(), makeMetrics());
  assertEquals(plan.summary, "Record session metrics for WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "recordSessionMetrics");
});

Deno.test("recordSessionMetrics should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.recordSessionMetrics(makeWpId({ id: undefined }), makeMetrics()),
    Error,
    "INVALID_INPUT",
  );
});

// ===== find =====

Deno.test("find should return Plan with view", () => {
  const plan = workPackageUseCase.find(makeWpId());
  assertEquals(plan.summary, "Find WP: Implement Login");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "view");
});

Deno.test("find should throw for undefined id", () => {
  assertThrows(
    () => workPackageUseCase.find(makeWpId({ id: undefined })),
    Error,
    "INVALID_INPUT",
  );
});

// ===== search =====

Deno.test("search should delegate to condition.describe()", () => {
  const condition = makeSearchCondition();
  const plan = workPackageUseCase.search(condition);
  assertEquals(plan.summary, "Search WP for PBI: User Authentication");
  assertEquals(plan.steps.length, 2);
  assertEquals(plan.steps[0].entity, "Scope");
  assertEquals(plan.steps[0].operation, "resolve");
  assertEquals(plan.steps[1].operation, "search");
});
