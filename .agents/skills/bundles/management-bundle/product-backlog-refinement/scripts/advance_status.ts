#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { pbiId, sprintRef, wpId } from "../../../../../core/domain/types.ts";
import type {
  ExecutionResult,
  Plan,
  ProductBacklogItemIdentifier,
  Stage,
  WorkPackageIdentifier,
} from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface AdvanceStatusInput {
  entityType: "pbi" | "wp";
  identifier: { title: string; id: string; code?: string };
  sprintNumber?: number;
}

const STAGE_ORDER: Stage[] = ["idea", "todo", "inProgress", "done"];

function getNextStage(current: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

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

function buildCommitPlan(
  entityType: "pbi" | "wp",
  identifier: ProductBacklogItemIdentifier | WorkPackageIdentifier,
  sprintNumber: number,
): Plan {
  const sprint = sprintRef(sprintNumber);
  if (entityType === "pbi") {
    return productBacklogItemUseCase.commit(
      identifier as ProductBacklogItemIdentifier,
      sprint,
    );
  }
  return workPackageUseCase.commit(
    identifier as WorkPackageIdentifier,
    sprint,
  );
}

function buildStartPlan(
  entityType: "pbi" | "wp",
  identifier: ProductBacklogItemIdentifier | WorkPackageIdentifier,
): Plan {
  if (entityType === "pbi") {
    return productBacklogItemUseCase.start(identifier as ProductBacklogItemIdentifier);
  }
  return workPackageUseCase.start(identifier as WorkPackageIdentifier);
}

function buildCompletePlan(
  entityType: "pbi" | "wp",
  identifier: ProductBacklogItemIdentifier | WorkPackageIdentifier,
): Plan {
  if (entityType === "pbi") {
    return productBacklogItemUseCase.complete(identifier as ProductBacklogItemIdentifier);
  }
  return workPackageUseCase.complete(identifier as WorkPackageIdentifier);
}

function validateInput(input: AdvanceStatusInput): void {
  if (!input.entityType) {
    throw new Error("INVALID_INPUT: entityType is required (must be 'pbi' or 'wp')");
  }
  if (input.entityType !== "pbi" && input.entityType !== "wp") {
    throw new Error("INVALID_INPUT: entityType must be 'pbi' or 'wp'");
  }
  if (!input.identifier) {
    throw new Error("INVALID_INPUT: identifier is required");
  }
  if (!input.identifier.id) {
    throw new Error("INVALID_INPUT: identifier.id must not be empty");
  }
  if (input.entityType === "pbi") {
    const sprint = input.sprintNumber;
    if (sprint !== undefined && (!Number.isInteger(sprint) || sprint < 1)) {
      throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
    }
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<AdvanceStatusInput>();
    validateInput(input);

    const identifier = input.entityType === "pbi"
      ? pbiId(input.identifier.title, input.identifier.id, input.identifier.code) as
        | ProductBacklogItemIdentifier
        | WorkPackageIdentifier
      : wpId(input.identifier.title, input.identifier.id, input.identifier.code) as
        | ProductBacklogItemIdentifier
        | WorkPackageIdentifier;

    const useCase = input.entityType === "pbi" ? productBacklogItemUseCase : workPackageUseCase;

    const findPlan = useCase.find(identifier);
    const findResult = await useCase.executePlan(findPlan);

    const currentStage = stageFromExecResult(findResult);
    const operation = getNextOperation(currentStage);

    let plan: Plan;
    if (operation === "commit") {
      if (input.sprintNumber === undefined) {
        throw new Error("INVALID_INPUT: sprintNumber is required for commit operation");
      }
      plan = buildCommitPlan(input.entityType, identifier, input.sprintNumber);
    } else if (operation === "start") {
      plan = buildStartPlan(input.entityType, identifier);
    } else {
      plan = buildCompletePlan(input.entityType, identifier);
    }

    if (args["dry-run"]) {
      console.log(JSON.stringify(
        {
          summary: plan.summary,
          currentStage,
          nextStage: getNextStage(currentStage),
          steps: plan.steps,
        },
        null,
        2,
      ));
    } else {
      const result = await useCase.executePlan(plan);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
