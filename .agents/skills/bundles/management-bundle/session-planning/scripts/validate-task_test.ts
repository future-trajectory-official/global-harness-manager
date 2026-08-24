import { assertEquals } from "jsr:@std/assert@^1.0.7";
import {
  checkInterventionHistory,
  countACs,
  type GuardRules,
  hasGuardBlock,
  parseGuardBlock,
  validateTaskMd,
} from "./validate-task.ts";

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
- 計画前見積 (想定介入回数)
- 計画後見積 (想定介入回数)
- 完了時実績
-->

## 📊 セッションメトリクス & 予実管理
...

## 📋 実行タスク一覧
...
`;

const VALID_TASK = `# Task Tracking: Some Feature

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 2 回
- **計画後見積 (想定介入回数)**: 3 回
- **完了時実績**: 0

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

/**
 * parseGuardBlock - テンプレートから GUARD:REQUIRED_H2 セクションを正しく抽出できることを検証する。
 * サンプルテンプレートに定義された必須H2見出しがパース結果と一致することを確認する。
 */
Deno.test("parseGuardBlock extracts all required H2s from template", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  assertEquals(rules.requiredH2s, [
    "📊 セッションメトリクス & 予実管理",
    "📋 実行タスク一覧",
  ]);
});

/**
 * parseGuardBlock - テンプレートから GUARD:REQUIRED_H3 セクションを正しく抽出できることを検証する。
 * 必須H3見出し（Phase 1〜4）がパース結果に含まれることを確認する。
 */
Deno.test("parseGuardBlock extracts all required H3s from template", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  assertEquals(rules.requiredH3s, ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]);
});

/**
 * parseGuardBlock - テンプレートから GUARD:REQUIRED_METRICS セクションを抽出できることを検証する。
 * 必須メトリクスフィールド名がパース結果として返されることを確認する。
 */
Deno.test("parseGuardBlock extracts all required metrics from template", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  assertEquals(rules.requiredMetrics, [
    "計画前見積 (想定介入回数)",
    "計画後見積 (想定介入回数)",
    "完了時実績",
  ]);
});

/**
 * parseGuardBlock - GUARD ブロックが存在しない場合に null を返すことを検証する。
 * GUARD 宣言なしのマークダウンに対してパースが正しく失敗する異常系を確認する。
 */
Deno.test("parseGuardBlock returns null when no GUARD block exists", () => {
  const rules = parseGuardBlock("# No guard here\n\nsome content");
  assertEquals(rules, null);
});

/**
 * parseGuardBlock - GUARD 宣言が一部のみ存在する場合でもパースできることを検証する。
 * REQUIRED_H2 のみ存在し、他が欠落している場合に部分的なルールが返されることを確認する。
 */
Deno.test("parseGuardBlock returns partial rules when only some GUARD sections exist", () => {
  const partial = `<!--
GUARD:REQUIRED_H2
- Only One H2
-->`;
  const rules = parseGuardBlock(partial);
  assertEquals(rules, {
    requiredH2s: ["Only One H2"],
    requiredH3s: [],
    requiredMetrics: [],
    requiredTasks: [],
  });
});

// --- validateTaskMd with dynamic rules ---

/**
 * validateTaskMd - 適切に作成された task.md がバリデーションを通過することを検証する。
 * テンプレート由来のルールを適用した場合に valid=true かつ errors=0 となる正常系を確認する。
 */
Deno.test("validateTaskMd passes with rules from template for a well-formed task.md", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(VALID_TASK, rules);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

/**
 * validateTaskMd - 必須 H2 見出しが欠落している場合にエラーが報告されることを検証する。
 * 異常系として、セッションメトリクスの見出しを削除した際のバリデーション失敗を確認する。
 */
Deno.test("validateTaskMd reports missing required H2", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(
    VALID_TASK.replace("## 📊 セッションメトリクス", "## 📊 削除された"),
    rules,
  );
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("H2")), true);
});

/**
 * validateTaskMd - 必須 H3 見出しが欠落している場合にエラーが報告されることを検証する。
 * Phase 2 の見出しを書き換えた際に、元の必須見出し名がエラーに含まれることを確認する。
 */
Deno.test("validateTaskMd reports missing required H3", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(VALID_TASK.replace("### Phase 2:", "### Phase X:"), rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("Phase 2")), true);
});

/**
 * validateTaskMd - 必須メトリクスフィールドが欠落している場合にエラーが報告されることを検証する。
 * 「計画前見積」を削除した際にバリデーションで検出されることを確認する。
 */
Deno.test("validateTaskMd reports missing required metrics field", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd(VALID_TASK.replace("計画前見積", "削除された"), rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("計画前見積")), true);
});

/**
 * validateTaskMd - 空のルールセットでは全てのマークダウンがパスすることを検証する。
 * GuardRules の全フィールドが空配列の場合に常に valid となる正常系を確認する。
 */
Deno.test("validateTaskMd with empty rule set passes everything", () => {
  const emptyRules: GuardRules = {
    requiredH2s: [],
    requiredH3s: [],
    requiredMetrics: [],
    requiredTasks: [],
  };
  const result = validateTaskMd("# just a title", emptyRules);
  assertEquals(result.valid, true);
});

/**
 * validateTaskMd - 空のコンテンツに対してエラーが報告されることを検証する。
 * 空文字を入力した場合に valid=false かつ errors が空でないことを確認する。
 */
Deno.test("validateTaskMd returns errors for empty content", () => {
  const rules = assertRules(SAMPLE_TEMPLATE);
  const result = validateTaskMd("", rules);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

// --- validateTaskMd without rules (defaults) ---

/**
 * validateTaskMd - ルールを指定しない場合にハードコードされたデフォルト値が使用されることを検証する。
 * 引数なしで呼び出した場合でも正常にバリデーションが動作することを確認する。
 */
Deno.test("validateTaskMd without rules uses hardcoded defaults", () => {
  const result = validateTaskMd(VALID_TASK);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

// --- REQUIRED_TASKS ---

const SAMPLE_TEMPLATE_WITH_TASKS = `# Task Tracking: [Task Name]

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
- 計画前見積 (想定介入回数)
- 計画後見積 (想定介入回数)
- 完了時実績

GUARD:REQUIRED_TASKS
- Phase 1: 準備
  - develop-environment-setup
  - initialize-branch
- Phase 2: Foreach (AC[].count) ACベースの開発
  - ac-checkpoint-implementation
  - hybrid-triage-commit
- Phase 3: リファクタリングと品質検証
  - refactoring-loop
  - quality-verification
  - hybrid-triage-commit
- Phase 4: 公開
  - git push
  - create-pull-request
  - merge-branch
-->

## 📊 セッションメトリクス & 予実管理
...

## 📋 実行タスク一覧
...
`;

const VALID_TASK_WITH_KEYWORDS = `# Task Tracking: Some Feature

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 2 回
- **計画後見積 (想定介入回数)**: 3 回
- **完了時実績**: 0

## 📋 実行タスク一覧

### Phase 1: 準備

- [ ] develop-environment-setup
- [ ] initialize-branch

### Phase 2: ACベースの開発

- [ ] ac-checkpoint-implementation (AC-1)
- [ ] hybrid-triage-commit (wip)
- [ ] ac-checkpoint-implementation (AC-2)
- [ ] hybrid-triage-commit (wip)

### Phase 3: リファクタリングと品質検証

- [ ] refactoring-loop
- [ ] quality-verification
- [ ] hybrid-triage-commit (triage)

### Phase 4: 公開

- [ ] git push
- [ ] create-pull-request
- [ ] merge-branch
`;

/**
 * parseGuardBlock - REQUIRED_TASKS セクションを正しく抽出できることを検証する。
 */
Deno.test("parseGuardBlock extracts REQUIRED_TASKS from template", () => {
  const rules = parseGuardBlock(SAMPLE_TEMPLATE_WITH_TASKS);
  assertEquals(rules !== null, true);
  assertEquals(rules!.requiredTasks.length, 4);
  assertEquals(rules!.requiredTasks[0].phaseName, "Phase 1");
  assertEquals(rules!.requiredTasks[0].keywords, [
    "develop-environment-setup",
    "initialize-branch",
  ]);
});

/**
 * parseGuardBlock - Foreach (AC[].count) 構文を正しく検出することを検証する。
 */
Deno.test("parseGuardBlock detects Foreach syntax", () => {
  const rules = parseGuardBlock(SAMPLE_TEMPLATE_WITH_TASKS);
  assertEquals(rules!.requiredTasks[1].phaseName, "Phase 2");
  assertEquals(rules!.requiredTasks[1].foreach, "AC[].count");
  assertEquals(rules!.requiredTasks[1].keywords, [
    "ac-checkpoint-implementation",
    "hybrid-triage-commit",
  ]);
});

/**
 * validateTaskMd - 必須タスクキーワードが全て存在する場合にパスすることを検証する。
 */
Deno.test("validateTaskMd passes when all required task keywords exist", () => {
  const rules = parseGuardBlock(SAMPLE_TEMPLATE_WITH_TASKS);
  const result = validateTaskMd(VALID_TASK_WITH_KEYWORDS, rules!, 2);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

/**
 * validateTaskMd - 必須タスクキーワードが欠落している場合にエラーが報告されることを検証する。
 */
Deno.test("validateTaskMd reports missing required task keyword", () => {
  const rules = parseGuardBlock(SAMPLE_TEMPLATE_WITH_TASKS);
  const missing = VALID_TASK_WITH_KEYWORDS.replace("develop-environment-setup", "removed");
  const result = validateTaskMd(missing, rules!, 2);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("develop-environment-setup")), true);
});

/**
 * countACs - 計画ファイルから AC 件数を正しくカウントすることを検証する。
 */
Deno.test("countACs counts AC entries correctly", () => {
  const plan = `## AC
- [ ] **[AC-1]**: First criterion
- [ ] **[AC-2]**: Second criterion
- [ ] **[AC-3]**: Third criterion
`;
  assertEquals(countACs(plan), 3);
});

/**
 * countACs - AC が存在しない計画ファイルでは 0 を返すことを検証する。
 */
Deno.test("countACs returns 0 when no AC entries exist", () => {
  const plan = `## No AC here
- just a normal task
`;
  assertEquals(countACs(plan), 0);
});

/**
 * validateTaskMd - Foreach 指定時に AC 数より少ないキーワード出現でエラーになることを検証する。
 */
Deno.test("validateTaskMd fails when keyword count is less than Foreach required count", () => {
  const rules = parseGuardBlock(SAMPLE_TEMPLATE_WITH_TASKS);
  // Phase 2 has 2 ACs required (planACCount=2) but only 1 keyword occurrence
  const insufficient = VALID_TASK_WITH_KEYWORDS.replace(
    "### Phase 2: ACベースの開発\n\n- [ ] ac-checkpoint-implementation (AC-1)\n- [ ] hybrid-triage-commit (wip)\n- [ ] ac-checkpoint-implementation (AC-2)\n- [ ] hybrid-triage-commit (wip)",
    "### Phase 2: ACベースの開発\n\n- [ ] ac-checkpoint-implementation (only one)\n- [ ] hybrid-triage-commit (wip)",
  );
  const result = validateTaskMd(insufficient, rules!, 2);
  assertEquals(result.valid, false);
});

// --- hasGuardBlock ---

/**
 * hasGuardBlock - GUARD ブロックが存在する場合に true を返すことを検証する。
 */
Deno.test("hasGuardBlock detects GUARD block", () => {
  const content = `# Test
<!--
GUARD:REQUIRED_H2
- Some header
-->
Some content`;
  assertEquals(hasGuardBlock(content), true);
});

/**
 * hasGuardBlock - GUARD ブロックが存在しない場合に false を返すことを検証する。
 */
Deno.test("hasGuardBlock returns false when no GUARD block", () => {
  const content = `# Test
No guard block here`;
  assertEquals(hasGuardBlock(content), false);
});

/**
 * hasGuardBlock - 通常の HTML コメント（GUARD: を含まない）では false を返すことを検証する。
 */
Deno.test("hasGuardBlock ignores non-GUARD HTML comments", () => {
  const content = `# Test
<!-- This is a normal comment -->
Some content`;
  assertEquals(hasGuardBlock(content), false);
});

// --- validateTaskMd GUARD block detection ---

const GUARD_BLOCK_TASK = `# Task Tracking: Bad Task

<!--
GUARD:REQUIRED_H2
- 📊 セッションメトリクス & 予実管理
-->

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 1 回
- **計画後見積 (想定介入回数)**: 1 回
- **完了時実績**: 0

## 📋 実行タスク一覧

### Phase 1: 準備

- [ ] task item
`;

/**
 * validateTaskMd - GUARD ブロックを含む task.md がエラーとなることを検証する。
 */
Deno.test("validateTaskMd fails when GUARD block exists in task.md", () => {
  const result = validateTaskMd(GUARD_BLOCK_TASK);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("GUARD block")), true);
});

/**
 * validateTaskMd - GUARD ブロックを含まない正常な task.md が引き続きパスすることを検証する（回帰）。
 */
Deno.test("validateTaskMd passes for clean task.md (regression)", () => {
  const result = validateTaskMd(VALID_TASK);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

// --- checkInterventionHistory ---

const TASK_WITH_INTERVENTIONS = `# Task

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 1 回
- **計画後見積 (想定介入回数)**: 1 回
- **完了時実績**: 2

### 💬 介入履歴

| # | フェーズ | 種別 | 内容 |
| - | ------- | ---- | ---- |
| 1 | 計画立案〜承認 | 意図誤認 | 設計判断の誤認による対象ファイル追加 |
`;

const TASK_WITH_ZERO_ACTUAL = `# Task

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 1 回
- **計画後見積 (想定介入回数)**: 1 回
- **完了時実績**: 0

### 💬 介入履歴

<!-- 介入なし -->
`;

const TASK_NO_INTERVENTIONS_WITH_ACTUAL = `# Task

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 1 回
- **計画後見積 (想定介入回数)**: 1 回
- **完了時実績**: 1

### 💬 介入履歴と理由

<!-- POからの明示的な方針変更・軌道修正指示があった場合のみ追記 -->
`;

const TASK_NO_HISTORY_SECTION = `# Task

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 1 回
- **計画後見積 (想定介入回数)**: 1 回
- **完了時実績**: 2
`;

const TASK_NON_NUMERIC_ACTUAL = `# Task

## 📊 セッションメトリクス & 予実管理

### ⏳ 見積もりと実績

- **計画前見積 (想定介入回数)**: 1 回
- **計画後見積 (想定介入回数)**: 1 回
- **完了時実績**: N/A
`;

/**
 * checkInterventionHistory - 完了時実績=0 の場合に警告を出さないことを検証する。
 */
Deno.test("checkInterventionHistory returns null when actual is 0", () => {
  const result = checkInterventionHistory(TASK_WITH_ZERO_ACTUAL);
  assertEquals(result, null);
});

/**
 * checkInterventionHistory - 完了時実績>0 かつ介入履歴ありの場合に警告を出さないことを検証する。
 */
Deno.test("checkInterventionHistory returns null when interventions exist", () => {
  const result = checkInterventionHistory(TASK_WITH_INTERVENTIONS);
  assertEquals(result, null);
});

/**
 * checkInterventionHistory - 完了時実績>0 かつ介入履歴なしの場合に警告メッセージを返すことを検証する。
 */
Deno.test("checkInterventionHistory returns warning when actual > 0 but no entries", () => {
  const result = checkInterventionHistory(TASK_NO_INTERVENTIONS_WITH_ACTUAL);
  assertEquals(typeof result, "string");
  assertEquals(result!.includes("WARNING"), true);
});

/**
 * checkInterventionHistory - 介入履歴セクションが存在しない場合も警告を返すことを検証する。
 */
Deno.test("checkInterventionHistory returns warning when history section missing", () => {
  const result = checkInterventionHistory(TASK_NO_HISTORY_SECTION);
  assertEquals(typeof result, "string");
  assertEquals(result!.includes("WARNING"), true);
});

/**
 * checkInterventionHistory - 完了時実績が非数値の場合に警告を出さないことを検証する（安全側）。
 */
Deno.test("checkInterventionHistory returns null for non-numeric actual value", () => {
  const result = checkInterventionHistory(TASK_NON_NUMERIC_ACTUAL);
  assertEquals(result, null);
});
