import {
  DomainIssue,
  DomainProject,
  GitHubOperations,
  IGitHubContext,
  ProjectField,
  RunOptions,
} from "./github.ts";

/** Project エンティティの Domain Model 具象クラス。GitHub Projects V2 を操作する。 */
export class Project implements DomainProject {
  readonly context: IGitHubContext;
  readonly id: string;

  constructor(context: IGitHubContext, id: string) {
    this.context = context;
    this.id = id;
  }

  /**
   * 指定されたプロジェクトIDの Project インスタンスを生成する。
   * @param context - 操作対象リポジトリ
   * @param id - プロジェクトID
   * @returns Project インスタンス
   */
  static async find(
    context: IGitHubContext,
    id: string,
  ): Promise<Project> {
    return await Promise.resolve(new Project(context, id));
  }

  /**
   * Issueをプロジェクトに追加する。
   * @param issue - 追加するIssueインスタンス
   * @param options - 実行時オプション
   */
  async addItem(issue: DomainIssue, options?: RunOptions): Promise<void> {
    const operations = new GitHubOperations(this.context, options);
    const result = await operations.addToProject(this.context, issue.number, this.id, options);
    if (!result) throw new Error("Failed to add issue to project");
  }

  /**
   * プロジェクトのフィールド定義一覧を取得する。
   * @param options - 実行時オプション
   * @returns フィールド定義の配列
   */
  async getFields(options?: RunOptions): Promise<ProjectField[]> {
    const operations = new GitHubOperations(this.context, options);
    return await operations.getProjectFields(this.context, this.id, options);
  }

  /**
   * プロジェクトアイテムのフィールド値を設定する。
   * @param itemId - アイテムID
   * @param field - 設定対象フィールド
   * @param value - 設定する値
   * @param options - 実行時オプション
   */
  async setField(
    itemId: string,
    field: ProjectField,
    value: string,
    options?: RunOptions,
  ): Promise<void> {
    const operations = new GitHubOperations(this.context, options);
    const result = await operations.setProjectField(
      this.context,
      { itemId, fieldId: field.id, value },
      options,
    );
    if (!result) throw new Error("Failed to set project field");
  }
}
