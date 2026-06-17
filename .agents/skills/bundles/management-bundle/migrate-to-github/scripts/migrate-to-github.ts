import { parseArgs } from "@std/cli/parse-args";
import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { Issue } from "../../../../../core/issue.ts";
import type { IGitHubContext } from "../../../../../core/github.ts";

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
    effort: string;
  };
  "harness-type"?: { options: string[] };
}

const DEFAULT_HARNESSRC_PATH = join(PROJECT_ROOT, ".harnessrc");
const FALLBACK_HARNESSRC_PATH = join(PROJECT_ROOT, ".github/schemas/harnessrc.example");
const DEFAULT_BACKLOG_PATH = join(PROJECT_ROOT, ".agents/management/product-backlog.md");

function parseBacklog(content: string): PbiRecord[] {
  const pbiBlocks: PbiRecord[] = [];
  const pbiRegex =
    /###\s+\[(TODO|WIP|DONE)\]\s+(\S+(?:\/\S+)*)\s*\n([\s\S]*?)(?=\n###\s+\[(?:TODO|WIP|DONE)\]|\n##(?!#)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pbiRegex.exec(content)) !== null) {
    const status = match[1] as PbiRecord["status"];
    const pbiId = match[2];
    const body = match[3];

    const titleMatch = body.match(/^- \*\*概要\*\*:\s*(.+)$/m);
    const sizeMatch = body.match(/^- \*\*見積サイズ\*\*:\s*(\S+)$/m);
    const proofMatch = body.match(/^- \*\*証明方法\*\*:\s*(.+)$/m);

    const wpList: WorkPackage[] = [];
    const wpRegex =
      /####\s+(WP_[\w]+)\s*:\s*(.+)\n([\s\S]*?)(?=\n####\s+WP_|\n###\s+\[(?:TODO|WIP|DONE)\]|\n##(?!#)|$)/g;
    let wpMatch: RegExpExecArray | null;

    while ((wpMatch = wpRegex.exec(body)) !== null) {
      const wpName = `${wpMatch[1]}: ${wpMatch[2].trim()}`;
      const wpBody = wpMatch[3];

      const effortMatch = wpBody.match(/- \*\*Effort見積（介入回数）\*\*:\s*(\d+)回/);
      const effort = effortMatch ? parseInt(effortMatch[1], 10) : 0;

      const acList: string[] = [];
      const acRegex = /-\s+\[\s*.\s*\]\s+(.+)$/gm;
      let acMatch: RegExpExecArray | null;
      while ((acMatch = acRegex.exec(wpBody)) !== null) {
        acList.push(acMatch[1].trim());
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
      title: titleMatch ? titleMatch[1].trim() : "",
      size: sizeMatch ? sizeMatch[1].trim() : "",
      description: titleMatch ? titleMatch[1].trim() : "",
      proofMethod: proofMatch ? proofMatch[1].trim() : "",
      wpList,
    });
  }

  return pbiBlocks;
}

function buildIssueBody(pbi: PbiRecord): string {
  const lines: string[] = [];
  lines.push(`## 概要\n${pbi.description}`);
  lines.push(`\n## 見積サイズ\n${pbi.size}`);
  if (pbi.proofMethod) {
    lines.push(`\n## 証明方法\n${pbi.proofMethod}`);
  }

  if (pbi.wpList.length > 0) {
    lines.push(`\n## Work Packages`);
    for (const wp of pbi.wpList) {
      const statusMark = wp.status === "done" ? "x" : " ";
      lines.push(`\n### ${wp.name}`);
      lines.push(`- Effort: ${wp.effort}回`);
      for (const ac of wp.acList) {
        lines.push(`- [${statusMark}] ${ac}`);
      }
    }
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

const PBI_LABELS: Record<PbiRecord["status"], string> = {
  TODO: "status:todo",
  WIP: "status:wip",
  DONE: "status:done",
};

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
    console.log(`[${pbi.status}] ${pbi.id}`);
    console.log(`  Size: ${pbi.size} | WPs: ${doneWps}/${wpCount}`);
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

  const parentLabels = ["type:PBI", PBI_LABELS[pbi.status]];
  const parentBody = buildIssueBody(pbi);

  if (dryRun) {
    console.log(`[DRY-RUN] Would create PBI Issue:`);
    console.log(`  Title: ${pbi.id}`);
    console.log(`  Labels: ${parentLabels.join(", ")}`);
    console.log(`  Body:\n${parentBody}`);
    if (pbi.wpList.length > 0) {
      console.log(`\n  With ${pbi.wpList.length} child WP Issue(s):`);
      for (const wp of pbi.wpList) {
        console.log(`    - ${wp.name} (Effort: ${wp.effort}回)`);
        console.log(`      ACs: ${wp.acList.join(" | ")}`);
      }
    }
    return;
  }

  const parentIssue = await Issue.create(context, {
    title: pbi.id,
    body: parentBody,
    labels: parentLabels,
  });

  if (pbi.status === "DONE") {
    await parentIssue.close();
    console.log(`Created PBI Issue #${parentIssue.number} (closed)`);
  } else {
    console.log(`Created PBI Issue #${parentIssue.number}`);
  }

  for (const wp of pbi.wpList) {
    const wpTitle = `${pbi.id} / ${wp.name}`;
    const wpBody = buildWpIssueBody(wp);
    const wpLabels = ["type:WP"];

    const wpIssue = await Issue.create(context, {
      title: wpTitle,
      body: wpBody,
      labels: wpLabels,
    });

    await parentIssue.attach(wpIssue);

    if (wp.status === "done") {
      await wpIssue.close();
      console.log(`  Created WP Issue #${wpIssue.number} (closed): ${wp.name}`);
    } else {
      console.log(`  Created WP Issue #${wpIssue.number}: ${wp.name}`);
    }
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
