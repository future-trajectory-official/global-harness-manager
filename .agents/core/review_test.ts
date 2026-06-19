import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { DomainIssue, IGitHubContext } from "./github.ts";
import { EdgeCaseValidation, PbiResult, ReviewIssue } from "./review.ts";

const TEST_CONTEXT: IGitHubContext = { owner: "test-owner", repository: "test-repo" };

const defaultPbiResults: PbiResult[] = [];
const defaultEdgeCases: EdgeCaseValidation[] = [];
const defaultHandoff: string[] = [];

/**
 * ユースケース: ReviewIssue のコンストラクタが全てのプロパティを正しく設定すること
 */
Deno.test("ReviewIssue - constructor sets all properties", () => {
  const validations: EdgeCaseValidation[] = [
    { description: "Test 1", result: "pass", notes: "OK" },
    { description: "Test 2", result: "fail" },
  ];
  const pbiResults: PbiResult[] = [
    {
      pbiId: "PBI-1",
      pbiTitle: "Login Feature",
      proofMethod: "実機デモ",
      acResults: [{ ac: "AC1", proofMethod: "確認", evidence: "録画", result: "pass" }],
    },
  ];
  const issue = new ReviewIssue(
    TEST_CONTEXT,
    1,
    "Sprint 12 Review",
    "",
    ["type:Review"],
    "open",
    "Sprint 12",
    12,
    "ゴール",
    "2026-06-19",
    "サンドボックス",
    75,
    pbiResults,
    validations,
    "フィードバック",
    "2026-06-19",
    "approved",
    "",
    ["申し送り1"],
  );

  assertEquals(issue.number, 1);
  assertEquals(issue.title, "Sprint 12 Review");
  assertEquals(issue.labels, ["type:Review"]);
  assertEquals(issue.milestoneNumber, 12);
  assertEquals(issue.sprintGoal, "ゴール");
  assertEquals(issue.reviewDate, "2026-06-19");
  assertEquals(issue.achievementRate, 75);
  assertEquals(issue.pbiResults.length, 1);
  assertEquals(issue.edgeCaseValidations.length, 2);
  assertEquals(issue.poFeedback, "フィードバック");
  assertEquals(issue.approvalState, "approved");
  assertEquals(issue.handoffItems, ["申し送り1"]);
  assert(issue instanceof ReviewIssue);
});

/**
 * ユースケース: ReviewIssue が DomainIssue インターフェースを実装していること
 */
Deno.test("ReviewIssue - implements DomainIssue interface", () => {
  const issue = new ReviewIssue(
    TEST_CONTEXT,
    1,
    "Review",
    "",
    [],
    "open",
    undefined,
    1,
    "",
    "",
    "",
    100,
    defaultPbiResults,
    defaultEdgeCases,
    "",
    "",
    "pending",
    "",
    defaultHandoff,
  );
  const domain: DomainIssue = issue;
  assertEquals(domain.number, 1);
});

/**
 * ユースケース: toCreateParams が正しいパラメータを返すこと
 */
Deno.test("ReviewIssue - toCreateParams returns correct params", () => {
  const pbiResults: PbiResult[] = [
    {
      pbiId: "PBI-1",
      pbiTitle: "Login Feature",
      proofMethod: "実機デモ",
      acResults: [{ ac: "AC1: ログイン", proofMethod: "確認", evidence: "録画", result: "pass" }],
    },
  ];
  const issue = new ReviewIssue(
    TEST_CONTEXT,
    0,
    "Review",
    "",
    ["type:Review"],
    "open",
    "Sprint 12",
    12,
    "ゴール",
    "2026-06-19",
    "サンドボックス",
    50,
    pbiResults,
    defaultEdgeCases,
    "",
    "",
    "pending",
    "",
    defaultHandoff,
  );

  const params = issue.toCreateParams();

  assertEquals(params.title, "Review");
  assertStringIncludes(params.body || "", "50%");
  assertStringIncludes(params.body || "", "PBI-1");
  assertStringIncludes(params.body || "", "AC1");
  assertStringIncludes(params.body || "", "スプリントゴール");
  assertEquals(params.milestone, "Sprint 12");
});

/**
 * ユースケース: serializeBody が全セクションを Markdown として生成すること
 */
Deno.test("ReviewIssue - serializeBody includes all sections", () => {
  const validations: EdgeCaseValidation[] = [
    { description: "Edge1", result: "pass" },
  ];
  const pbiResults: PbiResult[] = [
    {
      pbiId: "PBI-X",
      pbiTitle: "Feature X",
      proofMethod: "テストログ",
      acResults: [{ ac: "AC1", proofMethod: "確認", evidence: "リンク", result: "pass" }],
    },
  ];
  const issue = new ReviewIssue(
    TEST_CONTEXT,
    1,
    "R",
    "",
    ["type:Review"],
    "open",
    undefined,
    12,
    "スプリントゴール",
    "2026-06-19",
    "コンテナA",
    80,
    pbiResults,
    validations,
    "良い",
    "2026-06-19",
    "approved",
    "",
    ["次回課題"],
  );

  const body = issue.serializeBody();

  assertStringIncludes(body, "スプリントレビュー記録");
  assertStringIncludes(body, "スプリントゴール");
  assertStringIncludes(body, "2026-06-19");
  assertStringIncludes(body, "80%");
  assertStringIncludes(body, "PBI達成状況一覧");
  assertStringIncludes(body, "PBI-X");
  assertStringIncludes(body, "個別PBI");
  assertStringIncludes(body, "エッジケース検証結果");
  assertStringIncludes(body, "POフィードバック");
  assertStringIncludes(body, "良い");
  assertStringIncludes(body, "承認の証跡");
  assertStringIncludes(body, "🟢 承認済み");
  assertStringIncludes(body, "申し送り事項");
  assertStringIncludes(body, "次回課題");
});

/**
 * ユースケース: 空の配列でもセクションが省略されること
 */
Deno.test("ReviewIssue - handles empty arrays", () => {
  const issue = new ReviewIssue(
    TEST_CONTEXT,
    1,
    "R",
    "",
    [],
    "open",
    undefined,
    1,
    "",
    "",
    "",
    0,
    defaultPbiResults,
    defaultEdgeCases,
    "",
    "",
    "pending",
    "",
    defaultHandoff,
  );

  const body = issue.serializeBody();
  assertStringIncludes(body, "スプリントレビュー記録");
  assertStringIncludes(body, "0%");
});

/**
 * ユースケース: 達成率の境界値（0, 100）が正しく設定されること
 */
Deno.test("ReviewIssue - handles boundary achievement rates", () => {
  const issue0 = new ReviewIssue(
    TEST_CONTEXT,
    1,
    "R0",
    "",
    [],
    "open",
    undefined,
    1,
    "",
    "",
    "",
    0,
    defaultPbiResults,
    defaultEdgeCases,
    "",
    "",
    "pending",
    "",
    defaultHandoff,
  );
  assertEquals(issue0.achievementRate, 0);
  assertStringIncludes(issue0.serializeBody(), "0%");

  const issue100 = new ReviewIssue(
    TEST_CONTEXT,
    2,
    "R100",
    "",
    [],
    "open",
    undefined,
    1,
    "",
    "",
    "",
    100,
    defaultPbiResults,
    defaultEdgeCases,
    "",
    "",
    "pending",
    "",
    defaultHandoff,
  );
  assertEquals(issue100.achievementRate, 100);
  assertStringIncludes(issue100.serializeBody(), "100%");
});
