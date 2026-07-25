/**
 * ユースケース: validateHarnessConfig がスキーマに従った検証を正しく行うこと
 * 検証意図: 正常系・異常系の全パターンを網羅する
 */

import { assertEquals } from "@std/assert";
import { validateHarnessConfig } from "./validate-harnessrc.ts";

const validConfig = {
  version: "1",
  projects: { productBacklog: 8, sprintBoard: 9 },
  milestone: { template: "Sprint {number}" },
  issueTemplate: { path: ".github/ISSUE_TEMPLATE/pbi.md" },
  customFields: {
    type: "harness-type",
    size: "harness-size",
    status: "harness-status",
    sequence: "harness-sequence",
    effort: "harness-effort",
  },
  "harness-type": {
    options: ["Epic", "Feature", "PBI", "WP", "Review", "Reflection"],
  },
};

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["version", "projects", "customFields", "harness-type"],
  properties: {
    version: { type: "string", enum: ["1"] },
    projects: {
      type: "object",
      properties: {
        productBacklog: { type: "number" },
        sprintBoard: { type: "number" },
      },
      required: ["productBacklog", "sprintBoard"],
      additionalProperties: false,
    },
    customFields: {
      type: "object",
      properties: {
        type: { type: "string" },
        size: { type: "string" },
        status: { type: "string" },
        sequence: { type: "string" },
        effort: { type: "string" },
      },
      required: ["type", "size", "status", "sequence", "effort"],
      additionalProperties: false,
    },
    "harness-type": {
      type: "object",
      properties: {
        options: {
          type: "array",
          items: {
            type: "string",
            enum: ["Epic", "Feature", "PBI", "WP", "Review", "Reflection"],
          },
          minItems: 6,
          uniqueItems: true,
        },
      },
      required: ["options"],
      additionalProperties: false,
    },
    milestone: {
      type: "object",
      properties: { template: { type: "string" } },
      required: ["template"],
      additionalProperties: false,
    },
    issueTemplate: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

Deno.test("AC-3: 有効な設定に対して valid: true を返す", () => {
  const result = validateHarnessConfig(validConfig, schema);
  assertEquals(result.valid, true);
  assertEquals(result.errors, []);
});

Deno.test("AC-3: version フィールドが欠損しているとエラーを返す", () => {
  const { version: _, ...withoutVersion } = validConfig;
  const result = validateHarnessConfig(withoutVersion, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-3: projects フィールドが欠損しているとエラーを返す", () => {
  const { projects: _, ...withoutProjects } = validConfig;
  const result = validateHarnessConfig(withoutProjects, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-3: customFields フィールドが欠損しているとエラーを返す", () => {
  const { customFields: _, ...withoutCustomFields } = validConfig;
  const result = validateHarnessConfig(withoutCustomFields, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-3: harness-type フィールドが欠損しているとエラーを返す", () => {
  const { "harness-type": _, ...withoutHarnessType } = validConfig;
  const result = validateHarnessConfig(withoutHarnessType, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-3: 空オブジェクトは複数の必須フィールド欠損エラーを返す", () => {
  const result = validateHarnessConfig({}, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-3: 未定義の additionalProperties を含むとエラーを返す", () => {
  const configWithExtra = { ...validConfig, unknownField: "should be rejected" };
  const result = validateHarnessConfig(configWithExtra, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-4: harness-type.options に定義外の値を含むとエラーを返す", () => {
  const configWithInvalidType = {
    ...validConfig,
    "harness-type": {
      options: ["Epic", "Feature", "INVALID_TYPE", "WP", "Review", "Reflection"],
    },
  };
  const result = validateHarnessConfig(configWithInvalidType, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-4: version に不正な値を指定するとエラーを返す", () => {
  const configWithInvalidVersion = { ...validConfig, version: "2" };
  const result = validateHarnessConfig(configWithInvalidVersion, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-4: projects.productBacklog に文字列を指定するとエラーを返す", () => {
  const configWithWrongType = {
    ...validConfig,
    projects: { productBacklog: "eight", sprintBoard: 9 },
  };
  const result = validateHarnessConfig(configWithWrongType, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});

Deno.test("AC-4: customFields の必須フィールドが欠損しているとエラーを返す", () => {
  const configWithMissingCustomField = {
    ...validConfig,
    customFields: {
      type: "harness-type",
      size: "harness-size",
      status: "harness-status",
      sequence: "harness-sequence",
    },
  };
  const result = validateHarnessConfig(configWithMissingCustomField, schema);
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
});
