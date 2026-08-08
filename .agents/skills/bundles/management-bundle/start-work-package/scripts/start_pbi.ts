#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { pbiId } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface StartPbiInput {
  identifier: { title: string; id: string; code?: string };
}

function validateInput(input: StartPbiInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
}

export { validateInput };

if (import.meta.main) {
  runCli<StartPbiInput>({
    validate: validateInput,
    buildPlan(input) {
      const identifier = pbiId(input.identifier.title, input.identifier.id, input.identifier.code);
      return productBacklogItemUseCase.start(identifier);
    },
    executePlan(plan) {
      return productBacklogItemUseCase.executePlan(plan);
    },
  });
}
