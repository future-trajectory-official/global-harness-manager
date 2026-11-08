import { assertEquals, assertThrows } from "@std/assert";
import { pbiId, wpId } from "../../../../../core/domain/types.ts";
import type {
  AcceptanceCriterias,
  WorkPackageStatement,
} from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { applyAcceptanceCriteriaDone } from "../../../../../core/gateway/plan-gateway-adapter.ts";

/** 生成本文に現れるエビデンス行の書式（`references/body-structure.md` の正に合わせる）。 */
const EVIDENCE_LINE_PLACEHOLDER = "  - エビデンス: （未記入）";

function makeStatement(
  acItems: Array<{
    number: string;
    description: string;
    judgment?: "unchecked" | "pass" | "conditional" | "fail" | "removed";
    evidence?: string;
  }>,
): WorkPackageStatement {
  const acceptanceCriteria: AcceptanceCriterias = {
    items: acItems.map((ac) => ({
      number: ac.number,
      description: ac.description,
      judgment: ac.judgment ?? ("unchecked" as const),
      ...(ac.evidence === undefined ? {} : { evidence: ac.evidence }),
    })),
  };
  return { acceptanceCriteria };
}

/**
 * ユースケース: WP を新規作成する
 * 検証意図: Plan の summary と WorkPackage の define ステップが組み立てられること
 */
Deno.test("define_wp - should generate define plan", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  assertEquals(plan.summary, "Define WP: My WP");
  assertEquals(plan.steps[1].entity, "WorkPackage");
  assertEquals(plan.steps[1].operation, "define");
});

/**
 * ユースケース: 親 PBI 配下に WP を作成する
 * 検証意図: 親 PBI のコードが params.parentPbi へ引き継がれること
 */
Deno.test("define_wp - should include parentPbi in params", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI", "node-id-pbi", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  assertEquals(plan.steps[1].params.parentPbi, "42");
});

/**
 * ユースケース: タイトルが空のまま WP を作成しようとする
 * 検証意図: INVALID_INPUT で拒否されること
 */
Deno.test("define_wp - should throw for empty title", () => {
  const identifier = wpId("");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  assertThrows(
    () => workPackageUseCase.define(identifier, statement, parentPbi),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * ユースケース: 受入基準なしで WP を作成しようとする
 * 検証意図: INVALID_INPUT で拒否されること
 */
Deno.test("define_wp - should throw for empty acItems", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  assertThrows(
    () => workPackageUseCase.define(identifier, statement, parentPbi),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * ユースケース: 親 PBI の id が無いまま WP を作成しようとする
 * 検証意図: INVALID_INPUT で拒否されること
 */
Deno.test("define_wp - should throw for parentPbi without id", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "1", description: "Do something" }]);
  const parentPbi = pbiId("Parent PBI");
  assertThrows(
    () => workPackageUseCase.define(identifier, statement, parentPbi),
    Error,
    "INVALID_INPUT",
  );
});

/**
 * ユースケース: 複数の受入基準を持つ WP を作成する
 * 検証意図: 本文が「AC 行＋その直下にネストしたエビデンス行」の形式で、AC の順序どおりに
 *           生成されること（完全一致）
 */
Deno.test("define_wp - should handle multiple acItems", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([
    { number: "1", description: "First AC" },
    { number: "2", description: "Second AC" },
  ]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  assertEquals(
    plan.steps[1].params.body,
    "## Acceptance Criteria\n\n" +
      "- [ ] AC1: First AC\n" +
      `${EVIDENCE_LINE_PLACEHOLDER}\n` +
      "- [ ] AC2: Second AC\n" +
      EVIDENCE_LINE_PLACEHOLDER,
  );
});

/**
 * ユースケース: 受入基準が 1 件だけの WP を作成する
 * 検証意図: 本文末尾がエビデンス行で終わり（末尾改行を余分に付けず）、AC 行の直下に置かれること
 */
Deno.test("define_wp - should end with an evidence line for a single AC", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "1", description: "Only AC" }]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  const body = String(plan.steps[1].params.body);

  assertEquals(body, `## Acceptance Criteria\n\n- [ ] AC1: Only AC\n${EVIDENCE_LINE_PLACEHOLDER}`);
  assertEquals(body.endsWith("\n"), false);
});

/**
 * ユースケース: 番号を省略した受入基準（`AC: 内容`）を持つ WP を作成する
 * 検証意図: 番号省略形式でもエビデンス行が直下に付き、本番パーサが出現順で採番すること
 */
Deno.test("define_wp - should support AC entries without a number", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([{ number: "", description: "No number" }]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  const body = String(plan.steps[1].params.body);

  assertEquals(
    body,
    `## Acceptance Criteria\n\n- [ ] AC: No number\n${EVIDENCE_LINE_PLACEHOLDER}`,
  );
  const parsed = applyAcceptanceCriteriaDone(body);
  assertEquals(parsed.total, 1);
  assertEquals(parsed.updated, [1]);
});

/**
 * ユースケース: 既に判定・エビデンスを持つ受入基準で本文を生成する（WP 改訂経路）
 * 検証意図: `judgment: "pass"` が `[x]` に、`evidence` の値がエビデンス行に反映され、
 *           未設定ならプレースホルダになること
 */
Deno.test("define_wp - should reflect judgment and evidence of the statement", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([
    { number: "1", description: "First AC", judgment: "pass", evidence: "deno task qa → exit 0" },
    { number: "2", description: "Second AC" },
  ]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);

  assertEquals(
    plan.steps[1].params.body,
    "## Acceptance Criteria\n\n" +
      "- [x] AC1: First AC\n" +
      "  - エビデンス: deno task qa → exit 0\n" +
      "- [ ] AC2: Second AC\n" +
      EVIDENCE_LINE_PLACEHOLDER,
  );
});

/**
 * ユースケース: 生成した WP 本文を後続の AC 完了判定（`complete-work-package`）が解釈する
 * 検証意図: 本番パーサ（`applyAcceptanceCriteriaDone`）で AC 行数が AC 件数と一致し、
 *           エビデンス行が ✅化の対象にならずバイト単位で保持されること
 */
Deno.test("define_wp - should not be parsed with evidence lines as AC lines", () => {
  const identifier = wpId("My WP");
  const statement = makeStatement([
    { number: "1", description: "First AC" },
    { number: "2", description: "Second AC" },
    { number: "3", description: "Third AC" },
  ]);
  const parentPbi = pbiId("Parent PBI", "node-id", "42");
  const plan = workPackageUseCase.define(identifier, statement, parentPbi);
  const body = String(plan.steps[1].params.body);

  const all = applyAcceptanceCriteriaDone(body);
  assertEquals(all.total, 3);
  assertEquals(all.updated, [1, 2, 3]);

  const onlySecond = applyAcceptanceCriteriaDone(body, [2]);
  assertEquals(onlySecond.total, 3);
  assertEquals(onlySecond.body, body.replace("- [ ] AC2: Second AC", "- [x] AC2: Second AC"));
});
