#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify } from "../../../../../core/domain/types.ts";
import type { EntityScope, ReviewSearchCondition, Step } from "../../../../../core/domain/types.ts";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import { PlanGatewayAdapter } from "../../../../../core/gateway/plan-gateway-adapter.ts";
import { ConfigGatewayAdapter } from "../../../../../core/gateway/config-gateway-adapter.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface ArchiveSprintReviewInput {
  scope?: EntityScope;
  sprintNumber?: number;
  code?: string;
}

function validateInput(input: ArchiveSprintReviewInput): void {
  if (
    input.sprintNumber != null && (!Number.isInteger(input.sprintNumber) || input.sprintNumber < 1)
  ) {
    throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
  }
  if (input.code != null && typeof input.code !== "string") {
    throw new Error("INVALID_INPUT: code must be a string");
  }
}

async function resolveScope(): Promise<EntityScope> {
  const config = new ConfigGatewayAdapter("", "");
  return await config.resolveScope();
}

async function detectCurrentSprint(): Promise<number> {
  const cmd = new Deno.Command("gh", {
    args: ["milestone", "list", "--state", "open", "--json", "number,title", "--limit", "1"],
  });
  const result = await cmd.output();
  if (!result.success) {
    throw new Error("Failed to detect current sprint from milestones: gh command failed");
  }
  const milestones = JSON.parse(new TextDecoder().decode(result.stdout)) as Array<{
    number: number;
    title: string;
  }>;
  if (milestones.length === 0) {
    throw new Error("No open milestones found. Cannot detect current sprint.");
  }
  return milestones[0].number;
}

async function searchReviewIssue(
  scope: EntityScope,
  sprintNumber: number,
): Promise<{ code: string; title: string }> {
  const searchCondition: ReviewSearchCondition = {
    sprintNumber,
    describe: () => ({
      summary: `Search reviews for Sprint ${sprintNumber}`,
      steps: [{
        entity: "Review",
        operation: "search",
        params: { labelType: "Review" },
      }] as unknown as readonly Step[],
    }),
  };

  const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
  const searchPlan = reviewUseCase.search(searchCondition);
  const searchResult = await gateway.execute(searchPlan);
  const searchOutput = searchResult.stepResults[0]?.output as
    | Array<{ number: number; title: string }>
    | undefined;

  if (!searchOutput || searchOutput.length === 0) {
    throw new Error(`No Review Issue found for Sprint ${sprintNumber}`);
  }

  const milestone = `Sprint ${sprintNumber}`;
  const reviewIssue = searchOutput.find((item) => item.title.includes(milestone));
  const target = reviewIssue ?? searchOutput[0];

  return { code: String(target.number), title: target.title };
}

async function findReviewIssue(
  scope: EntityScope,
  code: string,
  title: string,
): Promise<{ overallResult?: { judgment: string; reason: string }; body?: string }> {
  const tempIdentifier = identify(scope, title, "pending", code);

  const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
  const findPlan = reviewUseCase.find(tempIdentifier);
  const findResult = await gateway.execute(findPlan);
  const findOutput = findResult.stepResults[0]?.output as
    | { body?: string; overallResult?: { judgment: string; reason: string } }
    | undefined;

  return findOutput ?? {};
}

function parseOverallResultFromBody(body?: string): { judgment?: string; reason?: string } {
  if (!body) return {};

  const judgmentMatch = body.match(/##\s*総合判定\s*\n\s*(.+)/);
  const reasonMatch = body.match(/##\s*判定理由\s*\n\s*(.+)/);

  const judgment = judgmentMatch?.[1]?.trim();
  const reason = reasonMatch?.[1]?.trim();

  if (!judgment) return {};

  const judgmentMap: Record<string, string> = {
    "合格": "pass",
    "条件付き合格": "conditional",
    "不合格": "fail",
  };

  return {
    judgment: judgmentMap[judgment] ?? judgment,
    reason,
  };
}

async function resolveSprintNumber(input: ArchiveSprintReviewInput): Promise<number> {
  if (input.sprintNumber) return input.sprintNumber;
  return await detectCurrentSprint();
}

async function handleExamine(
  input: ArchiveSprintReviewInput,
  scope: EntityScope,
): Promise<void> {
  const sprintNumber = await resolveSprintNumber(input);
  const { code, title } = await searchReviewIssue(scope, sprintNumber);
  const issue = await findReviewIssue(scope, code, title);

  const overallResult = issue.overallResult ?? parseOverallResultFromBody(issue.body);

  const output = {
    sprintNumber,
    reviewTitle: title,
    issueNumber: Number(code),
    overallResult: overallResult.judgment ? overallResult : null,
  };

  console.log(JSON.stringify(output, null, 2));
}

async function handleArchive(
  input: ArchiveSprintReviewInput,
  scope: EntityScope,
  dryRun: boolean,
): Promise<void> {
  const sprintNumber = await resolveSprintNumber(input);
  const { code, title } = await searchReviewIssue(scope, sprintNumber);

  const nodeId = code;
  const identifier = identify(scope, title, nodeId, code);
  const plan = reviewUseCase.archive(identifier);

  if (dryRun) {
    console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
    return;
  }

  const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
  const result = await gateway.execute(plan);
  console.log(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });

    const subcommand = args._[0] as string | undefined;
    if (!subcommand || (subcommand !== "examine" && subcommand !== "archive")) {
      throw new Error("USAGE: archive_sprint_review.ts <examine|archive> [--dry-run]");
    }

    const input = await readJsonFromStdin<ArchiveSprintReviewInput>();
    validateInput(input);

    const scope = input.scope ?? await resolveScope();

    if (subcommand === "examine") {
      await handleExamine(input, scope);
    } else {
      await handleArchive(input, scope, args["dry-run"]);
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
