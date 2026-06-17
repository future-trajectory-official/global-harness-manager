import { assertEquals, assertStringIncludes } from "@std/assert";
import { loadLabelDefs } from "./setup-labels.ts";

const YAML_PATH = new URL("../references/label-definitions.yaml", import.meta.url).pathname;

Deno.test({
  name: "loadLabelDefs - 11種のラベルが定義されている",
  async fn() {
    const defs = await loadLabelDefs(YAML_PATH);
    assertEquals(defs.labels.length, 15);
  },
});

Deno.test({
  name: "loadLabelDefs - 全ラベルに name, color, description が存在する",
  async fn() {
    const defs = await loadLabelDefs(YAML_PATH);
    for (const label of defs.labels) {
      assertEquals(typeof label.name, "string");
      assertEquals(label.name.length > 0, true);
      assertEquals(typeof label.color, "string");
      assertEquals(label.color.length > 0, true);
      assertEquals(typeof label.description, "string");
      assertEquals(label.description.length > 0, true);
    }
  },
});

Deno.test({
  name: "loadLabelDefs - type:PBI と type:WP が定義されている",
  async fn() {
    const defs = await loadLabelDefs(YAML_PATH);
    const names = defs.labels.map((l) => l.name);
    assertEquals(names.includes("type:PBI"), true);
    assertEquals(names.includes("type:WP"), true);
  },
});

Deno.test({
  name: "loadLabelDefs - status:IDEA/TODO/WIP/DONE が定義されている",
  async fn() {
    const defs = await loadLabelDefs(YAML_PATH);
    const names = defs.labels.map((l) => l.name);
    for (const s of ["IDEA", "TODO", "WIP", "DONE"]) {
      assertEquals(names.includes(`status:${s}`), true);
    }
  },
});

Deno.test({
  name: "loadLabelDefs - size:XS/S/M/L/XL が定義されている",
  async fn() {
    const defs = await loadLabelDefs(YAML_PATH);
    const names = defs.labels.map((l) => l.name);
    for (const s of ["XS", "S", "M", "L", "XL"]) {
      assertEquals(names.includes(`size:${s}`), true);
    }
  },
});

Deno.test({
  name: "loadLabelDefs - ラベル名の命名規則が Key小文字:Value大文字 に沿っている",
  async fn() {
    const defs = await loadLabelDefs(YAML_PATH);
    const pascalAllowed = ["Epic", "Feature", "Review", "Reflection"];
    for (const label of defs.labels) {
      const parts = label.name.split(":");
      assertEquals(parts.length, 2);
      assertEquals(parts[0], parts[0].toLowerCase(), `Keyは小文字: ${label.name}`);
      if (!pascalAllowed.includes(parts[1])) {
        assertEquals(parts[1], parts[1].toUpperCase(), `Valueは大文字: ${label.name}`);
      }
    }
  },
});

Deno.test({
  name: "loadLabelDefs - カラーコードは6桁の16進数",
  async fn() {
    const defs = await loadLabelDefs(YAML_PATH);
    for (const label of defs.labels) {
      assertEquals(label.color.length, 6, `${label.name}: ${label.color}`);
      assertEquals(/^[0-9a-f]{6}$/i.test(label.color), true, `${label.name}: ${label.color}`);
    }
  },
});

Deno.test({
  name: "loadLabelDefs - 存在しないファイルはエラー",
  async fn() {
    try {
      await loadLabelDefs("/nonexistent/path.yaml");
      throw new Error("期待されたエラーが発生しませんでした");
    } catch (e) {
      assertStringIncludes((e as Error).message, "No such file");
    }
  },
});
