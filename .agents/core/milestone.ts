import {
  CreateMilestoneOptions,
  DomainMilestone,
  GitHubOperations,
  IGitHubContext,
  RunOptions,
} from "./github.ts";

/** Milestone エンティティの Domain Model 具象クラス。GitHub マイルストーンを操作する。 */
export class Milestone implements DomainMilestone {
  readonly context: IGitHubContext;
  readonly number: number;
  title: string;
  description?: string;
  dueOn?: string;

  constructor(
    context: IGitHubContext,
    number: number,
    title: string,
    description?: string,
    dueOn?: string,
  ) {
    this.context = context;
    this.number = number;
    this.title = title;
    this.description = description;
    this.dueOn = dueOn;
  }

  /**
   * 新規マイルストーンを作成する。
   * @param context - 操作対象リポジトリ
   * @param params - 作成するマイルストーンのデータ
   * @param options - 実行時オプション
   * @returns 作成された Milestone インスタンス
   */
  static async create(
    context: IGitHubContext,
    params: CreateMilestoneOptions,
    options?: RunOptions,
  ): Promise<Milestone> {
    const operations = new GitHubOperations(context, options);
    const result = await operations.createMilestone(context, params, options);
    if (!result) throw new Error("Failed to create milestone");
    return new Milestone(context, result.number, params.title, params.description, params.dueOn);
  }

  /**
   * すべてのマイルストーンを取得する。
   * @param context - 操作対象リポジトリ
   * @param options - 実行時オプション
   * @returns Milestone インスタンスの配列
   */
  static async list(
    context: IGitHubContext,
    options?: RunOptions,
  ): Promise<Milestone[]> {
    const operations = new GitHubOperations(context, options);
    const milestones = await operations.listMilestones(context, options);
    return milestones.map((m) => new Milestone(context, m.number, m.title));
  }
}
