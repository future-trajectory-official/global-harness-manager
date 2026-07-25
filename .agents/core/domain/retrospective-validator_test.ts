import { assertEquals } from "@std/assert";
import { VALID } from "./entity-validator.ts";
import { retrospectiveValidator } from "./retrospective-validator.ts";
import type { RetrospectiveData } from "./types.ts";

function makeRetroData(overrides?: Partial<RetrospectiveData>): RetrospectiveData {
  return {
    identifier: {
      scope: { owner: "my-org", repository: "my-repo" },
      title: { value: "Sprint 15 Retrospective" },
      id: "retro-1",
      describe: () => ({ summary: "describe", steps: [] }),
    },
    sprint: {
      scope: { owner: "my-org", repository: "my-repo" },
      title: { value: "Sprint 15" },
      id: "sprint-15",
      describe: () => ({ summary: "describe", steps: [] }),
    },
    kpta: {
      keep: "Good communication",
      problem: "Context loss",
      try: "Document decisions",
      advise: "Use ADR",
    },
    metrics: {
      goalAchievementRate: 80,
      estimationAccuracy: 75,
      qualityIntegrity: 90,
      collaborationDiscipline: 85,
      velocity: 6,
    },
    state: "open",
    ...overrides,
  };
}

// ======== plan ========

Deno.test("RetroValidator - plan should always be VALID", () => {
  const from = makeRetroData();
  const result = retrospectiveValidator.validate("plan", from, from);
  assertEquals(result, VALID);
});

// ======== execute ========

Deno.test("RetroValidator - execute should be VALID for open state", () => {
  const from = makeRetroData();
  const result = retrospectiveValidator.validate("execute", from, from);
  assertEquals(result, VALID);
});

Deno.test("RetroValidator - execute should be INVALID for closed state", () => {
  const from = makeRetroData({ state: "closed" });
  const result = retrospectiveValidator.validate("execute", from, from);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "実行はopen状態のRetrospectiveのみ可能です");
});

// ======== archive ========

Deno.test("RetroValidator - archive should be VALID for open state with kpta and metrics", () => {
  const from = makeRetroData();
  const result = retrospectiveValidator.validate("archive", from, from);
  assertEquals(result, VALID);
});

Deno.test("RetroValidator - archive should be INVALID for closed state", () => {
  const from = makeRetroData({ state: "closed" });
  const result = retrospectiveValidator.validate("archive", from, from);
  assertEquals(result.valid, false);
});

Deno.test("RetroValidator - archive should be INVALID without kpta", () => {
  const from = makeRetroData({ kpta: undefined });
  const result = retrospectiveValidator.validate("archive", from, from);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "KPTAが未設定のRetrospectiveはアーカイブできません");
});

Deno.test("RetroValidator - archive should be INVALID without metrics", () => {
  const from = makeRetroData({ metrics: undefined });
  const result = retrospectiveValidator.validate("archive", from, from);
  assertEquals(result.valid, false);
  assertEquals(result.errors[0], "metricsが未設定のRetrospectiveはアーカイブできません");
});

// ======== find / search ========

Deno.test("RetroValidator - find should always be VALID", () => {
  const from = makeRetroData();
  const result = retrospectiveValidator.validate("find", from, from);
  assertEquals(result, VALID);
});

Deno.test("RetroValidator - search should always be VALID", () => {
  const from = makeRetroData();
  const result = retrospectiveValidator.validate("search", from, from);
  assertEquals(result, VALID);
});

// ======== unknown operation ========

Deno.test("RetroValidator - unknown operation should return VALID with warning", () => {
  const from = makeRetroData();
  const result = retrospectiveValidator.validate("unknownOp" as never, from, from);
  assertEquals(result, VALID);
});
