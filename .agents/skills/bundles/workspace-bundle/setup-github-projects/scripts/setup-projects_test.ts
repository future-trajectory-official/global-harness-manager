import { assertEquals, assertStringIncludes } from "@std/assert";
import { parseOwner, parseRepoFromConfig } from "./setup-projects.ts";

Deno.test({
  name: "parseRepoFromConfig - 正常系",
  fn() {
    const content = `# config

## test
- **Repository**: \`git@github.com:owner/my-repo.git\`
- **Local Path**: ~/test
`;
    const path = Deno.makeTempFileSync();
    Deno.writeTextFileSync(path, content);
    const result = parseRepoFromConfig(path);
    assertEquals(result, "owner/my-repo");
    Deno.removeSync(path);
  },
});

Deno.test({
  name: "parseRepoFromConfig - Repository行がない場合はエラー",
  fn() {
    const content = `# config\nnothing here\n`;
    const path = Deno.makeTempFileSync();
    Deno.writeTextFileSync(path, content);
    try {
      parseRepoFromConfig(path);
      throw new Error("期待されたエラーが発生しませんでした");
    } catch (e) {
      assertStringIncludes(
        (e as Error).message,
        "config/identities.md からリポジトリ情報を取得できませんでした",
      );
    }
    Deno.removeSync(path);
  },
});

Deno.test({
  name: "parseRepoFromConfig - 空ファイルはエラー",
  fn() {
    const path = Deno.makeTempFileSync();
    try {
      parseRepoFromConfig(path);
      throw new Error("期待されたエラーが発生しませんでした");
    } catch (e) {
      assertStringIncludes((e as Error).message, "取得できませんでした");
    }
    Deno.removeSync(path);
  },
});

Deno.test({
  name: "parseOwner - owner/repo から owner を抽出",
  fn() {
    assertEquals(
      parseOwner("future-trajectory-official/global-harness-manager"),
      "future-trajectory-official",
    );
  },
});

Deno.test({
  name: "parseOwner - 単一セグメントの owner",
  fn() {
    assertEquals(parseOwner("foo/bar"), "foo");
  },
});
