import { assertEquals } from "@std/assert";
import { VALID } from "./entity-validator.ts";
import { reviewValidator } from "./review-validator.ts";
import type { ReviewData } from "./types.ts";

function makeReviewData(overrides?: Partial<ReviewData>): ReviewData {
  return {
    identifier: {
      scope: { owner: "my-org", repository: "my-repo" },
      title: { value: "Sprint 15 Review" },
      id: "review-1",
      describe: () => ({ summary: "describe", steps: [] }),
    },
    statement: { environment: "staging" },
    sprint: {
      scope: { owner: "my-org", repository: "my-repo" },
      title: { value: "Sprint 15" },
      id: "sprint-15",
      describe: () => ({ summary: "describe", steps: [] }),
    },
    plannedAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "pass" }],
      },
    ],
    state: "open",
    ...overrides,
  };
}

// ======== plan ========

Deno.test("ReviewValidator - plan should always be VALID", () => {
  const from = makeReviewData();
  const result = reviewValidator.validate("plan", from, from);
  assertEquals(result, VALID);
});

// ======== revise ========

Deno.test("ReviewValidator - revise should be VALID for open state with no changes", () => {
  const from = makeReviewData();
  const to = makeReviewData();
  const result = reviewValidator.validate("revise", from, to);
  assertEquals(result, VALID);
});

Deno.test("ReviewValidator - revise should be VALID when adding new ACs", () => {
  const from = makeReviewData();
  const to = makeReviewData({
    plannedAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [
          { number: "1", description: "AC1", judgment: "pass" },
          { number: "2", description: "AC2", judgment: "unchecked" },
        ],
      },
    ],
  });
  const result = reviewValidator.validate("revise", from, to);
  assertEquals(result, VALID);
});

Deno.test("ReviewValidator - revise should be VALID when logically deleting AC (judgment=removed)", () => {
  const from = makeReviewData();
  const to = makeReviewData({
    plannedAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [
          { number: "1", description: "AC1", judgment: "removed" },
        ],
      },
    ],
  });
  const result = reviewValidator.validate("revise", from, to);
  assertEquals(result, VALID);
});

Deno.test("ReviewValidator - revise should be INVALID for closed state", () => {
  const from = makeReviewData({ state: "closed" });
  const to = makeReviewData({ state: "closed" });
  const result = reviewValidator.validate("revise", from, to);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "編集はopen状態のReviewのみ可能です");
});

Deno.test("ReviewValidator - revise should be INVALID when AC group is removed entirely", () => {
  const from = makeReviewData();
  const to = makeReviewData({ plannedAcGroups: [] });
  const result = reviewValidator.validate("revise", from, to);
  assertEquals(result.valid, false);
  assertEquals(
    result.errors[0],
    "PBI#1 WP#1 のACグループが削除されています。論理削除(judgment=removed)のみ許可されます",
  );
});

Deno.test("ReviewValidator - revise should be INVALID when AC description is changed", () => {
  const from = makeReviewData();
  const to = makeReviewData({
    plannedAcGroups: [{
      pbiNumber: 1,
      wpNumber: "1",
      acJudgments: [{ number: "1", description: "Modified AC1", judgment: "pass" }],
    }],
  });
  const result = reviewValidator.validate("revise", from, to);
  assertEquals(result.valid, false);
});

// ======== report ========

Deno.test("ReviewValidator - report should be VALID when all judgments are set", () => {
  const from = makeReviewData({ postPlanAcGroups: undefined });
  const to = makeReviewData({
    plannedAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "pass" }],
      },
    ],
    postPlanAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "pass" }],
      },
    ],
  });
  const result = reviewValidator.validate("report", from, to);
  assertEquals(result, VALID);
});

Deno.test("ReviewValidator - report should be VALID when postPlanAcGroups is null and from also null", () => {
  const from = makeReviewData({ postPlanAcGroups: undefined });
  const to = makeReviewData({
    plannedAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "pass" }],
      },
    ],
    postPlanAcGroups: undefined,
  });
  const result = reviewValidator.validate("report", from, to);
  assertEquals(result, VALID);
});

Deno.test("ReviewValidator - report should be INVALID for closed state", () => {
  const from = makeReviewData({ state: "closed" });
  const to = makeReviewData();
  const result = reviewValidator.validate("report", from, to);
  assertEquals(result.valid, false);
});

Deno.test("ReviewValidator - report should be INVALID when plannedAcGroups is empty", () => {
  const from = makeReviewData();
  const to = makeReviewData({ plannedAcGroups: [] });
  const result = reviewValidator.validate("report", from, to);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "報告には少なくとも1つのplannedAcGroupが必要です");
});

Deno.test("ReviewValidator - report should be INVALID when plannedAcGroups has unchecked", () => {
  const from = makeReviewData();
  const to = makeReviewData({
    plannedAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "unchecked" }],
      },
    ],
  });
  const result = reviewValidator.validate("report", from, to);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "plannedAcGroupsにuncheckedの判定が含まれています");
});

Deno.test("ReviewValidator - report should be INVALID when postPlanAcGroups has unchecked", () => {
  const from = makeReviewData({ postPlanAcGroups: undefined });
  const to = makeReviewData({
    postPlanAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "unchecked" }],
      },
    ],
  });
  const result = reviewValidator.validate("report", from, to);
  assertEquals(result.valid, false);
});

Deno.test("ReviewValidator - report should be INVALID when from has postPlanAcGroups but to sets null", () => {
  const from = makeReviewData({
    postPlanAcGroups: [
      {
        pbiNumber: 1,
        wpNumber: "1",
        acJudgments: [{ number: "1", description: "AC1", judgment: "pass" }],
      },
    ],
  });
  const to = makeReviewData({ postPlanAcGroups: undefined });
  const result = reviewValidator.validate("report", from, to);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "一度設定されたpostPlanAcGroupsをnullに戻せません");
});

// ======== archive ========

Deno.test("ReviewValidator - archive should be VALID for open state with overallResult", () => {
  const from = makeReviewData({ overallResult: { judgment: "pass", reason: "OK" } });
  const result = reviewValidator.validate("archive", from, from);
  assertEquals(result, VALID);
});

Deno.test("ReviewValidator - archive should be INVALID for closed state", () => {
  const from = makeReviewData({
    state: "closed",
    overallResult: { judgment: "pass", reason: "OK" },
  });
  const result = reviewValidator.validate("archive", from, from);
  assertEquals(result.valid, false);
});

Deno.test("ReviewValidator - archive should be INVALID without overallResult", () => {
  const from = makeReviewData({ overallResult: undefined });
  const result = reviewValidator.validate("archive", from, from);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "overallResultが未設定のReviewはアーカイブできません");
});

// ======== find / search ========

Deno.test("ReviewValidator - find should always be VALID", () => {
  const from = makeReviewData();
  const result = reviewValidator.validate("find", from, from);
  assertEquals(result, VALID);
});

Deno.test("ReviewValidator - search should always be VALID", () => {
  const from = makeReviewData();
  const result = reviewValidator.validate("search", from, from);
  assertEquals(result, VALID);
});

// ======== unknown operation ========

Deno.test("ReviewValidator - unknown operation should return VALID with warning", () => {
  const from = makeReviewData();
  const result = reviewValidator.validate("unknownOp" as never, from, from);
  assertEquals(result, VALID);
});
