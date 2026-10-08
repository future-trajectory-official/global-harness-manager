/**
 * link-boards モジュールのテスト。
 *
 * gh 呼出は LinkGhRunner のモックで差し替える。実 gh は呼ばない。
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
  formatLinkPlan,
  linkBoards,
  type LinkGhRunner,
  parseLinkedProjectsJson,
  planLinks,
} from "./link-boards.ts";

const BOARDS = { productBacklog: 10, sprintBoard: 11, retrospectiveBoard: 12 };

Deno.test("parseLinkedProjectsJson: GraphQL 出力からプロジェクト番号を抽出する", () => {
  const raw = JSON.stringify({
    data: { repository: { projectsV2: { nodes: [{ number: 10 }, { number: 11 }] } } },
  });
  assertEquals(parseLinkedProjectsJson(raw), [10, 11]);
});

Deno.test("parseLinkedProjectsJson: リンクなしは空配列", () => {
  const raw = JSON.stringify({ data: { repository: { projectsV2: { nodes: [] } } } });
  assertEquals(parseLinkedProjectsJson(raw), []);
});

Deno.test("parseLinkedProjectsJson: 不正JSONと想定外形式は Error", () => {
  assertThrows(() => parseLinkedProjectsJson("not json"), Error, "JSON 形式が不正");
  assertThrows(() => parseLinkedProjectsJson("{}"), Error, "projectsV2.nodes");
});

Deno.test("planLinks: 未リンクは toLink、リンク済みは skip", () => {
  const plan = planLinks(BOARDS, [11]);
  assertEquals(plan.toLink, [10, 12]);
  assertEquals(plan.skip, [11]);
});

Deno.test("planLinks: 番号0（未確定）は対象外、重複は1件に集約", () => {
  const plan = planLinks({ productBacklog: 10, sprintBoard: 10, retrospectiveBoard: 0 }, []);
  assertEquals(plan.toLink, [10]);
  assertEquals(plan.skip, []);
});

Deno.test("linkBoards: 未リンクのみリンクし、既存リンクは再実行しない（冪等）", async () => {
  const calls: string[] = [];
  const runner: LinkGhRunner = {
    listLinked: () => Promise.resolve([10]),
    link: (owner, number, repo) => {
      calls.push(`${owner}:${number}:${repo}`);
      return Promise.resolve();
    },
  };
  const plan = await linkBoards(
    "purple-ocean-ego",
    "purple-ocean-ego/comfyui-local-ops",
    BOARDS,
    runner,
  );
  assertEquals(calls, [
    "purple-ocean-ego:11:purple-ocean-ego/comfyui-local-ops",
    "purple-ocean-ego:12:purple-ocean-ego/comfyui-local-ops",
  ]);
  assertEquals(plan.skip, [10]);
});

Deno.test("linkBoards: 全件リンク済みなら link は呼ばれない", async () => {
  let linkCalls = 0;
  const runner: LinkGhRunner = {
    listLinked: () => Promise.resolve([10, 11, 12]),
    link: () => {
      linkCalls++;
      return Promise.resolve();
    },
  };
  await linkBoards("o", "o/r", BOARDS, runner);
  assertEquals(linkCalls, 0);
});

Deno.test("formatLinkPlan: 計画を人間向け行に変換する", () => {
  const lines = formatLinkPlan("o/r", { toLink: [10], skip: [11] });
  assertEquals(lines, [
    "link project #10 -> o/r",
    "skip project #11 (already linked to o/r)",
  ]);
});
