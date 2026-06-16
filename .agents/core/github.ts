import { executeCommand } from "./command.ts";

/** GitHub 操作の対象リポジトリを表現する */
export interface IGitHubContext {
  owner: string;
  repository: string;
}

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
  execOptions?: { dryRun?: boolean },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return executeCommand({ cmd: ghCmd, args, dryRun: execOptions?.dryRun });
}

function buildGhArgs(context: IGitHubContext, args: string[]): string[] {
  return [`--repo ${context.owner}/${context.repository}`, ...args];
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

/** gh コマンド実行時のオプション */
export interface RunOptions {
  dryRun?: boolean;
}

/** updateIssue の引数 */
export interface UpdateIssueOptions {
  title?: string;
  body?: string;
  addLabels?: string[];
  removeLabels?: string[];
  milestone?: string;
  state?: "open" | "closed";
}

/** createChildIssue の引数 */
export interface CreateChildIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  parentNumber: number;
}

/** Projects V2 のフィールド定義 */
export interface ProjectField {
  id: string;
  name: string;
  options?: { id: string; name: string }[];
}

/** setProjectField の引数 */
export interface SetProjectFieldOptions {
  itemId: string;
  fieldId: string;
  value: string;
}

/** createMilestone の引数 */
export interface CreateMilestoneOptions {
  title: string;
  description?: string;
  dueOn?: string;
}

/**
 * GitHub Issue を作成する。
 * @param context - 操作対象リポジトリ
 * @param payload - 作成するIssueのデータ
 * @param execOptions - 実行時オプション
 * @returns Issue番号とURL、失敗時はnull
 */
export async function createIssue(
  context: IGitHubContext,
  payload: CreateIssueOptions,
  execOptions?: RunOptions,
): Promise<{ number: number; url: string } | null> {
  const args: string[] = ["issue", "create", "--title", payload.title, "--json", "number,url"];
  if (payload.body) args.push("--body", payload.body);
  if (payload.labels && payload.labels.length > 0) args.push("--label", payload.labels.join(","));
  if (payload.milestone) args.push("--milestone", payload.milestone);
  if (payload.assignee) args.push("--assignee", payload.assignee);
  const result = await runGh(buildGhArgs(context, args), execOptions);
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
 * @param context - 操作対象リポジトリ
 * @param filter - 検索条件
 * @param execOptions - 実行時オプション
 * @returns Issue の配列
 */
export async function searchIssues(
  context: IGitHubContext,
  filter: SearchIssuesOptions = {},
  execOptions?: RunOptions,
): Promise<Issue[]> {
  const args: string[] = [
    "issue",
    "list",
    "--json",
    "number,url,title,state,labels,body,milestone",
  ];
  if (filter.state && filter.state !== "all") args.push("--state", filter.state);
  if (filter.labels && filter.labels.length > 0) args.push("--label", filter.labels.join(","));
  if (filter.milestone) args.push("--milestone", filter.milestone);
  if (filter.assignee) args.push("--assignee", filter.assignee);
  if (filter.limit) args.push("--limit", String(filter.limit));
  const result = await runGh(buildGhArgs(context, args), execOptions);
  if (result.code !== 0) return [];
  return parseJsonOutput<Issue[]>(result.stdout) ?? [];
}

/**
 * GitHub Issue の内容を更新する。
 * @param context - 操作対象リポジトリ
 * @param number - Issue番号
 * @param changes - 更新内容
 * @param execOptions - 実行時オプション
 * @returns 更新後のIssue、失敗時はnull
 */
export async function updateIssue(
  context: IGitHubContext,
  number: number,
  changes: UpdateIssueOptions,
  execOptions?: RunOptions,
): Promise<Issue | null> {
  const args: string[] = [
    "issue",
    "edit",
    String(number),
    "--json",
    "number,url,title,state,labels,body,milestone",
  ];
  if (changes.title) args.push("--title", changes.title);
  if (changes.body) args.push("--body", changes.body);
  if (changes.addLabels && changes.addLabels.length > 0) {
    args.push("--add-label", changes.addLabels.join(","));
  }
  if (changes.removeLabels && changes.removeLabels.length > 0) {
    args.push("--remove-label", changes.removeLabels.join(","));
  }
  if (changes.milestone) args.push("--milestone", changes.milestone);
  if (changes.state) args.push("--state", changes.state);
  const result = await runGh(buildGhArgs(context, args), execOptions);
  if (result.code !== 0) return null;
  return parseJsonOutput<Issue>(result.stdout);
}

/**
 * GitHub Issue をクローズする。
 * @param context - 操作対象リポジトリ
 * @param number - Issue番号
 * @param execOptions - 実行時オプション
 * @returns 成功時true
 */
export async function closeIssue(
  context: IGitHubContext,
  number: number,
  execOptions?: RunOptions,
): Promise<boolean> {
  const result = await runGh(buildGhArgs(context, ["issue", "close", String(number)]), execOptions);
  return result.code === 0;
}

/**
 * 指定されたIssueに子Issueを作成する（GraphQL addSubIssue mutation）。
 * @param context - 操作対象リポジトリ
 * @param childPayload - 子Issue作成データ
 * @param execOptions - 実行時オプション
 * @returns 子Issue番号とURL、失敗時はnull
 */
export async function createChildIssue(
  context: IGitHubContext,
  childPayload: CreateChildIssueOptions,
  execOptions?: RunOptions,
): Promise<{ number: number; url: string; parentLinked: boolean } | null> {
  const args = buildGhArgs(context, [
    "api",
    "graphql",
    "-f",
    `query=mutation AddSubIssue($parentId: ID!, $title: String!, $body: String) {
      addSubIssue(input: { parentIssueId: $parentId, title: $title, body: $body }) {
        subIssue { number url }
      }
    }`,
    "-F",
    `parentId=${childPayload.parentNumber}`,
    "-f",
    `title=${childPayload.title}`,
  ]);
  if (childPayload.body) {
    args.push("-f", `body=${childPayload.body}`);
  }
  if (childPayload.labels && childPayload.labels.length > 0) {
    args.push("-f", `labels=${childPayload.labels.join(",")}`);
  }
  const result = await runGh(args, execOptions);
  if (result.code !== 0) return null;
  const data = parseJsonOutput<{
    data?: { addSubIssue?: { subIssue?: { number: number; url: string } } };
  }>(result.stdout);
  if (!data?.data?.addSubIssue?.subIssue) return null;
  return {
    number: data.data.addSubIssue.subIssue.number,
    url: data.data.addSubIssue.subIssue.url,
    parentLinked: true,
  };
}

/**
 * Issueにラベルを追加する。
 * @param context - 操作対象リポジトリ
 * @param number - Issue番号
 * @param labels - 追加するラベル一覧
 * @param execOptions - 実行時オプション
 * @returns 成功時true
 */
export async function addLabels(
  context: IGitHubContext,
  number: number,
  labels: string[],
  execOptions?: RunOptions,
): Promise<boolean> {
  const result = await runGh(
    buildGhArgs(context, ["issue", "edit", String(number), "--add-label", labels.join(",")]),
    execOptions,
  );
  return result.code === 0;
}

/**
 * IssueをProjects V2に追加する。
 * @param context - 操作対象リポジトリ
 * @param issueNumber - Issue番号
 * @param projectId - プロジェクトID
 * @param execOptions - 実行時オプション
 * @returns 成功時true
 */
export async function addToProject(
  context: IGitHubContext,
  issueNumber: number,
  projectId: string,
  execOptions?: RunOptions,
): Promise<boolean> {
  const args = buildGhArgs(context, [
    "project",
    "item-add",
    "--owner",
    context.owner,
    "--repo",
    context.repository,
    String(projectId),
    "--issue",
    String(issueNumber),
  ]);
  const result = await runGh(args, execOptions);
  return result.code === 0;
}

/**
 * Projects V2のフィールド一覧を取得する。
 * @param context - 操作対象リポジトリ
 * @param projectId - プロジェクトID
 * @param execOptions - 実行時オプション
 * @returns フィールド定義の配列
 */
export async function getProjectFields(
  context: IGitHubContext,
  projectId: string,
  execOptions?: RunOptions,
): Promise<ProjectField[]> {
  const args = buildGhArgs(context, [
    "project",
    "field-list",
    String(projectId),
    "--json",
    "id,name,type,options",
  ]);
  const result = await runGh(args, execOptions);
  if (result.code !== 0) return [];
  return parseJsonOutput<ProjectField[]>(result.stdout) ?? [];
}

/**
 * Projects V2のフィールド値を設定する。
 * @param context - 操作対象リポジトリ
 * @param fieldUpdate - フィールド更新内容
 * @param execOptions - 実行時オプション
 * @returns 成功時true
 */
export async function setProjectField(
  context: IGitHubContext,
  fieldUpdate: SetProjectFieldOptions,
  execOptions?: RunOptions,
): Promise<boolean> {
  const args = buildGhArgs(context, [
    "project",
    "item-edit",
    "--item-id",
    fieldUpdate.itemId,
    "--field-id",
    fieldUpdate.fieldId,
    "--value",
    fieldUpdate.value,
  ]);
  const result = await runGh(args, execOptions);
  return result.code === 0;
}

/**
 * マイルストーンを作成する（GraphQL createMilestone mutation）。
 * @param context - 操作対象リポジトリ
 * @param milestoneData - マイルストーン作成データ
 * @param execOptions - 実行時オプション
 * @returns マイルストーン番号とURL、失敗時はnull
 */
export async function createMilestone(
  context: IGitHubContext,
  milestoneData: CreateMilestoneOptions,
  execOptions?: RunOptions,
): Promise<{ number: number; url: string } | null> {
  const args = buildGhArgs(context, [
    "api",
    "graphql",
    "-f",
    `query=mutation CreateMilestone($repo: String!, $title: String!, $description: String, $dueOn: DateTime) {
      createMilestone(input: { repositoryId: $repo, title: $title, description: $description, dueOn: $dueOn }) {
        milestone { number url }
      }
    }`,
    "-F",
    `title=${milestoneData.title}`,
  ]);
  if (milestoneData.description) {
    args.push("-F", `description=${milestoneData.description}`);
  }
  if (milestoneData.dueOn) {
    args.push("-F", `dueOn=${milestoneData.dueOn}`);
  }
  const result = await runGh(args, execOptions);
  if (result.code !== 0) return null;
  const data = parseJsonOutput<{
    data?: { createMilestone?: { milestone?: { number: number; url: string } } };
  }>(result.stdout);
  if (!data?.data?.createMilestone?.milestone) return null;
  return {
    number: data.data.createMilestone.milestone.number,
    url: data.data.createMilestone.milestone.url,
  };
}

/**
 * マイルストーン一覧を取得する（GraphQL）。
 * @param context - 操作対象リポジトリ
 * @param execOptions - 実行時オプション
 * @returns マイルストーンの配列
 */
export async function listMilestones(
  context: IGitHubContext,
  execOptions?: RunOptions,
): Promise<{ number: number; title: string }[]> {
  const args = buildGhArgs(context, [
    "api",
    "graphql",
    "-f",
    `query=query ListMilestones($repo: String!) {
      repository(name: $repo) { milestones(first: 100) { nodes { number title } } }
    }`,
    "-F",
    `repo=${context.repository}`,
  ]);
  const result = await runGh(args, execOptions);
  if (result.code !== 0) return [];
  const data = parseJsonOutput<{
    data?: { repository?: { milestones?: { nodes?: { number: number; title: string }[] } } };
  }>(result.stdout);
  return data?.data?.repository?.milestones?.nodes ?? [];
}

/** GitHub 操作の統一インターフェース */
export interface IGitHubOperations {
  // === Issue 操作 ===
  createIssue(
    context: IGitHubContext,
    payload: CreateIssueOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string } | null>;
  searchIssues(
    context: IGitHubContext,
    filter?: SearchIssuesOptions,
    execOptions?: RunOptions,
  ): Promise<Issue[]>;
  updateIssue(
    context: IGitHubContext,
    number: number,
    changes: UpdateIssueOptions,
    execOptions?: RunOptions,
  ): Promise<Issue | null>;
  closeIssue(context: IGitHubContext, number: number, execOptions?: RunOptions): Promise<boolean>;
  createChildIssue(
    context: IGitHubContext,
    childPayload: CreateChildIssueOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string; parentLinked: boolean } | null>;
  addLabels(
    context: IGitHubContext,
    number: number,
    labels: string[],
    execOptions?: RunOptions,
  ): Promise<boolean>;

  // === Projects V2 操作 ===
  addToProject(
    context: IGitHubContext,
    issueNumber: number,
    projectId: string,
    execOptions?: RunOptions,
  ): Promise<boolean>;
  getProjectFields(
    context: IGitHubContext,
    projectId: string,
    execOptions?: RunOptions,
  ): Promise<ProjectField[]>;
  setProjectField(
    context: IGitHubContext,
    fieldUpdate: SetProjectFieldOptions,
    execOptions?: RunOptions,
  ): Promise<boolean>;

  // === Milestone 操作 ===
  createMilestone(
    context: IGitHubContext,
    milestoneData: CreateMilestoneOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string } | null>;
  listMilestones(
    context: IGitHubContext,
    execOptions?: RunOptions,
  ): Promise<{ number: number; title: string }[]>;
}

// === Gateway 実装 ===

/**
 * IGitHubOperations の具象実装。
 * 全メソッドの gh 呼び出しに `--repo owner/repository` を自動付与する。
 * メソッドシグネチャはインターフェースに従い context を受け取るが、
 * コンストラクタで渡されたコンテキストを優先する。
 */
export class GitHubOperations implements IGitHubOperations {
  constructor(
    private defaultContext: IGitHubContext,
    private execOptions?: RunOptions,
  ) {}

  private resolveContext(context: IGitHubContext): IGitHubContext {
    return context ?? this.defaultContext;
  }

  createIssue(
    context: IGitHubContext,
    payload: CreateIssueOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string } | null> {
    return createIssue(this.resolveContext(context), payload, execOptions ?? this.execOptions);
  }

  searchIssues(
    context: IGitHubContext,
    filter?: SearchIssuesOptions,
    execOptions?: RunOptions,
  ): Promise<Issue[]> {
    return searchIssues(this.resolveContext(context), filter, execOptions ?? this.execOptions);
  }

  updateIssue(
    context: IGitHubContext,
    number: number,
    changes: UpdateIssueOptions,
    execOptions?: RunOptions,
  ): Promise<Issue | null> {
    return updateIssue(
      this.resolveContext(context),
      number,
      changes,
      execOptions ?? this.execOptions,
    );
  }

  closeIssue(
    context: IGitHubContext,
    number: number,
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return closeIssue(this.resolveContext(context), number, execOptions ?? this.execOptions);
  }

  createChildIssue(
    context: IGitHubContext,
    childPayload: CreateChildIssueOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string; parentLinked: boolean } | null> {
    return createChildIssue(
      this.resolveContext(context),
      childPayload,
      execOptions ?? this.execOptions,
    );
  }

  addLabels(
    context: IGitHubContext,
    number: number,
    labels: string[],
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return addLabels(this.resolveContext(context), number, labels, execOptions ?? this.execOptions);
  }

  addToProject(
    context: IGitHubContext,
    issueNumber: number,
    projectId: string,
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return addToProject(
      this.resolveContext(context),
      issueNumber,
      projectId,
      execOptions ?? this.execOptions,
    );
  }

  getProjectFields(
    context: IGitHubContext,
    projectId: string,
    execOptions?: RunOptions,
  ): Promise<ProjectField[]> {
    return getProjectFields(
      this.resolveContext(context),
      projectId,
      execOptions ?? this.execOptions,
    );
  }

  setProjectField(
    context: IGitHubContext,
    fieldUpdate: SetProjectFieldOptions,
    execOptions?: RunOptions,
  ): Promise<boolean> {
    return setProjectField(
      this.resolveContext(context),
      fieldUpdate,
      execOptions ?? this.execOptions,
    );
  }

  createMilestone(
    context: IGitHubContext,
    milestoneData: CreateMilestoneOptions,
    execOptions?: RunOptions,
  ): Promise<{ number: number; url: string } | null> {
    return createMilestone(
      this.resolveContext(context),
      milestoneData,
      execOptions ?? this.execOptions,
    );
  }

  listMilestones(
    context: IGitHubContext,
    execOptions?: RunOptions,
  ): Promise<{ number: number; title: string }[]> {
    return listMilestones(this.resolveContext(context), execOptions ?? this.execOptions);
  }
}

// === Domain Model Interfaces ===

/** Issue エンティティの Domain Model インターフェース（Active Record 風） */
export interface DomainIssue {
  readonly context: IGitHubContext;
  readonly number: number;
  title: string;
  body: string;
  labels: string[];
  state: "open" | "closed";
  milestone?: string;

  addLabel(label: string): this;
  removeLabel(label: string): this;
  save(): Promise<this>;
  close(): Promise<this>;
  createChild(params: CreateChildIssueOptions): Promise<DomainIssue>;
}

/** Project エンティティの Domain Model インターフェース */
export interface DomainProject {
  readonly context: IGitHubContext;
  readonly id: string;

  addItem(issue: DomainIssue): Promise<void>;
  getFields(): Promise<ProjectField[]>;
  setField(itemId: string, field: ProjectField, value: string): Promise<void>;
}

/** Milestone エンティティの Domain Model インターフェース */
export interface DomainMilestone {
  readonly context: IGitHubContext;
  readonly number: number;
  title: string;
  description?: string;
  dueOn?: string;
}
