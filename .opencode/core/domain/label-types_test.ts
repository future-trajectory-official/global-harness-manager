import { assertEquals, assertNotStrictEquals } from "@std/assert";
import { getAllLabelDefinitions, LabelTypes } from "./label-types.ts";

Deno.test("LabelTypes - 全エントリが name を持つ", () => {
  for (const [key, def] of Object.entries(LabelTypes)) {
    assertEquals(typeof def.name, "string", `${key}.name should be string`);
    assertEquals(def.name.startsWith("type:"), true, `${key}.name should start with 'type:'`);
  }
});

Deno.test("LabelTypes - 全エントリが color を持つ", () => {
  for (const [key, def] of Object.entries(LabelTypes)) {
    assertEquals(typeof def.color, "string", `${key}.color should be string`);
    assertEquals(/^#[0-9a-fA-F]{6}$/.test(def.color), true, `${key}.color should be hex`);
  }
});

Deno.test("LabelTypes - 全エントリが description を持つ", () => {
  for (const [key, def] of Object.entries(LabelTypes)) {
    assertEquals(typeof def.description, "string", `${key}.description should be string`);
    assertEquals(def.description.length > 0, true, `${key}.description should not be empty`);
  }
});

Deno.test("LabelTypes - 全ラベル名が一意", () => {
  const names = Object.values(LabelTypes).map((d) => d.name);
  assertEquals(new Set(names).size, names.length);
});

Deno.test("getAllLabelDefinitions - 全エントリを配列として取得できる", () => {
  const defs = getAllLabelDefinitions();
  assertEquals(defs.length, Object.keys(LabelTypes).length);
  for (const def of defs) {
    assertEquals(typeof def.name, "string");
    assertEquals(typeof def.color, "string");
    assertEquals(typeof def.description, "string");
  }
});

Deno.test("getAllLabelDefinitions - 返り値は元のオブジェクトと別インスタンス", () => {
  const defs = getAllLabelDefinitions();
  assertNotStrictEquals(defs, Object.values(LabelTypes));
});
