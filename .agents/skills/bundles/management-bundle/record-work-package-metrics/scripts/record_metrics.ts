#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import type { SessionMetrics } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface RecordMetricsInput {
  identifier: { title: string; id: string; code?: string };
  intentAlignmentRate: number;
  constraintAdherenceScore: number;
  contextExtractionQuality: number;
  workSizeStability: number;
  comment?: string;
}

function isInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function validateInput(input: RecordMetricsInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (!isInRange(input.intentAlignmentRate, 1, 5)) {
    throw new Error("INVALID_INPUT: intentAlignmentRate must be an integer between 1 and 5");
  }
  if (!isInRange(input.constraintAdherenceScore, 1, 5)) {
    throw new Error("INVALID_INPUT: constraintAdherenceScore must be an integer between 1 and 5");
  }
  if (!isInRange(input.contextExtractionQuality, 1, 5)) {
    throw new Error("INVALID_INPUT: contextExtractionQuality must be an integer between 1 and 5");
  }
  if (!isInRange(input.workSizeStability, 1, 5)) {
    throw new Error("INVALID_INPUT: workSizeStability must be an integer between 1 and 5");
  }
}

if (import.meta.main) {
  runCli<RecordMetricsInput>({
    validate: validateInput,
    buildPlan(input) {
      const metrics: SessionMetrics = {
        intentAlignmentRate: input.intentAlignmentRate,
        constraintAdherenceScore: input.constraintAdherenceScore,
        contextExtractionQuality: input.contextExtractionQuality,
        workSizeStability: input.workSizeStability,
        comment: input.comment ?? "",
      };
      const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
      return workPackageUseCase.recordSessionMetrics(identifier, metrics);
    },
    executePlan(plan) {
      return workPackageUseCase.executePlan(plan);
    },
  });
}
