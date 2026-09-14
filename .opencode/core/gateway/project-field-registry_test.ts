/**
 * ユースケース: ProjectV2FieldRegistry シングルトンが .harnessrc からボード番号とフィールド名を解決すること
 * 検証意図: projects（ボード番号）と fields（フィールド名）を読み取り、型付きで提供する
 *          `load()` は fields を HARNESS_FIELDS（正）と整合することを検証し、`field()` は
 *          正のレジストリと .harnessrc fields 双方への登録を検証する。reset() でテスト間を隔離する。
 */
import { assertEquals, assertThrows } from "@std/assert";
import { ProjectV2FieldRegistry } from "./project-field-registry.ts";
import { HARNESS_FIELDS } from "./field-registry.ts";

const ALL_FIELDS = Object.fromEntries(HARNESS_FIELDS.map((f) => [f, f]));

function fresh(): ProjectV2FieldRegistry {
  const reg = ProjectV2FieldRegistry.getInstance();
  reg.reset();
  return reg;
}

Deno.test("project-field-registry: getInstance は単一インスタンスを返す", () => {
  const a = ProjectV2FieldRegistry.getInstance();
  const b = ProjectV2FieldRegistry.getInstance();
  assertEquals(a, b);
});

Deno.test("project-field-registry: load 後にボード番号を解決できる", () => {
  const reg = fresh();
  reg.load({
    projects: { productBacklog: 10, sprintBoard: 11, retrospectiveBoard: 12 },
    fields: ALL_FIELDS,
  });
  assertEquals(reg.board("productBacklog"), 10);
  assertEquals(reg.board("sprintBoard"), 11);
  assertEquals(reg.board("retrospectiveBoard"), 12);
});

Deno.test("project-field-registry: fields を読み、field 名を解決できる", () => {
  const reg = fresh();
  reg.load({ projects: { productBacklog: 10 }, fields: ALL_FIELDS });
  assertEquals(reg.field("harness-size-estimate"), "harness-size-estimate");
});

Deno.test("project-field-registry: field が HARNESS_FIELDS にない場合は throw する", () => {
  const reg = fresh();
  reg.load({ projects: { productBacklog: 10 }, fields: ALL_FIELDS });
  assertThrows(() => reg.field("not-a-harness-field"));
});

Deno.test("project-field-registry: fields に未知フィールドがあると load が throw する", () => {
  const reg = fresh();
  assertThrows(() =>
    reg.load({
      projects: { productBacklog: 10 },
      fields: { ...ALL_FIELDS, "harness-unknown": "harness-unknown" },
    })
  );
});

Deno.test("project-field-registry: 未設定のボードは undefined を返す", () => {
  const reg = fresh();
  reg.load({ projects: { productBacklog: 10 }, fields: ALL_FIELDS });
  assertEquals(reg.board("sprintBoard"), undefined);
});

Deno.test("project-field-registry: 未ロード（初期化失敗）時は undefined/false 扱い", () => {
  const reg = fresh();
  reg.load({ fields: ALL_FIELDS });
  assertEquals(reg.board("productBacklog"), undefined);
  assertEquals(reg.isConfigured(), false);
});

Deno.test("project-field-registry: 初期化済みなら isConfigured は true", () => {
  const reg = fresh();
  reg.load({ projects: { productBacklog: 10 }, fields: ALL_FIELDS });
  assertEquals(reg.isConfigured(), true);
});

Deno.test("project-field-registry: reset で状態が初期化される", () => {
  const reg = fresh();
  reg.load({ projects: { productBacklog: 10 }, fields: ALL_FIELDS });
  assertEquals(reg.board("productBacklog"), 10);
  reg.reset();
  assertEquals(reg.board("productBacklog"), undefined);
  assertEquals(reg.isConfigured(), false);
});
