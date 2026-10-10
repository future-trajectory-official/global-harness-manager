/**
 * create-labels モジュールのテスト。
 *
 * gh 呼出は LabelGhRunner のモックで差し替える。実 gh は呼ばない。
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { getAllLabelDefinitions } from "../../../../../core/domain/label-types.ts";
import {
  buildLabelsPlan,
  dryRunLabels,
  ensureLabels,
  type LabelGhRunner,
  labelsToCreate,
  parseCreateLabelsArgs,
  parseLabelListJson,
} from "./create-labels.ts";

function mockRunner(
  existing: readonly string[],
  failOn: readonly string[] = [],
): { runner: LabelGhRunner; created: string[] } {
  const created: string[] = [];
  return {
    created,
    runner: {
      listLabels: () => Promise.resolve([...existing]),
      createLabel: (_repo, label) => {
        if (failOn.includes(label.name)) {
          return Promise.reject(new Error(`mock failure: ${label.name}`));
        }
        created.push(label.name);
        return Promise.resolve();
      },
    },
  };
}

Deno.test("labelsToCreate: 正の定義 getAllLabelDefinitions と同一である", () => {
  assertEquals(labelsToCreate(), getAllLabelDefinitions());
});

Deno.test("labelsToCreate: type:Vision を含む8件である", () => {
  const names = labelsToCreate().map((label) => label.name);
  assertEquals(names.length, 8);
  assert(names.includes("type:Vision"));
});

Deno.test("parseLabelListJson: gh label list の配列出力からラベル名を抽出する", () => {
  const raw = JSON.stringify([
    { name: "type:Vision", color: "5319e7", description: "d" },
    { name: "bug", color: "d73a4a", description: "b" },
  ]);
  assertEquals(parseLabelListJson(raw), ["type:Vision", "bug"]);
});

Deno.test("parseLabelListJson: 空配列は空配列", () => {
  assertEquals(parseLabelListJson("[]"), []);
});

Deno.test("parseLabelListJson: 不正JSON・配列外形式・名前なし要素", () => {
  assertThrows(() => parseLabelListJson("not json"), Error, "JSON 形式が不正");
  assertThrows(() => parseLabelListJson("{}"), Error, "配列ではありません");
  assertEquals(parseLabelListJson(JSON.stringify([{ color: "fff" }, { name: 1 }])), []);
});

Deno.test("buildLabelsPlan: 未存在は作成、既存はスキップ", () => {
  const plan = buildLabelsPlan(["type:Vision", "bug"]);
  assertEquals(plan.skipCount, 1);
  assertEquals(plan.createCount, 7);
  assertEquals(plan.toCreate.map((label) => label.name).includes("type:Vision"), false);
  assert(plan.lines.some((line) => line === 'skip "type:Vision"'));
  assert(plan.lines.some((line) => line === 'create "type:PBI"'));
});

Deno.test("buildLabelsPlan: 全件既存は全スキップ", () => {
  const all = labelsToCreate().map((label) => label.name);
  const plan = buildLabelsPlan(all);
  assertEquals(plan.skipCount, 8);
  assertEquals(plan.createCount, 0);
});

Deno.test("ensureLabels: 不足分のみ作成する（冪等）", async () => {
  const { runner, created } = mockRunner(["type:Vision"]);
  const result = await ensureLabels("owner/repo", runner);
  assertEquals(result.skipped, ["type:Vision"]);
  assertEquals(result.created.length, 7);
  assertEquals(created.length, 7);
  assertEquals(result.failed, []);
});

Deno.test("ensureLabels: 失敗分は failed に集約し続行する", async () => {
  const { runner } = mockRunner([], ["type:PBI"]);
  const result = await ensureLabels("owner/repo", runner);
  assertEquals(result.created.length, 7);
  assertEquals(result.failed.length, 1);
  assertEquals(result.failed[0].label, "type:PBI");
});

Deno.test("dryRunLabels: 作成呼出なしで計画表示する", async () => {
  const { runner, created } = mockRunner([]);
  const output = await dryRunLabels("owner/repo", runner);
  assert(output.includes("[DRY-RUN] repo: owner/repo"));
  assert(output.includes("スキップ0件・作成8件"));
  assertEquals(created, []);
});

Deno.test("parseCreateLabelsArgs: --repo/--dry-run の解析と余剰位置引数・--owner の拒否", () => {
  const opts = parseCreateLabelsArgs(["--repo", "owner/repo", "--dry-run"]);
  assertEquals(opts.repo, "owner/repo");
  assertEquals(opts.dryRun, true);
  assertThrows(
    () => parseCreateLabelsArgs(["--repo", "owner/repo", "extra"]),
    Error,
    "余剰の位置引数",
  );
  assertThrows(
    () => parseCreateLabelsArgs(["--repo", "owner/repo", "--owner", "owner"]),
    Error,
    "--owner はサポートしていません",
  );
});
