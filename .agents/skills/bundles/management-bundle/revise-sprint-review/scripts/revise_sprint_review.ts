#!/usr/bin/env -S deno run -A
import { parseArgs } from "@std/cli/parse-args";
import { identify, sprintId } from "../../../../../core/domain/types.ts";
import type {
  AcceptanceCriterias,
  AcGroup,
  ChangeReason,
  EntityScope,
  ReviewSearchCondition,
  SprintIdentifier,
  Step,
} from "../../../../../core/domain/types.ts";
import { REVIEW_MARKERS, reviewUseCase } from "../../../../../core/domain/review-usecase.ts";
import type { PlanGateway } from "../../../../../core/domain/plan-gateway.ts";
import { executePlan } from "../../../../../core/domain/plan-executor.ts";
import type { PlanResult } from "../../../../../core/gateway/plan-gateway-adapter.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";
import { detectCurrentSprint, sprintNumberFrom } from "../../../../../core/shared/sprint-utils.ts";

interface RemovedAc {
  number: string;
  description: string;
  pbiNumber?: number;
  wpNumber?: string;
}

interface AddedAcJudgment {
  number: string;
  description: string;
}

interface AddedGroup {
  pbiNumber: number;
  pbiTitle?: string;
  wpNumber: string;
  wpTitle?: string;
  acJudgments: AddedAcJudgment[];
}

interface ReviseSprintReviewInput {
  sprintNumber?: number;
  code?: string;
  changeReason?: string;
  removed?: {
    items: RemovedAc[];
  };
  addedGroups?: AddedGroup[];
  scope?: EntityScope;
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

async function resolveSprintIdentifier(
  input: ReviseSprintReviewInput,
  scope: EntityScope,
): Promise<SprintIdentifier> {
  if (input.sprintNumber != null) return sprintId(scope, input.sprintNumber);
  return await detectCurrentSprint(scope);
}

async function searchReviewIssue(
  _scope: EntityScope,
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

  const { PlanGatewayAdapter } = await import(
    "../../../../../core/gateway/plan-gateway-adapter.ts"
  );
  const gateway: PlanGateway = new PlanGatewayAdapter();
  const searchPlan = reviewUseCase.search(searchCondition);
  const searchResult = await executePlan(searchPlan, gateway) as PlanResult;
  const searchOutput = searchResult.getStep("Review", "search")?.output as
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

  const { PlanGatewayAdapter } = await import(
    "../../../../../core/gateway/plan-gateway-adapter.ts"
  );
  const gateway: PlanGateway = new PlanGatewayAdapter();
  const findPlan = reviewUseCase.find(tempIdentifier);
  const findResult = await executePlan(findPlan, gateway) as PlanResult;
  const findOutput = findResult.getStep("Review", "view")?.output as
    | { body?: string }
    | undefined;

  return findOutput ?? {};
}

export interface ParsedReviewContent {
  sprintGoal?: string;
  pbis: Array<{
    number: number;
    title: string;
    summary?: string;
    wps: Array<{ number: string; title: string; summary?: string }>;
  }>;
}

const SUMMARY_RE = new RegExp(`^${escapeRegex(REVIEW_MARKERS.summaryPrefix)}\\s*(.+)$`, "m");
const PBI_RE = new RegExp(
  `^${escapeRegex(REVIEW_MARKERS.pbiMarker)}\\s*\\[(\\d+)\\]\\s*(.+)$`,
  "gm",
);
const WP_RE = new RegExp(`^${escapeRegex(REVIEW_MARKERS.wpMarker)}([a-zA-Z0-9]+):\\s*(.+)$`, "gm");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Review Issue 本文から sprint goal / PBI/WP summary を抽出する。セクションがない場合は undefined を返す。 */
export function parseReviewBody(body: string | undefined): ParsedReviewContent {
  const result: ParsedReviewContent = { pbis: [] };
  if (!body) return result;

  const sprintGoalHeading = escapeRegex(REVIEW_MARKERS.sprintGoalHeading);
  const sprintGoalRe = new RegExp(`^${sprintGoalHeading}\\s*\\n\\n([\\s\\S]*?)(?:\\n## |$)`, "m");
  const sprintGoalMatch = body.match(sprintGoalRe);
  if (sprintGoalMatch) {
    const trimmed = sprintGoalMatch[1].trim();
    if (trimmed.length > 0) result.sprintGoal = trimmed;
  }

  const pbiMatches = Array.from(body.matchAll(PBI_RE));
  const pbiEntries: ParsedReviewContent["pbis"] = [];

  for (let i = 0; i < pbiMatches.length; i++) {
    const pbiMatch = pbiMatches[i];
    const pbiNumber = parseInt(pbiMatch[1], 10);
    const pbiTitle = pbiMatch[2].trim();

    const pbiStart = pbiMatch.index + pbiMatch[0].length;
    const nextPbiMatch = pbiMatches[i + 1];
    const pbiSection = body.slice(pbiStart, nextPbiMatch ? nextPbiMatch.index : body.length);

    const pbiSummary = pbiSection.match(SUMMARY_RE)?.[1]?.trim() || undefined;

    const wpMatches = Array.from(pbiSection.matchAll(WP_RE));
    const wpEntries: Array<{ number: string; title: string; summary?: string }> = [];

    for (let j = 0; j < wpMatches.length; j++) {
      const wpMatch = wpMatches[j];
      const wpNumber = wpMatch[1];
      const wpTitle = wpMatch[2].trim();
      const wpStart = wpMatch.index + wpMatch[0].length;
      const nextWpMatch = wpMatches[j + 1];
      const wpSection = pbiSection.slice(
        wpStart,
        nextWpMatch ? nextWpMatch.index : pbiSection.length,
      );

      const wpSummary = wpSection.match(SUMMARY_RE)?.[1]?.trim() || undefined;
      wpEntries.push({ number: wpNumber, title: wpTitle, summary: wpSummary });
    }

    pbiEntries.push({
      number: pbiNumber,
      title: pbiTitle,
      summary: pbiSummary,
      wps: wpEntries,
    });
  }

  result.pbis = pbiEntries;
  return result;
}

async function handleExamine(
  input: ReviseSprintReviewInput,
  scope: EntityScope,
): Promise<void> {
  validateCommonInput(input);

  const sprintIdentifier = await resolveSprintIdentifier(input, scope);
  const sprintNumber = sprintNumberFrom(sprintIdentifier);
  const { code, title } = input.code
    ? { code: input.code, title: `Sprint ${sprintNumber} Review` }
    : await searchReviewIssue(scope, sprintNumber);
  const issue = await findReviewIssue(scope, code, title);

  const parsed = parseReviewBody(issue.body);

  const output: Record<string, unknown> = {
    sprintNumber,
    reviewTitle: title,
    issueNumber: Number(code),
    body: issue.body,
    sprintGoal: parsed.sprintGoal,
    pbis: parsed.pbis,
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
    pbiTitle: group.pbiTitle,
    wpNumber: group.wpNumber,
    wpTitle: group.wpTitle,
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

  const sprintIdentifier = await resolveSprintIdentifier(input, scope);
  const sprintNumber = sprintNumberFrom(sprintIdentifier);
  const { code, title } = input.code
    ? { code: input.code, title: `Sprint ${sprintNumber} Review` }
    : await searchReviewIssue(scope, sprintNumber);

  const tempIdentifier = identify(scope, title, "pending", code);
  const findPlan = reviewUseCase.find(tempIdentifier);
  const { PlanGatewayAdapter } = await import(
    "../../../../../core/gateway/plan-gateway-adapter.ts"
  );
  const gateway: PlanGateway = new PlanGatewayAdapter();
  const findResult = await executePlan(findPlan, gateway) as PlanResult;
  const findOutput = findResult.getStep("Review", "view")?.output as
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

  const scopedRemovals = input.removed?.items?.filter(
    (i): i is RemovedAc & { pbiNumber: number; wpNumber: string } =>
      i.pbiNumber != null && i.wpNumber != null,
  );
  if (scopedRemovals && scopedRemovals.length > 0) {
    (plan.steps[0].params as Record<string, unknown>).removedScoped = scopedRemovals;
  }

  if (dryRun) {
    console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
    return;
  }

  const result = await executePlan(plan, gateway);
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
    const scope = input.scope ?? { owner: "unknown", repository: "unknown" };

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
