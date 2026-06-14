import { executeCommand } from "./command.ts";

let ghCmd = "gh";

export function setGhCommand(cmd: string): void {
  ghCmd = cmd;
}

function runGh(
  args: string[],
  options?: { dryRun?: boolean },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return executeCommand({ cmd: ghCmd, args, dryRun: options?.dryRun });
}

function parseJsonOutput<T>(stdout: string): T | null {
  if (!stdout.trim()) return null;
  try {
    return JSON.parse(stdout) as T;
  } catch {
    return null;
  }
}

export interface Issue {
  number: number;
  url: string;
  title?: string;
  state?: string;
  labels?: { name: string }[];
  body?: string;
  milestone?: { title: string; number: number };
}

export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  milestone?: string;
  assignee?: string;
}

export async function createIssue(
  opts: CreateIssueOptions,
  options?: { dryRun?: boolean },
): Promise<{ number: number; url: string } | null> {
  const args: string[] = ["issue", "create", "--title", opts.title, "--json", "number,url"];
  if (opts.body) args.push("--body", opts.body);
  if (opts.labels && opts.labels.length > 0) args.push("--label", opts.labels.join(","));
  if (opts.milestone) args.push("--milestone", opts.milestone);
  if (opts.assignee) args.push("--assignee", opts.assignee);
  const result = await runGh(args, options);
  if (result.code !== 0) return null;
  return parseJsonOutput<{ number: number; url: string }>(result.stdout);
}

export interface SearchIssuesOptions {
  state?: "open" | "closed" | "all";
  labels?: string[];
  milestone?: string;
  assignee?: string;
  limit?: number;
}

export async function searchIssues(
  opts: SearchIssuesOptions = {},
  options?: { dryRun?: boolean },
): Promise<Issue[]> {
  const args: string[] = [
    "issue",
    "list",
    "--json",
    "number,url,title,state,labels,body,milestone",
  ];
  if (opts.state && opts.state !== "all") args.push("--state", opts.state);
  if (opts.labels && opts.labels.length > 0) args.push("--label", opts.labels.join(","));
  if (opts.milestone) args.push("--milestone", opts.milestone);
  if (opts.assignee) args.push("--assignee", opts.assignee);
  if (opts.limit) args.push("--limit", String(opts.limit));
  const result = await runGh(args, options);
  if (result.code !== 0) return [];
  return parseJsonOutput<Issue[]>(result.stdout) ?? [];
}

export async function updateIssue(
  number: number,
  opts: {
    title?: string;
    body?: string;
    addLabels?: string[];
    removeLabels?: string[];
    milestone?: string;
    state?: "open" | "closed";
  },
  options?: { dryRun?: boolean },
): Promise<Issue | null> {
  const args: string[] = [
    "issue",
    "edit",
    String(number),
    "--json",
    "number,url,title,state,labels,body,milestone",
  ];
  if (opts.title) args.push("--title", opts.title);
  if (opts.body) args.push("--body", opts.body);
  if (opts.addLabels && opts.addLabels.length > 0) {
    args.push("--add-label", opts.addLabels.join(","));
  }
  if (opts.removeLabels && opts.removeLabels.length > 0) {
    args.push("--remove-label", opts.removeLabels.join(","));
  }
  if (opts.milestone) args.push("--milestone", opts.milestone);
  if (opts.state) args.push("--state", opts.state);
  const result = await runGh(args, options);
  if (result.code !== 0) return null;
  return parseJsonOutput<Issue>(result.stdout);
}

export async function closeIssue(number: number, options?: { dryRun?: boolean }): Promise<boolean> {
  const result = await runGh(["issue", "close", String(number)], options);
  return result.code === 0;
}
