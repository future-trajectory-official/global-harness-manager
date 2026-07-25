import {
  CreateIssueOptions,
  DomainIssue,
  GitHubOperations,
  IGitHubContext,
  RunOptions,
  SearchIssuesOptions,
} from "./github.ts";

/** Issue エンティティの Domain Model 具象クラス。Active Record パターンで GitHub Issue を操作する。 */
export class Issue implements DomainIssue {
  readonly context: IGitHubContext;
  readonly number: number;
  title: string;
  body: string;
  labels: string[];
  state: "open" | "closed";
  milestone?: string;

  constructor(
    context: IGitHubContext,
    number: number,
    title: string,
    body: string,
    labels: string[],
    state: "open" | "closed",
    milestone?: string,
  ) {
    this.context = context;
    this.number = number;
    this.title = title;
    this.body = body;
    this.labels = labels;
    this.state = state;
    this.milestone = milestone;
  }

  /**
   * 新規Issueを作成する。
   * @param context - 操作対象リポジトリ
   * @param params - 作成するIssueのデータ
   * @param options - 実行時オプション
   * @returns 作成されたIssueインスタンス
   */
  static async create(
    context: IGitHubContext,
    params: CreateIssueOptions,
    options?: RunOptions,
  ): Promise<Issue> {
    const operations = new GitHubOperations(context, options);
    const result = await operations.createIssue(context, params);
    if (!result) throw new Error("Failed to create issue");
    return new Issue(
      context,
      result.number,
      params.title,
      params.body || "",
      params.labels || [],
      "open",
      params.milestone,
    );
  }

  /**
   * 指定されたIssue番号のIssueを取得する。
   * @param context - 操作対象リポジトリ
   * @param number - 取得するIssue番号
   * @param options - 実行時オプション
   * @returns Issueインスタンス、存在しない場合はnull
   */
  static async find(
    context: IGitHubContext,
    number: number,
    options?: RunOptions,
  ): Promise<Issue | null> {
    const operations = new GitHubOperations(context, options);
    const issue = await operations.getIssue(context, number, options);
    if (!issue) return null;
    return new Issue(
      context,
      issue.number,
      issue.title || "",
      issue.body || "",
      issue.labels?.map((l) => l.name) || [],
      (issue.state as "open" | "closed") || "open",
      issue.milestone?.title,
    );
  }

  /**
   * 検索条件に合致するIssue一覧を取得する。
   * @param context - 操作対象リポジトリ
   * @param filter - 検索条件
   * @param options - 実行時オプション
   * @returns Issueインスタンスの配列
   */
  static async list(
    context: IGitHubContext,
    filter?: SearchIssuesOptions,
    options?: RunOptions,
  ): Promise<Issue[]> {
    const operations = new GitHubOperations(context, options);
    const issues = await operations.searchIssues(context, filter, options);
    return issues.map((issue) =>
      new Issue(
        context,
        issue.number,
        issue.title || "",
        issue.body || "",
        issue.labels?.map((l) => l.name) || [],
        (issue.state as "open" | "closed") || "open",
        issue.milestone?.title,
      )
    );
  }

  /**
   * ラベルを追加する。同一ラベルが既に存在する場合は追加しない。
   * @param label - 追加するラベル名
   * @returns 自身のインスタンス（メソッドチェーン用）
   */
  addLabel(label: string): this {
    if (!this.labels.includes(label)) {
      this.labels.push(label);
    }
    return this;
  }

  /**
   * ラベルを削除する。
   * @param label - 削除するラベル名
   * @returns 自身のインスタンス（メソッドチェーン用）
   */
  removeLabel(label: string): this {
    this.labels = this.labels.filter((l) => l !== label);
    return this;
  }

  /**
   * Issueの変更をGitHubに保存する。
   * @param options - 実行時オプション
   * @returns 保存後の自身のインスタンス
   */
  async save(options?: RunOptions): Promise<this> {
    const operations = new GitHubOperations(this.context, options);
    const result = await operations.updateIssue(
      this.context,
      this.number,
      {
        title: this.title,
        body: this.body,
        addLabels: this.labels,
        state: this.state,
        milestone: this.milestone,
      },
      options,
    );
    if (!result) throw new Error("Failed to save issue");
    return this;
  }

  /**
   * Issueをクローズする。
   * @param options - 実行時オプション
   * @returns クローズ後の自身のインスタンス（state が "closed" になる）
   */
  async close(options?: RunOptions): Promise<this> {
    const operations = new GitHubOperations(this.context, options);
    const result = await operations.closeIssue(this.context, this.number, options);
    if (!result) throw new Error("Failed to close issue");
    this.state = "closed";
    return this;
  }

  /**
   * 指定された子Issueを自身の子として関連付ける。
   * @param child - 子Issueインスタンス
   */
  async attach(child: Issue, options?: RunOptions): Promise<void> {
    const operations = new GitHubOperations(this.context, options);
    const result = await operations.attachIssue(this.context, this.number, child.number);
    if (!result) throw new Error("Failed to attach issue");
  }

  /**
   * 指定された子Issueの関連付けを解除する。
   * @param child - 解除する子Issueインスタンス
   */
  async detach(child: Issue, options?: RunOptions): Promise<void> {
    const operations = new GitHubOperations(this.context, options);
    const result = await operations.detachIssue(this.context, child.number, options);
    if (!result) throw new Error("Failed to detach issue");
  }
}
