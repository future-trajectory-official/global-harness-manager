#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify } from "../../../../../core/domain/types.ts";
import type {
  AcceptanceCriterias,
  AcGroup,
  ChangeReason,
  EntityScope,
  ReviewSearchCondition,
  Step,
} from "../../../../../core/domain/types.ts";
import { reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import { PlanGatewayAdapter } from "../../../../../core/gateway/plan-gateway-adapter.ts";
import { ConfigGatewayAdapter } from "../../../../../core/gateway/config-gateway-adapter.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface RemovedAc {
  number: string;
  description: string;
}

interface AddedAcJudgment {
  number: string;
  description: string;
}

interface AddedGroup {
  pbiNumber: number;
  pbiTitle?: string;
  wpNumber: number;
  wpTitle?: string;
  acJudgments: AddedAcJudgment[];
}

interface ReviseSprintReviewInput {
  scope?: EntityScope;
  sprintNumber?: number;
  code?: string;
  changeReason?: string;
  removed?: {
    items: RemovedAc[];
  };
  addedGroups?: AddedGroup[];
}

export function validateCommonInput(input: ReviseSprintReviewInput): void {
  if (input.sprintNumber == null && input.code == null) {
    throw new Error("INVALID_INPUT: either sprintNumber or code is required");
  }
  if (
    input.sprintNumber != null &&
    (!Number.isInteger(input.sprintNumber) || input.sprintNumber < 1)
  ) {
    throw new Error("INVALID_INPUT: sprintNumber must be a positive integer");
  }
  if (input.code != null && typeof input.code !== "string") {
    throw new Error("INVALID_INPUT: code must be a string");
  }
}

export function validateReviseInput(input: ReviseSprintReviewInput): void {
  validateCommonInput(input);
  if (input.changeReason == null || typeof input.changeReason !== "string") {
    throw new Error("INVALID_INPUT: changeReason is required");
  }
  if (input.changeReason.trim() === "") {
    throw new Error("INVALID_INPUT: changeReason must not be empty");
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

async function resolveSprintNumber(input: ReviseSprintReviewInput): Promise<number> {
  if (input.sprintNumber) return input.sprintNumber;
  return await detectCurrentSprint();
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
): Promise<{ body?: string }> {
  const tempIdentifier = identify(scope, title, "pending", code);

  const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
  const findPlan = reviewUseCase.find(tempIdentifier);
  const findResult = await gateway.execute(findPlan);
  const findOutput = findResult.stepResults[0]?.output as
    | { body?: string }
    | undefined;

  return findOutput ?? {};
}

async function handleExamine(
  input: ReviseSprintReviewInput,
  scope: EntityScope,
): Promise<void> {
  validateCommonInput(input);

  const sprintNumber = await resolveSprintNumber(input);
  const { code, title } = input.code
    ? { code: input.code, title: `Sprint ${sprintNumber} Review` }
    : await searchReviewIssue(scope, sprintNumber);
  const issue = await findReviewIssue(scope, code, title);

  const output = {
    sprintNumber,
    reviewTitle: title,
    issueNumber: Number(code),
    body: issue.body,
  };

  console.log(JSON.stringify(output, null, 2));
}

function toAcceptanceCriterias(removed?: { items: RemovedAc[] }): AcceptanceCriterias | undefined {
  if (!removed || removed.items.length === 0) return undefined;
  return {
    items: removed.items.map((item) => ({
      number: item.number,
      description: item.description,
      judgment: "removed" as const,
    })),
  };
}

function toAcGroups(addedGroups?: AddedGroup[]): AcGroup[] | undefined {
  if (!addedGroups || addedGroups.length === 0) return undefined;
  return addedGroups.map((group) => ({
    pbiNumber: group.pbiNumber,
    wpNumber: group.wpNumber,
    acJudgments: group.acJudgments.map((ac) => ({
      number: ac.number,
      description: ac.description,
      judgment: "unchecked" as const,
    })),
  }));
}

async function handleRevise(
  input: ReviseSprintReviewInput,
  scope: EntityScope,
  dryRun: boolean,
): Promise<void> {
  validateReviseInput(input);

  const sprintNumber = await resolveSprintNumber(input);
  const { code, title } = input.code
    ? { code: input.code, title: `Sprint ${sprintNumber} Review` }
    : await searchReviewIssue(scope, sprintNumber);

  const tempIdentifier = identify(scope, title, "pending", code);
  const findPlan = reviewUseCase.find(tempIdentifier);
  const gateway = new PlanGatewayAdapter(scope.owner, scope.repository);
  const findResult = await gateway.execute(findPlan);
  const findOutput = findResult.stepResults[0]?.output as
    | { id?: string; number?: number }
    | undefined;

  const nodeId = findOutput?.id ?? code;
  const resolvedIdentifier = identify(scope, title, nodeId, code);

  const removed = toAcceptanceCriterias(input.removed);
  const addedGroups = toAcGroups(input.addedGroups);
  const reason: ChangeReason = { description: input.changeReason! };

  const plan = reviewUseCase.revise(
    resolvedIdentifier,
    removed,
    undefined,
    reason,
    addedGroups,
  );

  if (dryRun) {
    console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
    return;
  }

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
    if (!subcommand || (subcommand !== "examine" && subcommand !== "revise")) {
      throw new Error("USAGE: revise_sprint_review.ts <examine|revise> [--dry-run]");
    }

    const input = await readJsonFromStdin<ReviseSprintReviewInput>();
    const scope = input.scope ?? await resolveScope();

    if (subcommand === "examine") {
      await handleExamine(input, scope);
    } else {
      await handleRevise(input, scope, args["dry-run"]);
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
