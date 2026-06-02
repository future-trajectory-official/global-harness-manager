import { assertEquals } from "@std/assert";
import { classifyFileType, suggestTypeFromFiles, validateTypeConsistency } from "./git-triage.ts";

interface StagedFile {
  path: string;
  status: string;
}

const mkFile = (path: string, status = "M"): StagedFile => ({ path, status });

Deno.test("classifyFileType - source files", () => {
  assertEquals(classifyFileType("src/main.ts"), "source");
  assertEquals(classifyFileType("lib/utils.ts"), "source");
});

Deno.test("classifyFileType - test files", () => {
  assertEquals(classifyFileType("src/main_test.ts"), "test");
  assertEquals(classifyFileType("lib/utils_test.ts"), "test");
});

Deno.test("classifyFileType - doc files", () => {
  assertEquals(classifyFileType("README.md"), "docs");
  assertEquals(classifyFileType("docs/guide.md"), "docs");
});

Deno.test("classifyFileType - config files", () => {
  assertEquals(classifyFileType("deno.json"), "config");
  assertEquals(classifyFileType(".vscode/settings.json"), "config");
  assertEquals(classifyFileType("tsconfig.jsonc"), "config");
});

Deno.test("classifyFileType - other files", () => {
  assertEquals(classifyFileType("Makefile"), "other");
  assertEquals(classifyFileType("Dockerfile"), "other");
});

Deno.test("suggestTypeFromFiles - all test files suggests test", () => {
  const result = suggestTypeFromFiles([
    mkFile("src/main_test.ts"),
    mkFile("lib/utils_test.ts"),
  ]);
  assertEquals(result, "test");
});

Deno.test("suggestTypeFromFiles - all doc files suggests docs", () => {
  const result = suggestTypeFromFiles([
    mkFile("README.md"),
    mkFile("docs/guide.md"),
  ]);
  assertEquals(result, "docs");
});

Deno.test("suggestTypeFromFiles - all config files suggests chore", () => {
  const result = suggestTypeFromFiles([
    mkFile("deno.json"),
    mkFile("tsconfig.jsonc"),
  ]);
  assertEquals(result, "chore");
});

Deno.test("suggestTypeFromFiles - all source files suggests feat", () => {
  const result = suggestTypeFromFiles([
    mkFile("src/main.ts"),
    mkFile("lib/utils.ts"),
  ]);
  assertEquals(result, "feat");
});

Deno.test("suggestTypeFromFiles - mixed files returns null", () => {
  const result = suggestTypeFromFiles([
    mkFile("src/main.ts"),
    mkFile("README.md"),
  ]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - valid type passes", () => {
  const result = validateTypeConsistency("feat", [mkFile("src/main.ts")]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - invalid type returns error", () => {
  const result = validateTypeConsistency("invalid", [mkFile("src/main.ts")]);
  assertEquals(
    result,
    'invalid conventional commit type: "invalid". Valid types: feat, fix, docs, style, refactor, test, chore',
  );
});

Deno.test("validateTypeConsistency - docs type with non-doc files warns", () => {
  const result = validateTypeConsistency("docs", [mkFile("src/main.ts")]);
  assertEquals(result, 'type is "docs" but 1 non-documentation files are included');
});

Deno.test("validateTypeConsistency - docs type with only md files passes", () => {
  const result = validateTypeConsistency("docs", [mkFile("README.md")]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - test type with non-test files warns", () => {
  const result = validateTypeConsistency("test", [mkFile("src/main.ts")]);
  assertEquals(result, 'type is "test" but 1 non-test files are included');
});

Deno.test("validateTypeConsistency - test type with test files passes", () => {
  const result = validateTypeConsistency("test", [mkFile("src/main_test.ts")]);
  assertEquals(result, null);
});

Deno.test("validateTypeConsistency - feat type with doc/config files warns", () => {
  const featResult = validateTypeConsistency("feat", [
    mkFile("src/main.ts"),
    mkFile("README.md"),
  ]);
  assertEquals(featResult, 'type is "feat" but includes documentation/config files: README.md');

  const fixResult = validateTypeConsistency("fix", [
    mkFile("src/main.ts"),
    mkFile("deno.json"),
  ]);
  assertEquals(fixResult, 'type is "fix" but includes documentation/config files: deno.json');
});
