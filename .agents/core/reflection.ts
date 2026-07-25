import { CreateIssueOptions, DomainIssue, IGitHubContext, RunOptions } from "./github.ts";
import { Issue } from "./issue.ts";

/** ReflectionIssue の作成パラメータ */
export interface ReflectionIssueParams {
  title: string;
  body?: string;
  milestone?: string;
  milestoneNumber: number;
  keep: string[];
  problem: string[];
  tryItems: string[];
  referencedSessionNumbers: number[];
}

/** スプリント振り返り記録用の Issue（type:Reflection）。Issue クラスを継承し、DomainIssue を実装する。 */
export class ReflectionIssue extends Issue implements DomainIssue {
  readonly milestoneNumber: number;
  keep: string[];
  problem: string[];
  tryItems: string[];
  referencedSessionNumbers: number[];

  constructor(
    context: IGitHubContext,
    number: number,
    title: string,
    body: string,
    labels: string[],
    state: "open" | "closed",
    milestone: string | undefined,
    milestoneNumber: number,
    keep: string[],
    problem: string[],
    tryItems: string[],
    referencedSessionNumbers: number[],
  ) {
    super(context, number, title, body, labels, state, milestone);
    this.milestoneNumber = milestoneNumber;
    this.keep = keep;
    this.problem = problem;
    this.tryItems = tryItems;
    this.referencedSessionNumbers = referencedSessionNumbers;
  }

  static async createFromParams(
    context: IGitHubContext,
    params: ReflectionIssueParams,
    options?: RunOptions,
  ): Promise<ReflectionIssue> {
    const labels = ["type:Reflection"];
    const issue = new ReflectionIssue(
      context,
      0,
      params.title,
      params.body || "",
      labels,
      "open",
      params.milestone,
      params.milestoneNumber,
      params.keep,
      params.problem,
      params.tryItems,
      params.referencedSessionNumbers,
    );
    issue.body = issue.serializeBody();
    const created = await Issue.create(context, issue.toCreateParams(), options);
    return new ReflectionIssue(
      context,
      created.number,
      created.title,
      created.body,
      created.labels,
      created.state,
      created.milestone,
      params.milestoneNumber,
      params.keep,
      params.problem,
      params.tryItems,
      params.referencedSessionNumbers,
    );
  }

  toCreateParams(): CreateIssueOptions {
    return {
      title: this.title,
      body: this.serializeBody(),
      labels: this.labels,
      milestone: this.milestone,
    };
  }

  serializeBody(): string {
    const sections: string[] = [];
    if (this.body) {
      sections.push(this.body);
    }
    sections.push("---");
    sections.push("");
    sections.push("## 振り返り");
    sections.push("");
    sections.push(`- **対象スプリント**: ${this.milestoneNumber}`);
    if (this.keep.length > 0) {
      sections.push("");
      sections.push("### Keep");
      for (const item of this.keep) {
        sections.push(`- ${item}`);
      }
    }
    if (this.problem.length > 0) {
      sections.push("");
      sections.push("### Problem");
      for (const item of this.problem) {
        sections.push(`- ${item}`);
      }
    }
    if (this.tryItems.length > 0) {
      sections.push("");
      sections.push("### Try");
      for (const item of this.tryItems) {
        sections.push(`- ${item}`);
      }
    }
    if (this.referencedSessionNumbers.length > 0) {
      const sessionLinks = this.referencedSessionNumbers.map((n) => `#${n}`).join(", ");
      sections.push("");
      sections.push(`### 参照セッション`);
      sections.push(sessionLinks);
    }
    return sections.join("\n");
  }

  override async save(options?: RunOptions): Promise<this> {
    this.body = this.serializeBody();
    const saved = await super.save(options);
    return saved;
  }
}
