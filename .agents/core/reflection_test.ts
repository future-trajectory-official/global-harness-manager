import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { DomainIssue, IGitHubContext } from "./github.ts";
import { ReflectionIssue } from "./reflection.ts";

const TEST_CONTEXT: IGitHubContext = { owner: "test-owner", repository: "test-repo" };

/**
 * ユースケース: ReflectionIssue のコンストラクタが全てのプロパティを正しく設定すること
 */
Deno.test("ReflectionIssue - constructor sets all properties", () => {
  const issue = new ReflectionIssue(
    TEST_CONTEXT,
    1,
    "Sprint 12 Reflection",
    "",
    ["type:Reflection"],
    "open",
    "Sprint 12",
    12,
    ["Good code review"],
    ["Missed deadline"],
    ["Daily standup"],
    [101, 102],
  );

  assertEquals(issue.number, 1);
  assertEquals(issue.title, "Sprint 12 Reflection");
  assertEquals(issue.labels, ["type:Reflection"]);
  assertEquals(issue.milestoneNumber, 12);
  assertEquals(issue.keep, ["Good code review"]);
  assertEquals(issue.problem, ["Missed deadline"]);
  assertEquals(issue.tryItems, ["Daily standup"]);
  assertEquals(issue.referencedSessionNumbers, [101, 102]);
  assert(issue instanceof ReflectionIssue);
});

/**
 * ユースケース: ReflectionIssue が DomainIssue インターフェースを実装していること
 */
Deno.test("ReflectionIssue - implements DomainIssue interface", () => {
  const issue = new ReflectionIssue(
    TEST_CONTEXT,
    1,
    "R",
    "",
    [],
    "open",
    undefined,
    1,
    [],
    [],
    [],
    [],
  );
  const domain: DomainIssue = issue;
  assertEquals(domain.number, 1);
});

/**
 * ユースケース: toCreateParams が正しいパラメータを返すこと
 */
Deno.test("ReflectionIssue - toCreateParams returns correct params", () => {
  const issue = new ReflectionIssue(
    TEST_CONTEXT,
    0,
    "Sprint 12 Reflection",
    "",
    ["type:Reflection"],
    "open",
    "Sprint 12",
    12,
    ["Keep1"],
    ["Problem1"],
    ["Try1"],
    [101],
  );

  const params = issue.toCreateParams();

  assertEquals(params.title, "Sprint 12 Reflection");
  assertStringIncludes(params.body || "", "Keep1");
  assertStringIncludes(params.body || "", "Problem1");
  assertStringIncludes(params.body || "", "Try1");
  assertEquals(params.milestone, "Sprint 12");
});

/**
 * ユースケース: serializeBody が追加プロパティを Markdown として正しく含むこと
 */
Deno.test("ReflectionIssue - serializeBody includes extra properties", () => {
  const issue = new ReflectionIssue(
    TEST_CONTEXT,
    1,
    "Reflection",
    "## Summary\nSomething",
    ["type:Reflection"],
    "open",
    undefined,
    12,
    ["Keep code review"],
    ["Too many bugs"],
    ["Add more tests"],
    [1, 2],
  );

  const body = issue.serializeBody();

  assertStringIncludes(body, "## Summary");
  assertStringIncludes(body, "## 振り返り");
  assertStringIncludes(body, "対象スプリント");
  assertStringIncludes(body, "12");
  assertStringIncludes(body, "### Keep");
  assertStringIncludes(body, "Keep code review");
  assertStringIncludes(body, "### Problem");
  assertStringIncludes(body, "Too many bugs");
  assertStringIncludes(body, "### Try");
  assertStringIncludes(body, "Add more tests");
  assertStringIncludes(body, "### 参照セッション");
  assertStringIncludes(body, "#1, #2");
});

/**
 * ユースケース: 空の配列プロパティでも正常動作すること
 */
Deno.test("ReflectionIssue - handles empty arrays", () => {
  const issue = new ReflectionIssue(
    TEST_CONTEXT,
    1,
    "R",
    "",
    [],
    "open",
    undefined,
    1,
    [],
    [],
    [],
    [],
  );
  assertEquals(issue.keep, []);
  assertEquals(issue.problem, []);
  assertEquals(issue.tryItems, []);
  assertEquals(issue.referencedSessionNumbers, []);
  const body = issue.serializeBody();
  assertStringIncludes(body, "## 振り返り");
  assertStringIncludes(body, "対象スプリント");
  assertStringIncludes(body, "1");
});
