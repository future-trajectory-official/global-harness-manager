import { assertEquals } from "jsr:@std/assert@^1.0.7";
import { type GuardRules, parseGuardBlock, validateTaskMd } from "./validate-task.ts";

const SAMPLE_TEMPLATE = `# Task Tracking: [Task Name]

[Task description or summary]

<!--
GUARD:REQUIRED_H2
- 📊 セッションメトリクス & 予実管理
- 📋 実行タスク一覧

GUARD:REQUIRED_H3
- Phase 1
- Phase 2
- Phase 3
- Phase 4

GUARD:REQUIRED_METRICS
- 初期見積 (想定介入回数)
- 計画後見積 (想定介入回数)
- 実際の介入回数
-->

## 📊 セッションメトリクス & 予実管理
...

## 📋 実行タスク一覧
...
`;

const VALID_TASK = `# Task Tracking: Some Feature

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **初期見積 (想定介入回数)**: 2 回
- **計画後見積 (想定介入回数)**: 3 回
- **実際の介入回数**: 0

## 📋 実行タスク一覧

### Phase 1: 準備

- [ ] task item A

### Phase 2: 実装

- [ ] task item B

### Phase 3: 検証

- [ ] task item C

### Phase 4: 完了

- [ ] task item D
`;

// --- parseGuardBlock ---

function assertRules(content: string): GuardRules {
  const rules = parseGuardBlock(content);
  assertEquals(rules !== null, true);
  return rules!;
}

Deno.test("parseGuardBlock extracts all required H2s from template", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  assertEquals(rules.requiredH2s, [
    "📊 セッションメトリクス & 予実管理",
    "📋 実行タスク一覧",
  ]);
});

Deno.test("parseGuardBlock extracts all required H3s from template", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  assertEquals(rules.requiredH3s, ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]);
});

Deno.test("parseGuardBlock extracts all required metrics from template", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  assertEquals(rules.requiredMetrics, [
    "初期見積 (想定介入回数)",
    "計画後見積 (想定介入回数)",
    "実際の介入回数",
  ]);
});

Deno.test("parseGuardBlock returns null when no GUARD block exists", () => {
  const rules = parseGuardBlock("# No guard here\n\nsome content");
  assertEquals(rules, null);
});

Deno.test("parseGuardBlock returns partial rules when only some GUARD sections exist", () => {
  const partial = `<!--
GUARD:REQUIRED_H2
- Only One H2
-->`;
  const rules = parseGuardBlock(partial);
  assertEquals(rules, { requiredH2s: ["Only One H2"], requiredH3s: [], requiredMetrics: [] });
});

// --- validateTaskMd with dynamic rules ---

Deno.test("validateTaskMd passes with rules from template for a well-formed task.md", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(VALID_TASK, rules);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateTaskMd reports missing required H2", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(
    VALID_TASK.replace("## 📊 セッションメトリクス", "## 📊 削除された"),
    rules,
  );
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("H2")), true);
});

Deno.test("validateTaskMd reports missing required H3", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(VALID_TASK.replace("### Phase 2:", "### Phase X:"), rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("Phase 2")), true);
});

Deno.test("validateTaskMd reports missing required metrics field", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(VALID_TASK.replace("初期見積", "削除された"), rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("初期見積")), true);
});

Deno.test("validateTaskMd with empty rule set passes everything", () => {
  const emptyRules: GuardRules = { requiredH2s: [], requiredH3s: [], requiredMetrics: [] };
  const result = validateTaskMd("# just a title", emptyRules);
  assertEquals(result.valid, true);
});

Deno.test("validateTaskMd returns errors for empty content", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd("", rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

// --- validateTaskMd without rules (defaults) ---

Deno.test("validateTaskMd without rules uses hardcoded defaults", () => {
  const result = validateTaskMd(VALID_TASK);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});
