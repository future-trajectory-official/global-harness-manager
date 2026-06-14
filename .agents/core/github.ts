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

export function createChildIssue(
  opts: CreateIssueOptions & { parentNumber: number },
  options?: { dryRun?: boolean },
): Promise<{ number: number; url: string } | null> {
  const body = opts.body
    ? `${opts.body}\n\nparent: #${opts.parentNumber}`
    : `parent: #${opts.parentNumber}`;
  return createIssue({ ...opts, body }, options);
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

export async function addLabels(
  number: number,
  labels: string[],
  options?: { dryRun?: boolean },
): Promise<boolean> {
  const result = await runGh(
    ["issue", "edit", String(number), "--add-label", labels.join(",")],
    options,
  );
  return result.code === 0;
}

export interface ProjectItem {
  itemId: string;
}

export async function addToProject(
  issueNumber: number,
  projectId: string,
  owner: string,
  options?: { dryRun?: boolean },
): Promise<{ itemId: string } | null> {
  const result = await runGh([
    "project",
    "item-add",
    projectId,
    "--owner",
    owner,
    "--url",
    `https://github.com/${owner}/issues/${issueNumber}`,
    "--format",
    "json",
  ], options);
  if (result.code !== 0) return null;
  return parseJsonOutput<{ itemId: string }>(result.stdout);
}

export interface ProjectField {
  id: string;
  name: string;
  type: string;
}

export async function getProjectFields(
  projectId: string,
  options?: { dryRun?: boolean },
): Promise<ProjectField[]> {
  const result = await runGh(["project", "field-list", projectId, "--format", "json"], options);
  if (result.code !== 0) return [];
  return parseJsonOutput<ProjectField[]>(result.stdout) ?? [];
}

export async function setProjectField(
  itemId: string,
  fieldId: string,
  projectId: string,
  value: string,
  options?: { dryRun?: boolean },
): Promise<boolean> {
  const result = await runGh([
    "project",
    "item-edit",
    "--id",
    itemId,
    "--field-id",
    fieldId,
    "--project-id",
    projectId,
    "--value",
    value,
  ], options);
  return result.code === 0;
}

export interface Milestone {
  title: string;
  number: number;
  description?: string;
  dueOn?: string;
}

export async function createMilestone(
  opts: { title: string; description?: string; dueOn?: string },
  owner: string,
  repo: string,
  options?: { dryRun?: boolean },
): Promise<Milestone | null> {
  const graphql = `mutation {
    createMilestone(input: {
      repositoryId: "${owner}/${repo}",
      title: "${opts.title.replace(/"/g, '\\"')}"
      ${opts.description ? `, description: "${opts.description.replace(/"/g, '\\"')}"` : ""}
      ${opts.dueOn ? `, dueOn: "${opts.dueOn}"` : ""}
    }) { milestone { title number description dueOn } }
  }`;
  const result = await runGh(["api", "graphql", "-f", `query=${graphql}`], options);
  if (result.code !== 0) return null;
  const data = parseJsonOutput<{ data: { createMilestone: { milestone: Milestone } } }>(
    result.stdout,
  );
  return data?.data?.createMilestone?.milestone ?? null;
}

export async function listMilestones(
  owner: string,
  repo: string,
  options?: { dryRun?: boolean },
): Promise<Milestone[]> {
  const result = await runGh([
    "api",
    `repos/${owner}/${repo}/milestones`,
    "--method",
    "GET",
    "--paginate",
  ], options);
  if (result.code !== 0) return [];
  return parseJsonOutput<Milestone[]>(result.stdout) ?? [];
}

export async function uploadAsset(
  issueNumber: number,
  filePath: string,
  options?: { dryRun?: boolean },
): Promise<{ url: string } | null> {
  const result = await runGh(
    ["issue", "comment", String(issueNumber), "--body-file", filePath],
    options,
  );
  if (result.code !== 0) return null;
  return { url: result.stdout.trim() };
}
