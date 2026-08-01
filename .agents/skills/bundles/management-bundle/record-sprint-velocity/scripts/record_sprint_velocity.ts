#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { sprintRef } from "../../../../../core/domain/types.ts";
import { sprintUseCase, type VelocityMetrics } from "../../../../../core/domain/sprint-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface RecordSprintVelocityInput {
  identifier: { title: string; id: string; code?: string };
  velocity: VelocityMetrics;
}

function validateInput(input: RecordSprintVelocityInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (!input.velocity) throw new Error("INVALID_INPUT: velocity is required");
  if (!Number.isInteger(input.velocity.sprintNumber) || input.velocity.sprintNumber < 1) {
    throw new Error("INVALID_INPUT: velocity.sprintNumber must be a positive integer");
  }
  if (
    !Number.isInteger(input.velocity.pbiCount) || !Number.isInteger(input.velocity.totalWeight) ||
    input.velocity.pbiCount < 0 || input.velocity.totalWeight < 0
  ) {
    throw new Error("INVALID_INPUT: pbiCount and totalWeight must be non-negative integers");
  }
  if (
    typeof input.velocity.matchRate !== "number" ||
    !Number.isFinite(input.velocity.matchRate) ||
    input.velocity.matchRate < 0 ||
    input.velocity.matchRate > 1
  ) {
    throw new Error("INVALID_INPUT: matchRate must be a number between 0 and 1");
  }
  if (typeof input.velocity.summary !== "string" || input.velocity.summary.trim() === "") {
    throw new Error("INVALID_INPUT: velocity.summary must not be empty");
  }
  if (
    input.identifier.code !== undefined &&
    Number(input.identifier.code) !== input.velocity.sprintNumber
  ) {
    throw new Error(
      "INVALID_INPUT: identifier.code must match velocity.sprintNumber",
    );
  }
}

export { validateInput };

if (import.meta.main) {
  runCli<RecordSprintVelocityInput>({
    validate: validateInput,
    buildPlan(input) {
      const identifier = sprintRef(
        input.velocity.sprintNumber,
        input.identifier.id,
        input.identifier.code,
      );
      return sprintUseCase.recordVelocity(identifier, input.velocity);
    },
    executePlan(plan) {
      return sprintUseCase.executePlan(plan);
    },
  });
}
