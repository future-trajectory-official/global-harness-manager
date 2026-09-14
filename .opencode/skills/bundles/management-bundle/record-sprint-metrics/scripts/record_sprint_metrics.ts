#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import "../../../../../core/composition-root.ts";
import type { EntityScope } from "../../../../../core/domain/types.ts";
import { UNKNOWN_SCOPE } from "../../../../../core/domain/types.ts";
import type { SprintMetrics } from "../../../../../core/domain/types.ts";
import { retrospectiveUseCase } from "../../../../../core/domain/retrospective-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";
import {
  assertByteLimit,
  dryRunTarget,
  resolveTarget,
  retrospectiveRef,
} from "../../../../../core/shared/retrospective-utils.ts";

interface RecordSprintMetricsInput {
  sprintNumber?: number;
  code?: string;
  title?: string;
  metrics?: {
    summary?: {
      goalAchievementScore: number;
      estimationAccuracyScore: number;
      qualityIntegrityScore: number;
      collaborationDisciplineScore: number;
      velocity: number;
    };
    goalAchievement: string;
    estimationAccuracy: string;
    qualityIntegrity: string;
    collaborationDiscipline: string;
    velocity: string;
  };
  reason?: { description: string };
  scope?: EntityScope;
}

function isScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function validateInput(input: RecordSprintMetricsInput): void {
  if (!input) throw new Error("INVALID_INPUT: input is required");
  if (input.code == null && input.sprintNumber == null) {
    throw new Error("INVALID_INPUT: code or sprintNumber is required");
  }
  if (input.code != null && String(input.code).trim() === "") {
    throw new Error("INVALID_INPUT: code must not be empty");
  }
  if (
    input.sprintNumber != null &&
    (!Number.isInteger(input.sprintNumber) || input.sprintNumber < 1)
  ) {
    throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
  }
  if (!input.metrics) throw new Error("INVALID_INPUT: metrics is required");
  const s = input.metrics.summary;
  if (!s || typeof s !== "object") {
    throw new Error("INVALID_INPUT: metrics.summary is required");
  }
  for (
    const [fieldName, value] of [
      ["metrics.summary.goalAchievementScore", s.goalAchievementScore],
      ["metrics.summary.estimationAccuracyScore", s.estimationAccuracyScore],
      ["metrics.summary.qualityIntegrityScore", s.qualityIntegrityScore],
      ["metrics.summary.collaborationDisciplineScore", s.collaborationDisciplineScore],
    ] as Array<[string, number]>
  ) {
    if (!isScore(value)) {
      throw new Error(`INVALID_INPUT: ${fieldName} must be an integer between 1 and 5`);
    }
  }
  if (typeof s.velocity !== "number" || !Number.isFinite(s.velocity) || s.velocity < 0) {
    throw new Error("INVALID_INPUT: metrics.summary.velocity must be a finite non-negative number");
  }
  for (
    const [fieldName, value] of [
      ["metrics.goalAchievement", input.metrics.goalAchievement],
      ["metrics.estimationAccuracy", input.metrics.estimationAccuracy],
      ["metrics.qualityIntegrity", input.metrics.qualityIntegrity],
      ["metrics.collaborationDiscipline", input.metrics.collaborationDiscipline],
      ["metrics.velocity", input.metrics.velocity],
    ] as Array<[string, string]>
  ) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`INVALID_INPUT: ${fieldName} must not be empty`);
    }
    assertByteLimit(value, fieldName);
  }
  if (
    !input.reason || typeof input.reason.description !== "string" ||
    input.reason.description.trim() === ""
  ) {
    throw new Error("INVALID_INPUT: reason.description must not be empty");
  }
}

export { validateInput };

/** validateInput 通過後に metrics を SprintMetrics 型として扱うためのアサーション。 */
type ValidMetricsInput = RecordSprintMetricsInput & {
  metrics: SprintMetrics;
  reason: { description: string };
};
function assertValidMetrics(
  input: RecordSprintMetricsInput,
): asserts input is ValidMetricsInput {
  if (!input.metrics || !input.metrics.summary || !input.reason) {
    throw new Error("INVALID_INPUT: metrics.summary and reason are required");
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<RecordSprintMetricsInput>();
    validateInput(input);
    assertValidMetrics(input);

    const scope = input.scope ?? UNKNOWN_SCOPE;

    if (args["dry-run"]) {
      const target = dryRunTarget(input);
      const plan = retrospectiveUseCase.recordSprintMetrics(
        retrospectiveRef(scope, target ?? { code: "0", title: "Retrospective" }),
        input.metrics,
        input.reason,
      );
      console.log(
        JSON.stringify(
          {
            summary: plan.summary,
            resolvedTarget: target ?? { note: "実行時に検索します" },
            steps: plan.steps,
          },
          null,
          2,
        ),
      );
      return;
    }

    const target = await resolveTarget(input);
    const plan = retrospectiveUseCase.recordSprintMetrics(
      retrospectiveRef(scope, target),
      input.metrics,
      input.reason,
    );
    const result = await retrospectiveUseCase.executePlan(plan);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
