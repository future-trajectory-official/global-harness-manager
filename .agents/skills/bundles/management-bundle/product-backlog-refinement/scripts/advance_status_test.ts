import { assertEquals, assertThrows } from "@std/assert";
import { pbiId, wpId } from "../../../../../core/domain/types.ts";
import type { ExecutionResult, Stage } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";

const STAGE_ORDER: Stage[] = ["idea", "todo", "inProgress", "done"];

function getNextOperation(current: Stage): "commit" | "start" | "complete" {
  switch (current) {
    case "idea":
      return "commit";
    case "todo":
      return "start";
    case "inProgress":
      return "complete";
    default:
      throw new Error(
        `INVALID_INPUT: Cannot advance from stage "${current}". Already completed or invalid state.`,
      );
  }
}

function getNextStage(current: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

Deno.test("advance_status - idea stage should map to commit", () => {
  assertEquals(getNextOperation("idea"), "commit");
});

Deno.test("advance_status - todo stage should map to start", () => {
  assertEquals(getNextOperation("todo"), "start");
});

Deno.test("advance_status - inProgress stage should map to complete", () => {
  assertEquals(getNextOperation("inProgress"), "complete");
});

Deno.test("advance_status - done stage should throw", () => {
  assertThrows(() => getNextOperation("done"), Error, "INVALID_INPUT");
});

Deno.test("advance_status - stage order transitions are correct", () => {
  assertEquals(getNextStage("idea"), "todo");
  assertEquals(getNextStage("todo"), "inProgress");
  assertEquals(getNextStage("inProgress"), "done");
  assertEquals(getNextStage("done"), null);
});

Deno.test("advance_status - PBI commit plan for idea stage", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const plan = productBacklogItemUseCase.commit(identifier, {
    scope: { owner: "unknown", repository: "unknown" },
    title: { value: "Sprint 19" },
    describe: () => ({ summary: "Sprint 19", steps: [] }),
  });
  assertEquals(plan.summary, "Commit PBI Test PBI to Sprint 19");
  assertEquals(plan.steps[1].operation, "commit");
  assertEquals((plan.steps[1].params as Record<string, unknown>).sprint, "Sprint 19");
});

Deno.test("advance_status - WP commit plan for idea stage", () => {
  const identifier = wpId("Test WP", "node-id", "7");
  const plan = workPackageUseCase.commit(identifier, {
    scope: { owner: "unknown", repository: "unknown" },
    title: { value: "Sprint 19" },
    describe: () => ({ summary: "Sprint 19", steps: [] }),
  });
  assertEquals(plan.summary, "Commit WP Test WP to Sprint 19");
  assertEquals(plan.steps[1].operation, "commit");
});

Deno.test("advance_status - PBI start plan for todo stage", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const plan = productBacklogItemUseCase.start(identifier);
  assertEquals(plan.summary, "Start PBI: Test PBI");
  assertEquals(plan.steps[1].operation, "start");
});

Deno.test("advance_status - WP start plan for todo stage", () => {
  const identifier = wpId("Test WP", "node-id", "7");
  const plan = workPackageUseCase.start(identifier);
  assertEquals(plan.summary, "Start WP: Test WP");
  assertEquals(plan.steps[1].operation, "start");
});

Deno.test("advance_status - PBI complete plan for inProgress stage", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const plan = productBacklogItemUseCase.complete(identifier);
  assertEquals(plan.summary, "Complete PBI: Test PBI");
  assertEquals(plan.steps[1].operation, "complete");
});

Deno.test("advance_status - WP complete plan for inProgress stage", () => {
  const identifier = wpId("Test WP", "node-id", "7");
  const plan = workPackageUseCase.complete(identifier);
  assertEquals(plan.summary, "Complete WP: Test WP");
  assertEquals(plan.steps[1].operation, "complete");
});

Deno.test("advance_status - find PBI plan should include view operation", () => {
  const identifier = pbiId("Test PBI", "node-id", "42");
  const plan = productBacklogItemUseCase.find(identifier);
  assertEquals(plan.summary, "Find PBI: Test PBI");
  assertEquals(plan.steps[1].operation, "view");
});

Deno.test("advance_status - find WP plan should include view operation", () => {
  const identifier = wpId("Test WP", "node-id", "7");
  const plan = workPackageUseCase.find(identifier);
  assertEquals(plan.summary, "Find WP: Test WP");
  assertEquals(plan.steps[1].operation, "view");
});

function stageFromExecResult(result: ExecutionResult): Stage {
  const viewStep = result.stepResults?.find((s) => s.operation === "view");
  if (!viewStep?.output || typeof viewStep.output !== "object") {
    throw new Error("INVALID_INPUT: Could not determine current stage from find result");
  }
  const stage = (viewStep.output as Record<string, unknown>).stage as string | undefined;
  if (!stage || !STAGE_ORDER.includes(stage as Stage)) {
    throw new Error(`INVALID_INPUT: Unknown stage "${stage}"`);
  }
  return stage as Stage;
}

Deno.test("advance_status - stageFromExecResult extracts stage correctly", () => {
  const result: ExecutionResult = {
    stepResults: [
      { operation: "resolve", success: true },
      {
        operation: "view",
        success: true,
        output: { stage: "idea" },
      },
    ],
  };
  assertEquals(stageFromExecResult(result), "idea");
});

Deno.test("advance_status - stageFromExecResult throws for missing stage", () => {
  const result: ExecutionResult = {
    stepResults: [
      { operation: "view", success: true, output: {} },
    ],
  };
  assertThrows(() => stageFromExecResult(result), Error, "INVALID_INPUT");
});

Deno.test("advance_status - stageFromExecResult throws for unknown stage", () => {
  const result: ExecutionResult = {
    stepResults: [
      { operation: "view", success: true, output: { stage: "unknown" } },
    ],
  };
  assertThrows(() => stageFromExecResult(result), Error, "INVALID_INPUT");
});
