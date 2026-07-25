import { CreateIssueOptions, DomainIssue, IGitHubContext, RunOptions } from "./github.ts";
import { Issue } from "./issue.ts";

/** エッジケース検証結果 */
export interface EdgeCaseValidation {
  description: string;
  result: "pass" | "fail" | "pending";
  notes?: string;
}

/** PBI 内の個別 AC 結果 */
export interface AcResult {
  ac: string;
  proofMethod: string;
  evidence: string;
  result: "pass" | "fail" | "pending";
}

/** PBI 単位のレビュー結果 */
export interface PbiResult {
  pbiId: string;
  pbiTitle: string;
  proofMethod: string;
  acResults: AcResult[];
}

/** ReviewIssue の作成パラメータ */
export interface ReviewIssueParams {
  title: string;
  milestone: string;
  milestoneNumber: number;
  sprintGoal?: string;
  reviewDate?: string;
  demoEnvironment?: string;
  achievementRate: number;
  pbiResults?: PbiResult[];
  edgeCaseValidations?: EdgeCaseValidation[];
  poFeedback?: string;
  approvalDate?: string;
  approvalState?: "approved" | "rejected" | "pending";
  rejectionReason?: string;
  handoffItems?: string[];
}

/** スプリントレビュー記録用の Issue（type:Review）。Issue クラスを継承し、DomainIssue を実装する。 */
export class ReviewIssue extends Issue implements DomainIssue {
  readonly milestoneNumber: number;
  sprintGoal: string;
  reviewDate: string;
  demoEnvironment: string;
  achievementRate: number;
  pbiResults: PbiResult[];
  edgeCaseValidations: EdgeCaseValidation[];
  poFeedback: string;
  approvalDate: string;
  approvalState: "approved" | "rejected" | "pending";
  rejectionReason: string;
  handoffItems: string[];

  constructor(
    context: IGitHubContext,
    number: number,
    title: string,
    body: string,
    labels: string[],
    state: "open" | "closed",
    milestone: string | undefined,
    milestoneNumber: number,
    sprintGoal: string,
    reviewDate: string,
    demoEnvironment: string,
    achievementRate: number,
    pbiResults: PbiResult[],
    edgeCaseValidations: EdgeCaseValidation[],
    poFeedback: string,
    approvalDate: string,
    approvalState: "approved" | "rejected" | "pending",
    rejectionReason: string,
    handoffItems: string[],
  ) {
    super(context, number, title, body, labels, state, milestone);
    this.milestoneNumber = milestoneNumber;
    this.sprintGoal = sprintGoal;
    this.reviewDate = reviewDate;
    this.demoEnvironment = demoEnvironment;
    this.achievementRate = achievementRate;
    this.pbiResults = pbiResults;
    this.edgeCaseValidations = edgeCaseValidations;
    this.poFeedback = poFeedback;
    this.approvalDate = approvalDate;
    this.approvalState = approvalState;
    this.rejectionReason = rejectionReason;
    this.handoffItems = handoffItems;
  }

  static async createFromParams(
    context: IGitHubContext,
    params: ReviewIssueParams,
    options?: RunOptions,
  ): Promise<ReviewIssue> {
    const labels = ["type:Review"];
    const issue = new ReviewIssue(
      context,
      0,
      params.title,
      "",
      labels,
      "open",
      params.milestone,
      params.milestoneNumber,
      params.sprintGoal || "",
      params.reviewDate || "TBD",
      params.demoEnvironment || "サンドボックス",
      params.achievementRate,
      params.pbiResults || [],
      params.edgeCaseValidations || [],
      params.poFeedback || "",
      params.approvalDate || "TBD",
      params.approvalState || "pending",
      params.rejectionReason || "",
      params.handoffItems || [],
    );
    issue.body = issue.serializeBody();
    const created = await Issue.create(context, issue.toCreateParams(), options);
    return new ReviewIssue(
      context,
      created.number,
      created.title,
      created.body,
      created.labels,
      created.state,
      created.milestone,
      params.milestoneNumber,
      params.sprintGoal || "",
      params.reviewDate || "TBD",
      params.demoEnvironment || "サンドボックス",
      params.achievementRate,
      params.pbiResults || [],
      params.edgeCaseValidations || [],
      params.poFeedback || "",
      params.approvalDate || "TBD",
      params.approvalState || "pending",
      params.rejectionReason || "",
      params.handoffItems || [],
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

    sections.push(`# 📋 スプリントレビュー記録`);
    sections.push("");
    sections.push(`- **対象スプリント**: Sprint ${this.milestoneNumber}`);
    sections.push(`- **スプリントゴール**: ${this.sprintGoal}`);
    sections.push(`- **レビュー実施日**: ${this.reviewDate}`);
    sections.push(`- **デモ環境**: ${this.demoEnvironment}`);
    sections.push(`- **達成率**: ${this.achievementRate}%`);
    sections.push("");

    if (this.pbiResults.length > 0) {
      sections.push("---");
      sections.push("## PBI達成状況一覧");
      sections.push("");
      sections.push("| PBI | 証明方法 | 判定 |");
      sections.push("|-----|----------|:----:|");
      for (const pbi of this.pbiResults) {
        const allPass = pbi.acResults.every((ac) => ac.result === "pass");
        const icon = allPass ? "🟢" : "🔴";
        sections.push(`| ${pbi.pbiId} | ${pbi.proofMethod} | ${icon} |`);
      }
      sections.push("");

      sections.push("## 個別PBIの実機デモとエビデンス記録");
      sections.push("");
      for (const pbi of this.pbiResults) {
        sections.push(`### PBI: ${pbi.pbiId}`);
        sections.push("");
        sections.push(`**タイトル**: ${pbi.pbiTitle}`);
        sections.push("");
        sections.push("| AC | 証明方法 | エビデンス | 結果 |");
        sections.push("|----|----------|------------|:----:|");
        for (const ac of pbi.acResults) {
          const icon = ac.result === "pass"
            ? "🟢 合格"
            : ac.result === "fail"
            ? "🔴 不合格"
            : "⏳ 未確認";
          sections.push(`| ${ac.ac} | ${ac.proofMethod} | ${ac.evidence} | ${icon} |`);
        }
        sections.push("");
      }
    }

    if (this.edgeCaseValidations.length > 0) {
      sections.push("---");
      sections.push("## エッジケース検証結果");
      sections.push("");
      sections.push("| 説明 | 結果 | 備考 |");
      sections.push("|------|:----:|------|");
      for (const v of this.edgeCaseValidations) {
        const icon = v.result === "pass" ? "🟢" : v.result === "fail" ? "🔴" : "⏳";
        sections.push(`| ${v.description} | ${icon} ${v.result} | ${v.notes || ""} |`);
      }
      sections.push("");
    }

    sections.push("---");
    sections.push("## POフィードバック");
    sections.push("");
    sections.push(`> ${this.poFeedback || "[レビュー時に記入]"}`);
    sections.push("");

    sections.push("## PO承認の証跡");
    sections.push("");
    sections.push(`- **承認日時**: ${this.approvalDate}`);
    const approvalMark = this.approvalState === "approved"
      ? "🟢 承認済み"
      : this.approvalState === "rejected"
      ? "🔴 差し戻し"
      : "⏳ 未承認";
    sections.push(`- **承認状態**: ${approvalMark}`);
    if (this.rejectionReason) {
      sections.push(`- **差し戻し理由**: ${this.rejectionReason}`);
    }
    sections.push("");

    if (this.handoffItems.length > 0) {
      sections.push("## 次スプリントへの申し送り事項");
      sections.push("");
      for (const item of this.handoffItems) {
        sections.push(`- [ ] ${item}`);
      }
      sections.push("");
    }

    return sections.join("\n");
  }

  override async save(options?: RunOptions): Promise<this> {
    this.body = this.serializeBody();
    const saved = await super.save(options);
    return saved;
  }
}
