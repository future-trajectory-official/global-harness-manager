#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { pbiId, Size } from "../../../../../core/domain/types.ts";
import type { Plan } from "../../../../../core/domain/types.ts";
import { productBacklogItemUseCase } from "../../../../../core/domain/product-backlog-item-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

interface RecordPbiSizeAnalysisInput {
  identifier: { title: string; id: string; code?: string };
  sizeActual: string;
  varianceReason?: string;
}

function validateInput(input: RecordPbiSizeAnalysisInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (!input.sizeActual) throw new Error("INVALID_INPUT: sizeActual must not be empty");
  const size = Size.fromString(input.sizeActual);
  if (!size) {
    throw new Error(
      `INVALID_INPUT: sizeActual must be one of ${Size.values.map((s) => s.display).join("/")}`,
    );
  }
}

function buildPlan(input: RecordPbiSizeAnalysisInput): Plan {
  const identifier = pbiId(input.identifier.title, input.identifier.id, input.identifier.code);
  const size = Size.fromString(input.sizeActual);
  if (!size) throw new Error("INVALID_INPUT: sizeActual is invalid");
  return productBacklogItemUseCase.confirmSize(identifier, {
    actual: size,
    varianceReason: input.varianceReason ?? "",
  });
}

export { buildPlan, validateInput };

if (import.meta.main) {
  runCli<RecordPbiSizeAnalysisInput>({
    validate: validateInput,
    buildPlan,
    executePlan(plan) {
      return productBacklogItemUseCase.executePlan(plan);
    },
  });
}
