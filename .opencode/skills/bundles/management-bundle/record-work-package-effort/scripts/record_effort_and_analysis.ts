#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface RecordEffortAndAnalysisInput {
  identifier: { title: string; id: string; code?: string };
  actual: number;
  planningReview: string;
  executionReview: string;
  improvementSuggestions?: string;
}

function validateInput(input: RecordEffortAndAnalysisInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (typeof input.actual !== "number" || input.actual < 0) {
    throw new Error("INVALID_INPUT: actual must be a non-negative number");
  }
  if (!input.planningReview) throw new Error("INVALID_INPUT: planningReview must not be empty");
  if (!input.executionReview) throw new Error("INVALID_INPUT: executionReview must not be empty");
}

function findOperationStep(plan: Plan): Plan["steps"][number] {
  const step = plan.steps.find((s) => s.entity !== "Scope");
  if (!step) throw new Error("INVALID_INPUT: no operation step found in plan");
  return step;
}

function buildCombinedPlan(input: RecordEffortAndAnalysisInput): Plan {
  const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
  const effort = { initialEstimate: 0, actual: input.actual };
  const analysis = {
    planningReview: input.planningReview,
    executionReview: input.executionReview,
    improvementSuggestions: input.improvementSuggestions ?? "",
  };

  const effortPlan = workPackageUseCase.recordActualEffort(identifier, effort);
  const analysisPlan = workPackageUseCase.recordAnalysis(identifier, analysis);

  return {
    summary: `Record effort + analysis for WP: ${input.identifier.title}`,
    steps: [
      effortPlan.steps[0],
      findOperationStep(effortPlan),
      findOperationStep(analysisPlan),
    ],
  };
}

if (import.meta.main) {
  runCli<RecordEffortAndAnalysisInput>({
    validate: validateInput,
    buildPlan: buildCombinedPlan,
    executePlan(plan) {
      return workPackageUseCase.executePlan(plan);
    },
  });
}
