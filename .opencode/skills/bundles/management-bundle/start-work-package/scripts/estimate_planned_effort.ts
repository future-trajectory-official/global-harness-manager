#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import type { EffortRecord } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface EstimatePlannedEffortInput {
  identifier: { title: string; id: string; code?: string };
  plannedEstimate: number;
}

function validateInput(input: EstimatePlannedEffortInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (typeof input.plannedEstimate !== "number" || input.plannedEstimate < 0) {
    throw new Error("INVALID_INPUT: plannedEstimate must be a non-negative number");
  }
}

if (import.meta.main) {
  runCli<EstimatePlannedEffortInput>({
    validate: validateInput,
    buildPlan(input) {
      const effort: EffortRecord = { initialEstimate: 0, plannedEstimate: input.plannedEstimate };
      const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
      return workPackageUseCase.estimatePlannedEffort(identifier, effort);
    },
    executePlan(plan) {
      return workPackageUseCase.executePlan(plan);
    },
  });
}
