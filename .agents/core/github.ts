import { executeCommand } from "./command.ts";

let ghCmd = "gh";

/**
 * テスト用に gh コマンドのパスを差し替える。
 * モックスクリプトを指定することで、実際の GitHub CLI を呼ばずにテスト可能。
 */
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

/** GitHub Issue を表現する型 */
export interface Issue {
  number: number;
  url: string;
  title?: string;
  state?: string;
  labels?: { name: string }[];
  body?: string;
  milestone?: { title: string; number: number };
}

/** createIssue の引数 */
export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  milestone?: string;
  assignee?: string;
}

/**
 * GitHub Issue を作成する。
 * @param opts.title - タイトル（必須）
 * @param opts.body - 本文
 * @param opts.labels - ラベル一覧
 * @param opts.milestone - マイルストーン名
 * @param opts.assignee - アサイン先
 * @returns Issue番号とURL、失敗時はnull
 */
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

/** searchIssues のフィルタ条件 */
export interface SearchIssuesOptions {
  state?: "open" | "closed" | "all";
  labels?: string[];
  milestone?: string;
  assignee?: string;
  limit?: number;
}

/**
 * GitHub Issue を検索する。
 * @param opts.state - 状態フィルタ（open/closed/all）
 * @param opts.labels - ラベルフィルタ
 * @param opts.milestone - マイルストーンフィルタ
 * @param opts.assignee - アサイン先フィルタ
 * @param opts.limit - 取得上限
 * @returns Issue の配列
 */
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

/**
 * GitHub Issue の内容を更新する。
 * @param number - Issue番号
 * @param opts.title - 新しいタイトル
 * @param opts.body - 新しい本文
 * @param opts.addLabels - 追加するラベル
 * @param opts.removeLabels - 削除するラベル
 * @param opts.milestone - マイルストーン
 * @param opts.state - 状態（open/closed）
 * @returns 更新後のIssue、失敗時はnull
 */
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

/**
 * GitHub Issue をクローズする。
 * @param number - Issue番号
 * @returns 成功時true
 */
export async function closeIssue(number: number, options?: { dryRun?: boolean }): Promise<boolean> {
  const result = await runGh(["issue", "close", String(number)], options);
  return result.code === 0;
}
