#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { type EffortSummary, pbiId } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface RecordPbiEffortAnalysisInput {
  identifier: { title: string; id: string; code?: string };
  planningReview?: string;
  executionReview?: string;
  improvementSuggestions?: string;
  effortSummary?: EffortSummary;
}

function hasAnalysis(input: RecordPbiEffortAnalysisInput): boolean {
  return input.planningReview !== undefined ||
    input.executionReview !== undefined ||
    input.improvementSuggestions !== undefined ||
    input.effortSummary !== undefined;
}

export { buildPlan, hasAnalysis, validateInput };

function validateInput(input: RecordPbiEffortAnalysisInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (hasAnalysis(input) && !input.planningReview) {
    throw new Error("INVALID_INPUT: planningReview must not be empty when recording analysis");
  }
  if (hasAnalysis(input) && !input.effortSummary) {
    throw new Error(
      "INVALID_INPUT: effortSummary is required when recording analysis (wp_effort_summary must be recorded to harness-effort-summary)",
    );
  }
  if (hasAnalysis(input) && input.effortSummary) {
    const { initialEstimate, plannedEstimate, actual } = input.effortSummary;
    for (const [key, value] of Object.entries({ initialEstimate, plannedEstimate, actual })) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(
          `INVALID_INPUT: effortSummary.${key} must be a finite non-negative number`,
        );
      }
    }
  }
}

function findOperationStep(plan: Plan): Plan["steps"][number] {
  const step = plan.steps.find((s) => s.entity !== "Scope");
  if (!step) throw new Error("INVALID_INPUT: no operation step found in plan");
  return step;
}

function buildPlan(input: RecordPbiEffortAnalysisInput): Plan {
  const identifier = pbiId(input.identifier.title, input.identifier.id, input.identifier.code);

  const effortPlan = productBacklogItemUseCase.analyzeEffort(identifier);

  if (!hasAnalysis(input)) {
    return effortPlan;
  }

  const analysis = {
    planningReview: input.planningReview ?? "",
    executionReview: input.executionReview ?? "",
    improvementSuggestions: input.improvementSuggestions ?? "",
    effortSummary: input.effortSummary,
  };
  const analysisPlan = productBacklogItemUseCase.recordAnalysis(identifier, analysis);

  return {
    summary: `Record effort analysis for PBI: ${input.identifier.title}`,
    steps: [
      effortPlan.steps[0],
      findOperationStep(effortPlan),
      findOperationStep(analysisPlan),
    ],
  };
}

if (import.meta.main) {
  runCli<RecordPbiEffortAnalysisInput>({
    validate: validateInput,
    buildPlan,
    executePlan(plan) {
      return productBacklogItemUseCase.executePlan(plan);
    },
  });
}
