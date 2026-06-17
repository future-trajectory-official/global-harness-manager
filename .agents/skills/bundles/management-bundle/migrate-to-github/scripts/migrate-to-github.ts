import { parseArgs } from "@std/cli/parse-args";
import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { Issue } from "../../../../../core/issue.ts";
import { createMilestone, listMilestones } from "../../../../../core/github.ts";
import type { IGitHubContext } from "../../../../../core/github.ts";
import { executeCommand } from "../../../../../core/command.ts";

const PROJECT_ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../../../../../..");

interface WorkPackage {
  name: string;
  effort: number;
  acList: string[];
  status: "pending" | "done";
}

interface PbiRecord {
  id: string;
  status: "TODO" | "WIP" | "DONE";
  title: string;
  size: string;
  description: string;
  proofMethod: string;
  wpList: WorkPackage[];
}

interface HarnessConfig {
  version: string;
  issueTemplate?: { path: string };
  projects?: { productBacklog: number; sprintBoard: number };
  milestone?: { template: string };
  customFields?: {
    type: string;
    size: string;
    status: string;
    sequence: string;
    effortInitial: string;
    effortPlaned: string;
    effortActual: string;
  };
  "harness-type"?: { options: string[] };
}

const DEFAULT_HARNESSRC_PATH = join(PROJECT_ROOT, ".harnessrc");
const FALLBACK_HARNESSRC_PATH = join(PROJECT_ROOT, ".github/schemas/harnessrc.example");
const DEFAULT_BACKLOG_PATH = join(PROJECT_ROOT, ".agents/management/product-backlog.md");

function extractFieldValue(body: string, fieldName: string): string {
  const regex = new RegExp(
    `^- \\*\\*${fieldName}\\*\\*:\\s*([\\s\\S]*?)(?=\\n- \\*\\*|\\n####|\\n###)`,
  );
  const match = body.match(regex);
  if (!match) return "";
  return match[1].replace(/\n\s{2,}/g, " ").trim();
}

function parseBacklog(content: string): PbiRecord[] {
  const pbiBlocks: PbiRecord[] = [];
  const pbiRegex =
    /###\s+\[(TODO|WIP|DONE)\]\s+(\S+(?:\/\S+)*)\s*\n([\s\S]*?)(?=\n###\s+\[(?:TODO|WIP|DONE)\]|\n##(?!#)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pbiRegex.exec(content)) !== null) {
    const status = match[1] as PbiRecord["status"];
    const pbiId = match[2];
    const body = match[3];

    const description = extractFieldValue(body, "概要");
    const sizeMatch = body.match(/^- \*\*見積サイズ\*\*:\s*(\S+)/m);
    const proofMethod = extractFieldValue(body, "証明方法");

    const wpList: WorkPackage[] = [];
    const wpRegex =
      /####\s+(WP_[\w']+)\s*:\s*(.+)\n([\s\S]*?)(?=\n####\s+WP_|\n###\s+\[(?:TODO|WIP|DONE)\]|\n##(?!#)|$)/g;
    let wpMatch: RegExpExecArray | null;

    while ((wpMatch = wpRegex.exec(body)) !== null) {
      const wpName = `${wpMatch[1]}: ${wpMatch[2].trim()}`;
      const wpBody = wpMatch[3];

      const effortMatch = wpBody.match(/- \*\*Effort見積（介入回数）\*\*:\s*(\d+)回/);
      const effort = effortMatch ? parseInt(effortMatch[1], 10) : 0;

      const acList: string[] = [];
      const acRegex =
        /-\s+\[\s*.\s*\]\s+([\s\S]*?)(?=\n\s*-\s+\[\s*[ x]|\n\s*####|\n\s*###|\n\s*- \*\*|$)/g;
      let acMatch: RegExpExecArray | null;
      while ((acMatch = acRegex.exec(wpBody)) !== null) {
        acList.push(acMatch[1].replace(/\n\s{6,}/g, " ").trim());
      }

      const allDone = !wpBody.match(/-\s+\[\s*]\s+/);
      wpList.push({
        name: wpName,
        effort,
        acList,
        status: allDone ? "done" : "pending",
      });
    }

    pbiBlocks.push({
      id: pbiId,
      status,
      title: description,
      size: sizeMatch ? sizeMatch[1].trim() : "",
      description,
      proofMethod,
      wpList,
    });
  }

  return pbiBlocks;
}

function buildIssueBody(pbi: PbiRecord): string {
  const lines: string[] = [];
  lines.push(`## 概要\n${pbi.description}`);
  if (pbi.proofMethod) {
    lines.push(`\n## 証明方法\n${pbi.proofMethod}`);
  }
  return lines.join("\n");
}

function buildWpIssueBody(wp: WorkPackage): string {
  const lines: string[] = [];
  lines.push(`## Effort\n${wp.effort}回`);
  if (wp.acList.length > 0) {
    lines.push(`\n## Acceptance Criteria`);
    const statusMark = wp.status === "done" ? "x" : " ";
    for (const ac of wp.acList) {
      lines.push(`- [${statusMark}] ${ac}`);
    }
  }
  return lines.join("\n");
}

interface WpVarianceData {
  schema: string;
  wpName: string;
  effortInitial: number;
  effortPlaned: number | null;
  effortActual: number | null;
  varianceInitialToPlaned: number | null;
  variancePlanedToActual: number | null;
  varianceTotal: number | null;
  varianceReason: string | null;
  status: string;
  recordedAt: string;
}

function computeWpVariance(
  wp: WorkPackage,
): Pick<
  WpVarianceData,
  | "effortInitial"
  | "effortPlaned"
  | "effortActual"
  | "varianceInitialToPlaned"
  | "variancePlanedToActual"
  | "varianceTotal"
> {
  const effortInitial = wp.effort;
  const effortPlaned: number | null = null;
  const effortActual: number | null = null;

  const varianceInitialToPlaned = null;
  const variancePlanedToActual = null;
  const varianceTotal = null;

  return {
    effortInitial,
    effortPlaned,
    effortActual,
    varianceInitialToPlaned,
    variancePlanedToActual,
    varianceTotal,
  };
}

function buildVarianceCommentBody(
  wp: WorkPackage,
  variance: Pick<
    WpVarianceData,
    | "effortInitial"
    | "effortPlaned"
    | "effortActual"
    | "varianceInitialToPlaned"
    | "variancePlanedToActual"
    | "varianceTotal"
  >,
): string {
  const now = new Date().toISOString();
  const data: WpVarianceData = {
    schema: "variance-analysis/v1",
    wpName: wp.name,
    effortInitial: variance.effortInitial,
    effortPlaned: variance.effortPlaned,
    effortActual: variance.effortActual,
    varianceInitialToPlaned: variance.varianceInitialToPlaned,
    variancePlanedToActual: variance.variancePlanedToActual,
    varianceTotal: variance.varianceTotal,
    varianceReason: null,
    status: wp.status === "done" ? "done" : "pending",
    recordedAt: now,
  };

  const jsonBlock = JSON.stringify(data, null, 2);

  const fmt = (v: number | null): string => v !== null ? `${v >= 0 ? "+" : ""}${v}` : "N/A";
  const summary = [
    `### Variance Analysis`,
    ``,
    `| Field | Value |`,
    `|------|-------|`,
    `| Effort Initial | ${data.effortInitial} |`,
    `| Effort Planed | ${data.effortPlaned ?? "N/A"} |`,
    `| Effort Actual | ${data.effortActual ?? "N/A"} |`,
    `| Variance (init→planed) | ${fmt(data.varianceInitialToPlaned)} |`,
    `| Variance (planed→actual) | ${fmt(data.variancePlanedToActual)} |`,
    `| Variance (total) | ${fmt(data.varianceTotal)} |`,
    `| Status | ${data.status} |`,
    data.varianceReason ? `| Reason | ${data.varianceReason} |` : "",
    ``,
  ].filter(Boolean).join("\n");

  return [
    `<!-- variance-analysis -->`,
    ``,
    jsonBlock,
    ``,
    summary,
    `<!-- /variance-analysis -->`,
  ].join("\n");
}

async function postIssueComment(
  context: IGitHubContext,
  issueNumber: number,
  body: string,
): Promise<void> {
  try {
    const result = await executeCommand({
      cmd: "gh",
      args: [
        "issue",
        "comment",
        String(issueNumber),
        "--repo",
        `${context.owner}/${context.repository}`,
        "--body",
        body,
      ],
    });
    if (result.code !== 0) {
      console.error(
        `  WARNING: Failed to post comment on issue #${issueNumber}: ${result.stderr.trim()}`,
      );
    }
  } catch (err) {
    console.error(`  WARNING: Error posting comment on issue #${issueNumber}: ${err}`);
  }
}

const PBI_LABELS: Record<PbiRecord["status"], string> = {
  TODO: "status:TODO",
  WIP: "status:WIP",
  DONE: "status:DONE",
};

function parsePbiId(id: string): { epic?: string; feature?: string; name: string } {
  const match = id.match(/^\[([^\/]+)(?:\/([^\]]+))?\]\/(.+)$/);
  if (match) {
    return { epic: match[1], feature: match[2], name: match[3] };
  }
  return { name: id };
}

async function findOrCreateEpic(context: IGitHubContext, epicId: string): Promise<Issue> {
  const existing = await Issue.list(context, { labels: ["type:Epic"], state: "all" });
  const found = existing.find((i) => i.title === epicId);
  if (found) return found;
  const epic = await Issue.create(context, {
    title: epicId,
    body: `## Epic\n${epicId}`,
    labels: ["type:Epic"],
  });
  console.log(`  Created Epic Issue #${epic.number}: ${epicId}`);
  return epic;
}

async function findOrCreateFeature(
  context: IGitHubContext,
  epicId: string,
  featureId: string,
  epicIssue: Issue,
): Promise<Issue> {
  const existing = await Issue.list(context, { labels: ["type:Feature"], state: "all" });
  const found = existing.find((i) => i.title === featureId);
  if (found) return found;
  const feature = await Issue.create(context, {
    title: featureId,
    body: `## Feature\n${featureId}\n\nPart of Epic: ${epicId}`,
    labels: ["type:Feature"],
  });
  await epicIssue.attach(feature);
  console.log(`  Created Feature Issue #${feature.number}: ${featureId}`);
  return feature;
}

function extractSprint(content: string, pbiId: string): string | undefined {
  const pbiIndex = content.indexOf(pbiId);
  if (pbiIndex === -1) return undefined;
  const beforePbi = content.slice(0, pbiIndex);
  const sprintMatch = beforePbi.match(/##\s+Sprint\s+(\d+)\s*$/m);
  return sprintMatch ? `Sprint ${sprintMatch[1]}` : undefined;
}

async function ensureMilestone(
  context: IGitHubContext,
  sprintName: string,
): Promise<string | undefined> {
  const existing = await listMilestones(context);
  if (existing.some((m) => m.title === sprintName)) return sprintName;
  const created = await createMilestone(context, { title: sprintName });
  if (created) {
    console.log(`  Created Milestone: ${sprintName}`);
    return sprintName;
  }
  return undefined;
}

function computeEffortTotal(wpList: WorkPackage[]): number {
  return wpList.reduce((sum, wp) => sum + wp.effort, 0);
}

async function getProjectNodeId(
  context: IGitHubContext,
  projectNumber: string,
): Promise<string | null> {
  const result = await executeCommand({
    cmd: "gh",
    args: [
      "project",
      "view",
      String(projectNumber),
      "--owner",
      context.owner,
      "--format",
      "json",
      "--jq",
      ".id",
    ],
  });
  if (result.code !== 0) return null;
  return result.stdout.trim() || null;
}

async function addToProjectAndGetItemId(
  context: IGitHubContext,
  issueNumber: number,
  projectNumber: string,
): Promise<string | null> {
  const issueUrl =
    `https://github.com/${context.owner}/${context.repository}/issues/${issueNumber}`;
  const result = await executeCommand({
    cmd: "gh",
    args: [
      "project",
      "item-add",
      String(projectNumber),
      "--owner",
      context.owner,
      "--url",
      issueUrl,
      "--format",
      "json",
    ],
  });
  if (result.code !== 0) return null;
  try {
    const data = JSON.parse(result.stdout);
    return data.id ?? null;
  } catch {
    return null;
  }
}

async function setEffortProjectFields(
  context: IGitHubContext,
  projectNumber: string,
  issueNumber: number,
  effortInitial: number,
  config: HarnessConfig,
): Promise<void> {
  const projectNodeId = await getProjectNodeId(context, projectNumber);
  if (!projectNodeId) {
    console.error(`  WARNING: Could not resolve project node ID for #${projectNumber}`);
    return;
  }

  const itemId = await addToProjectAndGetItemId(context, issueNumber, projectNumber);
  if (!itemId) {
    console.error(`  WARNING: Could not add issue #${issueNumber} to project ${projectNumber}`);
    return;
  }

  const fieldsResult = await executeCommand({
    cmd: "gh",
    args: [
      "project",
      "field-list",
      String(projectNumber),
      "--owner",
      context.owner,
      "--format",
      "json",
    ],
  });
  if (fieldsResult.code !== 0) {
    console.error(`  WARNING: Could not list project fields`);
    return;
  }
  const fields = JSON.parse(fieldsResult.stdout).fields as {
    id: string;
    name: string;
    type: string;
  }[];

  const fieldNameToValue: Record<string, number> = {};
  if (config.customFields?.effortInitial && effortInitial > 0) {
    fieldNameToValue[config.customFields.effortInitial] = effortInitial;
  }
  for (const [fieldName, value] of Object.entries(fieldNameToValue)) {
    const field = fields.find((f) => f.name === fieldName);
    if (!field) {
      console.error(`  WARNING: Project field "${fieldName}" not found on GitHub Project V2`);
      continue;
    }
    const editResult = await executeCommand({
      cmd: "gh",
      args: [
        "project",
        "item-edit",
        "--id",
        itemId,
        "--field-id",
        field.id,
        "--number",
        String(value),
        "--project-id",
        projectNodeId,
      ],
    });
    if (editResult.code === 0) {
      console.log(`  Set ${fieldName} = ${value}`);
    } else {
      console.error(`  WARNING: Failed to set ${fieldName} = ${value}`);
    }
  }
}

async function loadConfig(harnessrcPath?: string): Promise<HarnessConfig | null> {
  const paths = harnessrcPath ? [harnessrcPath] : [DEFAULT_HARNESSRC_PATH, FALLBACK_HARNESSRC_PATH];

  for (const p of paths) {
    try {
      const content = await Deno.readTextFile(p);
      return JSON.parse(content) as HarnessConfig;
    } catch {
      continue;
    }
  }
  return null;
}

async function cmdList(backlogPath: string, dryRun: boolean): Promise<void> {
  const content = await Deno.readTextFile(backlogPath);
  const pbis = parseBacklog(content);

  if (dryRun) {
    console.log(JSON.stringify(pbis, null, 2));
    return;
  }

  console.log(`Found ${pbis.length} PBI(s) in backlog:\n`);
  for (const pbi of pbis) {
    const wpCount = pbi.wpList.length;
    const doneWps = pbi.wpList.filter((w) => w.status === "done").length;
    const effortTotal = computeEffortTotal(pbi.wpList);
    console.log(`[${pbi.status}] ${pbi.id}`);
    console.log(`  Size: ${pbi.size} | WPs: ${doneWps}/${wpCount} | Effort: ${effortTotal}回`);
    console.log("");
  }
}

async function cmdMigrate(
  pbiId: string,
  backlogPath: string,
  repo: string,
  dryRun: boolean,
  _config: HarnessConfig | null,
): Promise<void> {
  const content = await Deno.readTextFile(backlogPath);
  const pbis = parseBacklog(content);
  const pbi = pbis.find((p) => p.id === pbiId);

  if (!pbi) {
    console.error(`PBI not found: ${pbiId}`);
    Deno.exit(1);
  }

  const [owner, repoName] = repo.split("/");
  const context: IGitHubContext = { owner, repository: repoName };

  const parsed = parsePbiId(pbi.id);

  const sprint = extractSprint(content, pbi.id);
  const milestone = sprint ? await ensureMilestone(context, sprint) : undefined;

  const parentLabels = ["type:PBI", PBI_LABELS[pbi.status]];
  if (pbi.size) {
    const sizeLabel = `size:${pbi.size.toUpperCase()}`;
    if (!parentLabels.includes(sizeLabel)) {
      parentLabels.push(sizeLabel);
    }
  }
  const parentBody = buildIssueBody(pbi);

  const effortInitial = computeEffortTotal(pbi.wpList);

  if (dryRun) {
    console.log(`[DRY-RUN] Would create PBI Issue:`);
    if (parsed.epic) {
      console.log(`  Epic: ${parsed.epic}`);
      if (parsed.feature) {
        console.log(`  Feature: ${parsed.feature}`);
      }
    }
    console.log(`  Title: ${parsed.name}`);
    console.log(`  Milestone: ${milestone ?? "(none)"}`);
    console.log(`  Labels: ${parentLabels.join(", ")}`);
    console.log(`  Effort Fields (Project V2):`);
    console.log(
      `    ${_config?.customFields?.effortInitial ?? "harness-effort-initial"}: ${effortInitial}`,
    );
    console.log(`    ${_config?.customFields?.effortPlaned ?? "harness-effort-planed"}: (unset)`);
    console.log(`    ${_config?.customFields?.effortActual ?? "harness-effort-actual"}: (unset)`);
    console.log(`  Body:\n${parentBody}`);
    if (pbi.wpList.length > 0) {
      console.log(`\n  With ${pbi.wpList.length} child WP Issue(s):`);
      for (const wp of pbi.wpList) {
        const v = computeWpVariance(wp);
        const fmt = (n: number | null): string => n !== null ? `${n >= 0 ? "+" : ""}${n}` : "N/A";
        console.log(`    - ${wp.name} (${wp.status})`);
        console.log(
          `      Effort: initial=${wp.effort} | planed=${v.effortPlaned ?? "N/A"} | actual=${
            v.effortActual ?? "N/A"
          }`,
        );
        console.log(
          `      Variance: init→planed=${fmt(v.varianceInitialToPlaned)} | planed→actual=${
            fmt(v.variancePlanedToActual)
          } | total=${fmt(v.varianceTotal)}`,
        );
        console.log(`      ACs: ${wp.acList.join(" | ")}`);
      }
    }
    return;
  }

  const issueParams = {
    title: parsed.name,
    body: parentBody,
    labels: parentLabels,
    milestone,
  } as const;

  let parentIssue: Issue;

  if (parsed.epic) {
    const epicIssue = await findOrCreateEpic(context, parsed.epic);
    let featureIssue: Issue | undefined;
    if (parsed.feature) {
      featureIssue = await findOrCreateFeature(context, parsed.epic, parsed.feature, epicIssue);
    }
    parentIssue = await Issue.create(context, issueParams);
    const attachTarget = featureIssue ?? epicIssue;
    await attachTarget.attach(parentIssue);
  } else {
    parentIssue = await Issue.create(context, issueParams);
  }

  if (pbi.status === "DONE") {
    await parentIssue.close();
    console.log(`Created PBI Issue #${parentIssue.number} (closed)`);
  } else {
    console.log(`Created PBI Issue #${parentIssue.number}`);
  }

  for (const wp of pbi.wpList) {
    const wpTitle = wp.name;
    const wpBody = buildWpIssueBody(wp);
    const wpLabels = ["type:WP"];

    const wpIssue = await Issue.create(context, {
      title: wpTitle,
      body: wpBody,
      labels: wpLabels,
    });

    try {
      await parentIssue.attach(wpIssue);
    } catch {
      console.error(`  WARNING: Failed to attach WP ${wpIssue.number} to parent`);
    }

    if (wp.status === "done") {
      try {
        await wpIssue.close();
        console.log(`  Created WP Issue #${wpIssue.number} (closed): ${wp.name}`);
        const variance = computeWpVariance(wp);
        const commentBody = buildVarianceCommentBody(wp, variance);
        await postIssueComment(context, wpIssue.number, commentBody);
        console.log(`    Posted variance analysis comment`);
      } catch {
        console.error(`  WARNING: Failed to close WP ${wpIssue.number} (network issue)`);
        console.log(`  Created WP Issue #${wpIssue.number}: ${wp.name}`);
      }
    } else {
      console.log(`  Created WP Issue #${wpIssue.number}: ${wp.name}`);
    }
  }

  if (_config?.projects?.productBacklog && effortInitial > 0) {
    console.log(`  Setting effort fields on Project V2...`);
    await setEffortProjectFields(
      context,
      String(_config.projects.productBacklog),
      parentIssue.number,
      effortInitial,
      _config,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["repo", "harnessrc", "backlog", "migrate"],
    boolean: ["dry-run", "list", "stdin", "help"],
    alias: {
      r: "repo",
      h: "help",
      d: "dry-run",
      l: "list",
      s: "stdin",
      m: "migrate",
    },
  });

  const dryRun = !!args["dry-run"];
  const backlogPath = args.backlog || DEFAULT_BACKLOG_PATH;

  if (args.stdin) {
    const buffer = new Uint8Array(16 * 1024);
    const n = await Deno.stdin.read(buffer);
    if (n === null) {
      console.error("Error: no JSON input provided via stdin");
      Deno.exit(1);
    }
    const input = JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
    const pbiId = input.pbiId || args.migrate;
    const repo = input.repo || args.repo;
    if (!pbiId || !repo) {
      console.error('Error: stdin JSON must include "pbiId" and "repo" fields');
      Deno.exit(1);
    }
    const config = await loadConfig(args.harnessrc);
    await cmdMigrate(pbiId, backlogPath, repo, dryRun, config);
    Deno.exit(0);
  }

  if (args.help || (!args.list && !args.migrate)) {
    console.log(`Usage:
  migrate-to-github --list [--dry-run] [--backlog <path>]
  migrate-to-github --stdin < json-input.json  [--dry-run] [--backlog <path>] [--harnessrc <path>]

Options:
  --list                          List all PBIs in the backlog
  --stdin                         Read migration payload (JSON with pbiId, repo) from stdin
  --dry-run                       Preview only, no actual creation
  --backlog <path>                Path to product-backlog.md (default: .agents/management/product-backlog.md)
  --harnessrc <path>              Path to .harnessrc config file
  --help                          Show this help`);
    Deno.exit(0);
  }

  if (args.list) {
    await cmdList(backlogPath, dryRun);
    Deno.exit(0);
  }

  if (args.migrate) {
    if (!args.repo) {
      console.error("Error: --repo is required for --migrate");
      Deno.exit(1);
    }
    const config = await loadConfig(args.harnessrc);
    await cmdMigrate(args.migrate, backlogPath, args.repo, dryRun, config);
    Deno.exit(0);
  }
}

if (import.meta.main) {
  await main();
}
