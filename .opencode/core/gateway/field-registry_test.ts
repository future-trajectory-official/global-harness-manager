/**
 * ユースケース: field-registry が全 harness-* フィールド名とボード識別子を型付き定数として提供すること
 * 検証意図: 定義された定数が設計spec 5.3 のレジストリ（正）と整合し、名前解決・整合性の入口となることを確認する
 */
import { assertEquals, assertThrows } from "@std/assert";
import {
  BOARD_FIELDS,
  BOARDS,
  FIELD,
  fieldRef,
  HARNESS_FIELDS,
  isFieldOnBoard,
} from "./field-registry.ts";

Deno.test("field-registry: HARNESS_FIELDS に全実フィールド名が定義されている", () => {
  const expected = [
    "harness-size-estimate",
    "harness-size-actual",
    "harness-effort-summary",
    "harness-variance-review-size",
    "harness-variance-review-planning",
    "harness-variance-review-execution",
    "harness-improvement-suggestions",
    "harness-metrics-summary",
    "harness-metrics-intent-alignment",
    "harness-metrics-constraint-adherence",
    "harness-metrics-context-extraction",
    "harness-metrics-work-size-stability",
    "harness-metrics-goal-achievement",
    "harness-metrics-estimation-accuracy",
    "harness-metrics-quality-integrity",
    "harness-metrics-collaboration-discipline",
    "harness-metrics-velocity",
    "harness-kpt-keep",
    "harness-kpt-problem",
    "harness-kpt-try",
    "harness-kpt-advise",
    "harness-sequence",
  ];
  for (const f of expected) {
    assertEquals(
      (HARNESS_FIELDS as readonly string[]).includes(f),
      true,
      `field ${f} should be defined`,
    );
  }
});

Deno.test("field-registry: フィールド名は全て harness- プレフィックスを持つ", () => {
  for (const f of HARNESS_FIELDS) {
    assertEquals(f.startsWith("harness-"), true, `${f} should start with harness-`);
  }
});

Deno.test("field-registry: ボード識別子が .harnessrc projects キーと一致する", () => {
  assertEquals(BOARDS.productBacklog, "productBacklog");
  assertEquals(BOARDS.sprintBoard, "sprintBoard");
  assertEquals(BOARDS.retrospectiveBoard, "retrospectiveBoard");
});

/**
 * ユースケース: FIELD 名前付き定数の全値が HARNESS_FIELDS（正のレジストリ）に含まれること
 * 検証意図: ハンドラーが FIELD.xxx で参照する値が、正のレジストリから外れていないことを保証する
 */
Deno.test("field-registry: FIELD の全値が HARNESS_FIELDS に含まれる", () => {
  const registry = HARNESS_FIELDS as readonly string[];
  for (const [key, value] of Object.entries(FIELD)) {
    assertEquals(
      registry.includes(value),
      true,
      `FIELD.${key}="${value}" should be in HARNESS_FIELDS`,
    );
  }
});

/**
 * ユースケース: 各フィールドが設計spec 5.3 の通り正しいボード（BOARD_FIELDS）に所属すること
 * 検証意図: 同名フィールドでもボードで区別されること、fieldRef/isFieldOnBoard が整合を保証することを確認する
 */
Deno.test("field-registry: 設計spec 5.3 のボード別フィールド対応が正しい", () => {
  const pbFields = BOARD_FIELDS.productBacklog as readonly string[];
  const spFields = BOARD_FIELDS.sprintBoard as readonly string[];
  const rtFields = BOARD_FIELDS.retrospectiveBoard as readonly string[];
  // Product Backlog Board の期待フィールド
  assertEquals(pbFields.includes("harness-size-estimate"), true);
  assertEquals(
    pbFields.includes("harness-metrics-summary"),
    false,
    "metrics-summary is not on productBacklog",
  );
  // Sprint Board と Retrospective Board の同名フィールドは別物として扱える
  assertEquals(spFields.includes("harness-metrics-summary"), true);
  assertEquals(rtFields.includes("harness-metrics-summary"), true);
  assertEquals(
    spFields.includes("harness-metrics-velocity"),
    false,
    "velocity is retrospective-only",
  );
  assertEquals(rtFields.includes("harness-metrics-velocity"), true);
});

/**
 * ユースケース: fieldRef がボードとフィールドの対応を検証して FieldRef を返すこと
 * 検証意図: 正しい対応は成功し、誤った対応（ボードに存在しないフィールド）は投げることを確認する
 */
Deno.test("field-registry: fieldRef は正しい対応のみ許可する", () => {
  const ref = fieldRef("productBacklog", FIELD.sizeEstimate);
  assertEquals(ref.boardKey, "productBacklog");
  assertEquals(ref.fieldName, "harness-size-estimate");

  assertThrows(() => fieldRef("productBacklog", FIELD.metricsVelocity));
});

/**
 * ユースケース: isFieldOnBoard が所属判定を正しく行うこと
 * 検証意図: 同名フィールドのボード別所属を判定できることを確認する
 */
Deno.test("field-registry: isFieldOnBoard がボード所属を判定する", () => {
  assertEquals(isFieldOnBoard("sprintBoard", FIELD.metricsSummary), true);
  assertEquals(isFieldOnBoard("retrospectiveBoard", FIELD.metricsSummary), true);
  assertEquals(isFieldOnBoard("productBacklog", FIELD.metricsSummary), false);
});

/**
 * ユースケース: フィールド集合の整合（単一源泉の担保）
 * 検証意図: ①全ボードのフィールドが HARNESS_FIELDS（正のレジストリ）に含まれること
 *          ②HARNESS_FIELDS の全フィールドがいずれかのボードに属すること
 *          を検証し、3表現（HARNESS_FIELDS / FIELD / BOARD_FIELDS）の乖離を防ぐ
 */
Deno.test("field-registry: BOARD_FIELDS の全値が HARNESS_FIELDS に含まれる", () => {
  const registry = HARNESS_FIELDS as readonly string[];
  for (const board of Object.keys(BOARD_FIELDS) as Array<keyof typeof BOARD_FIELDS>) {
    for (const field of BOARD_FIELDS[board] as readonly string[]) {
      assertEquals(
        registry.includes(field),
        true,
        `field "${field}" on board "${board}" should be in HARNESS_FIELDS`,
      );
    }
  }
});

Deno.test("field-registry: HARNESS_FIELDS の全フィールドがいずれかのボードに属する", () => {
  const allBoardFields = new Set<string>();
  for (const board of Object.keys(BOARD_FIELDS) as Array<keyof typeof BOARD_FIELDS>) {
    for (const field of BOARD_FIELDS[board] as readonly string[]) {
      allBoardFields.add(field);
    }
  }
  for (const field of HARNESS_FIELDS) {
    assertEquals(
      allBoardFields.has(field),
      true,
      `field "${field}" should belong to at least one board`,
    );
  }
});
