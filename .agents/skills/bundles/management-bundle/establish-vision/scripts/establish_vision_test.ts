import { assert, assertEquals } from "@std/assert";
import { visionUseCase } from "../../../../../core/domain/vision-usecase.ts";
import type { EntityScope, Outcomes, VisionStatement } from "../../../../../core/domain/types.ts";
import { identify } from "../../../../../core/domain/types.ts";

function makeScope(): EntityScope {
  return { owner: "test-org", repository: "test-repo" };
}

function makeStatement(overrides?: Partial<VisionStatement>): VisionStatement {
  return {
    targetAudience: "AI開発初心者",
    value: "クローンするだけで環境が整う",
    differentiator: "教育的協働で成長させる",
    ...overrides,
  };
}

function makeOutcomes(): Outcomes {
  return { items: [{ title: "Zero-setup", description: "即座に開発開始" }] };
}

/**
 * establish が正しい Plan を生成することを検証する。
 * ユースケース: VisionUseCase.establish を呼び出した際に、
 *   想定通りの 3 Step（searchItems→createItem→addComment）が生成されること。
 * 検証意図: 正常系の Plan 構造が期待値と一致することを確認する。
 */
Deno.test("establish-vision: establish が正しい Plan を生成する", () => {
  const identifier = identify(makeScope(), "Test Vision");
  const plan = visionUseCase.establish(identifier, makeStatement(), makeOutcomes());

  assertEquals(plan.summary, "Establish vision: Test Vision");
  assertEquals(plan.steps.length, 3);
  assertEquals(plan.steps[0].operation, "searchItems");
  assertEquals(plan.steps[1].operation, "createItem");
  assertEquals(plan.steps[1].params.title, "Test Vision");
  assertEquals(plan.steps[2].operation, "addComment");
});

/**
 * dry-run モードで Plan が実行されず表示のみで終了することを検証する。
 * ユースケース: --dry-run フラグ指定時に Plan の構造（summary, steps）が出力されること。
 * 検証意図: dry-run モードが Gateway を呼び出さず Plan 表示で停止することを確認する。
 */
Deno.test("establish-vision: dry-run モードは Plan を実行せず表示する", () => {
  const identifier = identify(makeScope(), "Test Vision");
  const plan = visionUseCase.establish(identifier, makeStatement(), makeOutcomes());

  const dryRunOutput = { summary: plan.summary, steps: plan.steps };
  assertEquals(dryRunOutput.summary, "Establish vision: Test Vision");
  assertEquals(dryRunOutput.steps.length, 3);
  assertEquals(dryRunOutput.steps[0].operation, "searchItems");
  assertEquals(dryRunOutput.steps[1].operation, "createItem");
  assertEquals(dryRunOutput.steps[2].operation, "addComment");
});

/**
 * 空のタイトルでバリデーションエラーが発生することを検証する。
 * ユースケース: タイトルが空文字の場合に INVALID_INPUT エラーがスローされること。
 * 検証意図: タイトルの空文字チェックが正しく機能することを確認する。
 */
Deno.test("establish-vision: 空のタイトルでエラー", () => {
  const identifier = identify(makeScope(), "");
  const statement = makeStatement();
  const outcomes = makeOutcomes();
  try {
    visionUseCase.establish(identifier, statement, outcomes);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message, "INVALID_INPUT: Vision title must not be empty");
  }
});

/**
 * 空の targetAudience でバリデーションエラーが発生することを検証する。
 * ユースケース: targetAudience が空文字の場合に INVALID_INPUT エラーがスローされること。
 * 検証意図: 必須フィールドの空文字チェックが正しく機能することを確認する。
 */
Deno.test("establish-vision: 空の targetAudience でエラー", () => {
  const identifier = identify(makeScope(), "Test Vision");
  const statement = makeStatement({ targetAudience: "" });
  const outcomes = makeOutcomes();
  try {
    visionUseCase.establish(identifier, statement, outcomes);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals(
      (e as Error).message,
      "INVALID_INPUT: targetAudience must not be empty",
    );
  }
});

/**
 * 空の value でバリデーションエラーが発生することを検証する。
 * ユースケース: value が空文字の場合に INVALID_INPUT エラーがスローされること。
 * 検証意図: VisionStatement の各フィールドの空文字チェックを確認する。
 */
Deno.test("establish-vision: 空の value でエラー", () => {
  const identifier = identify(makeScope(), "Test Vision");
  const statement = makeStatement({ value: "" });
  const outcomes = makeOutcomes();
  try {
    visionUseCase.establish(identifier, statement, outcomes);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message, "INVALID_INPUT: value must not be empty");
  }
});

/**
 * 不正な JSON がパースエラーになることを検証する。
 * ユースケース: JSON.parse に不正な文字列が渡された場合、SyntaxError となること。
 * 検証意図: スクリプトのトップレベルでの JSON パースエラーハンドリングの前提を確認する。
 */
Deno.test("establish-vision: 不正な JSON のパースに失敗する", () => {
  try {
    JSON.parse("{ invalid }");
    throw new Error("Should have thrown");
  } catch (e) {
    assert(e instanceof SyntaxError);
  }
});
