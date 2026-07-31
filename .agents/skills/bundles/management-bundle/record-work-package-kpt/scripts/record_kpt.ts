#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { wpId } from "../../../../../core/domain/types.ts";
import type { KeepProblemTryAdvice } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { runCli } from "../../../../../core/shared/cli/runner.ts";

export interface RecordKptInput {
  identifier: { title: string; id: string; code?: string };
  keep: string;
  problem: string;
  try: string;
  advise?: string;
}

export function validateInput(input: RecordKptInput): void {
  if (!input.identifier) throw new Error("INVALID_INPUT: identifier is required");
  if (!input.identifier.id) throw new Error("INVALID_INPUT: identifier.id must not be empty");
  if (!input.keep) throw new Error("INVALID_INPUT: keep must not be empty");
  if (!input.problem) throw new Error("INVALID_INPUT: problem must not be empty");
  if (!input.try) throw new Error("INVALID_INPUT: try must not be empty");
  const MAX_BYTES = 1024;
  const over = (["keep", "problem", "try", "advise"] as const).filter((key) => {
    const value = input[key] ?? "";
    return new TextEncoder().encode(value).length > MAX_BYTES;
  });
  if (over.length > 0) {
    throw new Error(
      `INVALID_INPUT: ${
        over.join(", ")
      } exceeds the Projects V2 TEXT limit of ${MAX_BYTES} bytes (UTF-8 Japanese is about 340 chars)`,
    );
  }
}

if (import.meta.main) {
  runCli<RecordKptInput>({
    validate: validateInput,
    buildPlan(input) {
      const kpt: KeepProblemTryAdvice = {
        keep: input.keep,
        problem: input.problem,
        try: input.try,
        advise: input.advise ?? "",
      };
      const identifier = wpId(input.identifier.title, input.identifier.id, input.identifier.code);
      return workPackageUseCase.recordKpt(identifier, kpt);
    },
    executePlan(plan) {
      return workPackageUseCase.executePlan(plan);
    },
  });
}
