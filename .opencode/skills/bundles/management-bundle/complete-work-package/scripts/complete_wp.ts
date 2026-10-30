#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface CompleteWpInput {
  identifier: { title: string; id: string; code?: string };
  /** ✅化するAC番号。省略時は本文中の全ACを✅化する。 */
  acceptanceCriteria?: number[];
}

function validateInput(input: CompleteWpInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (input.acceptanceCriteria !== undefined) {
    if (!Array.isArray(input.acceptanceCriteria) || input.acceptanceCriteria.length === 0) {
      throw new Error(
        "INVALID_INPUT: acceptanceCriteria must be a non-empty array of positive integers",
      );
    }
    for (const number of input.acceptanceCriteria) {
      if (!Number.isInteger(number) || number <= 0) {
        throw new Error(
          "INVALID_INPUT: acceptanceCriteria must be a non-empty array of positive integers",
        );
      }
    }
  }
}

export { validateInput };

if (import.meta.main) {
  runCli<CompleteWpInput>({
    validate: validateInput,
    buildPlan(input) {
      const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
      return workPackageUseCase.complete(identifier, {
        acceptanceCriteria: input.acceptanceCriteria,
      });
    },
    executePlan(plan) {
      return workPackageUseCase.executePlan(plan);
    },
  });
}
