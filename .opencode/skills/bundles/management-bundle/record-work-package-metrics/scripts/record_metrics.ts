#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import type { SessionMetrics } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface RecordMetricsInput {
  identifier: { title: string; id: string; code?: string };
  intentAlignmentScore: number;
  constraintAdherenceScore: number;
  contextExtractionScore: number;
  workSizeStabilityScore: number;
  intentAlignment?: string;
  constraintAdherence?: string;
  contextExtraction?: string;
  workSizeStability?: string;
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validateInput(input: RecordMetricsInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (!isInRange(input.intentAlignmentScore, 1, 5)) {
    throw new Error("INVALID_INPUT: intentAlignmentScore must be an integer between 1 and 5");
  }
  if (!isInRange(input.constraintAdherenceScore, 1, 5)) {
    throw new Error("INVALID_INPUT: constraintAdherenceScore must be an integer between 1 and 5");
  }
  if (!isInRange(input.contextExtractionScore, 1, 5)) {
    throw new Error("INVALID_INPUT: contextExtractionScore must be an integer between 1 and 5");
  }
  if (!isInRange(input.workSizeStabilityScore, 1, 5)) {
    throw new Error("INVALID_INPUT: workSizeStabilityScore must be an integer between 1 and 5");
  }
}

if (import.meta.main) {
  runCli<RecordMetricsInput>({
    validate: validateInput,
    buildPlan(input) {
      const metrics: SessionMetrics = {
        summary: {
          intentAlignmentScore: input.intentAlignmentScore,
          constraintAdherenceScore: input.constraintAdherenceScore,
          contextExtractionScore: input.contextExtractionScore,
          workSizeStabilityScore: input.workSizeStabilityScore,
        },
        intentAlignment: input.intentAlignment ?? "",
        constraintAdherence: input.constraintAdherence ?? "",
        contextExtraction: input.contextExtraction ?? "",
        workSizeStability: input.workSizeStability ?? "",
      };
      const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
      return workPackageUseCase.recordSessionMetrics(identifier, metrics);
    },
    executePlan(plan) {
      return workPackageUseCase.executePlan(plan);
    },
  });
}
