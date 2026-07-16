#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import { sprintId } from "../../../../../core/domain/types.ts";
import type {
  EntityScope,
  ExecutionResult,
  SprintIdentifier,
} from "../../../../../core/domain/types.ts";
import { sprintUseCase } from "../../../../../core/domain/sprint-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface BeginSprintInput {
  sprintNumber: number;
  goal?: string;
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

    const input = await readJsonFromStdin<BeginSprintInput>();
    const scope = input.scope ?? { owner: "unknown", repository: "unknown" };

    if (input.goal) {
      const identifier = await resolveSprintIdentifier(
        scope,
        input.sprintNumber,
        input.milestoneNodeId,
        input.milestoneNumber,
      );
      const result = sprintUseCase.setGoal(identifier, { description: input.goal });
      if (args["dry-run"]) {
        console.log(JSON.stringify({ summary: result.summary, steps: result.steps }, null, 2));
      } else {
        const execResult = await sprintUseCase.executePlan(result);
        console.log(JSON.stringify(execResult, null, 2));
      }
    } else {
      const identifier = sprintId(scope, input.sprintNumber);
      const result = sprintUseCase.start(identifier);
      if (args["dry-run"]) {
        console.log(JSON.stringify({ summary: result.summary, steps: result.steps }, null, 2));
      } else {
        const execResult = await sprintUseCase.executePlan(result);
        console.log(JSON.stringify(execResult, null, 2));
      }
    }
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
