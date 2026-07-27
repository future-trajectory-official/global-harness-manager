#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface CompleteWpInput {
  identifier: { title: string; id: string; code?: string };
}

function validateInput(input: CompleteWpInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
}

if (import.meta.main) {
  runCli<CompleteWpInput>({
    validate: validateInput,
    buildPlan(input) {
      const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
      return workPackageUseCase.complete(identifier);
    },
    executePlan(plan) {
      return workPackageUseCase.executePlan(plan);
    },
  });
}
