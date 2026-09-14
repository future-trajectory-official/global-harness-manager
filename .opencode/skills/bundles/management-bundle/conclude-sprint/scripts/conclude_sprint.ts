#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { sprintId } from "../../../../../core/domain/types.ts";
import type { EntityScope, SprintIdentifier } from "../../../../../core/domain/types.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";
import type { ExecutionResult } from "../../../../../core/domain/types.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface ConcludeSprintInput {
  sprintNumber: number;
  milestoneNodeId?: string;
  milestoneNumber?: string;
  scope?: EntityScope;
}

async function resolveSprintIdentifier(
  scope: EntityScope,
  sprintNumber: number,
  milestoneNodeId?: string,
  milestoneNumber?: string,
): Promise<SprintIdentifier> {
  if (milestoneNodeId && milestoneNumber) {
    return sprintId(scope, sprintNumber, milestoneNodeId, milestoneNumber);
  }
  const findPlan = sprintUseCase.find();
  const findResult = await sprintUseCase.executePlan(findPlan) as ExecutionResult;
  const milestones = findResult.stepResults?.[1]?.output as
    | Array<{ number: number; id?: string }>
    | undefined;
  const milestoneInfo = findResult.stepResults?.[2]?.output as
    | { id?: string; number?: number }
    | undefined;
  const id = milestoneInfo?.id ?? milestones?.[0]?.id;
  const code = String(milestoneInfo?.number ?? milestones?.[0]?.number ?? "");
  return sprintId(scope, sprintNumber, id, code);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<ConcludeSprintInput>();
    const scope = input.scope ?? { owner: "unknown", repository: "unknown" };

    const identifier = await resolveSprintIdentifier(
      scope,
      input.sprintNumber,
      input.milestoneNodeId,
      input.milestoneNumber,
    );

    const plan = sprintUseCase.end(identifier);
    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
      return;
    }

    const execResult = await sprintUseCase.executePlan(plan);
    console.log(JSON.stringify(execResult, null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
