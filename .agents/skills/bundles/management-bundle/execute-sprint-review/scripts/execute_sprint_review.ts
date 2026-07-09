#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify, sprintId, UNKNOWN_SCOPE } from "../../../../../core/domain/types.ts";
import type { EntityScope, ReviewSearchCondition, Step } from "../../../../../core/domain/types.ts";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import { PlanGatewayAdapter } from "../../../../../core/gateway/plan-gateway-adapter.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface AcJudgment {
  number: string;
  judgment: "pass" | "fail" | "conditional";
  description?: string;
}

interface AcGroup {
  pbiNumber: number;
  pbiTitle?: string;
  wpNumber: string;
  wpTitle?: string;
  acJudgments: AcJudgment[];
}

interface ExecuteSprintReviewInput {
  sprintNumber: number;
  overallResult: {
    judgment: "pass" | "conditional" | "fail";
    reason: string;
  };
  acGroups: AcGroup[];
  scope?: EntityScope;
}

export function validateInput(input: ExecuteSprintReviewInput): void {
  if (
    input.sprintNumber == null || !Number.isInteger(input.sprintNumber) || input.sprintNumber < 1
  ) {
    throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
  }
  if (!input.overallResult || !input.overallResult.judgment) {
    throw new Error("INVALID_INPUT: overallResult.judgment is required");
  }
  const validJudgments = ["pass", "conditional", "fail"];
  if (!validJudgments.includes(input.overallResult.judgment)) {
    throw new Error(
      `INVALID_INPUT: overallResult.judgment must be one of: ${validJudgments.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const input = await readJsonFromStdin<ExecuteSprintReviewInput>();
    validateInput(input);

    const scope = input.scope ?? UNKNOWN_SCOPE;
    const sprint = sprintId(scope, input.sprintNumber);
    const reviewTitle = `Sprint ${input.sprintNumber} Review`;

    const searchCondition: ReviewSearchCondition = {
      sprintNumber: input.sprintNumber,
      describe: () => ({
        summary: `Search reviews for Sprint ${input.sprintNumber}`,
        steps: [{
          entity: "Review",
          operation: "search",
          params: { labelType: "Review" },
        }] as unknown as readonly Step[],
      }),
    };

    if (args["dry-run"]) {
      const combinedPlan = {
        summary: `Execute sprint review: ${reviewTitle}`,
        steps: [
          { entity: "Review", operation: "search", params: { labelType: "Review" } },
          { entity: "Review", operation: "view", params: { itemId: "<issue-number>" } },
          { entity: "Review", operation: "report", params: { overallResult: input.overallResult } },
          { entity: "Review", operation: "update", params: { body: "Attach report results" } },
        ],
      };
      console.log(JSON.stringify(combinedPlan, null, 2));
      return;
    }

    const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);

    const searchPlan = reviewUseCase.search(searchCondition);
    const searchResult = await gateway.execute(searchPlan);
    const searchOutput = searchResult.stepResults[0]?.output as
      | Array<{ number: number; title: string }>
      | undefined;

    if (!searchOutput || searchOutput.length === 0) {
      console.error(`No Review Issue found for Sprint ${input.sprintNumber}`);
      Deno.exit(1);
    }

    const milestone = sprint.title.value;
    const reviewIssue = searchOutput.find((item) => item.title.includes(milestone));
    const targetNumber = reviewIssue?.number ?? searchOutput[0].number;

    const tempIdentifier = identify(scope, reviewTitle, "pending", String(targetNumber));
    const findPlan = reviewUseCase.find(tempIdentifier);
    const findResult = await gateway.execute(findPlan);
    const findOutput = findResult.stepResults[0]?.output as
      | { id?: string; number?: number }
      | undefined;

    const nodeId = findOutput?.id ?? String(targetNumber);
    const resolvedIdentifier = identify(scope, reviewTitle, nodeId, String(targetNumber));

    const postPlanAcGroups = input.acGroups.map((ag) => ({
      pbiNumber: ag.pbiNumber,
      pbiTitle: ag.pbiTitle,
      wpNumber: ag.wpNumber,
      wpTitle: ag.wpTitle,
      acJudgments: ag.acJudgments.map((acj) => ({
        number: acj.number,
        judgment: acj.judgment,
        description: acj.description ?? "",
      })),
    }));

    const reviewData = {
      identifier: resolvedIdentifier,
      statement: { environment: "production" },
      sprint,
      plannedAcGroups: [],
      postPlanAcGroups,
      overallResult: input.overallResult,
      state: "open" as const,
    };

    const reportPlan = reviewUseCase.report(reviewData);
    const reportResult = await gateway.execute(reportPlan);
    console.log(JSON.stringify(reportResult, null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
