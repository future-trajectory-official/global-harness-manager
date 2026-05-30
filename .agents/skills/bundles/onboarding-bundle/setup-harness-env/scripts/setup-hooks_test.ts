import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { fsUtil } from "../../../../../core/fs.ts";
import { setupGitHooks } from "./setup-hooks.ts";

Deno.test("setup-hooks - should create pre-push hook in target directory", async () => {
  const tempDir = await Deno.makeTempDir();
  const gitDir = join(tempDir, ".git");
  const hooksDir = join(gitDir, "hooks");
  await Deno.mkdir(hooksDir, { recursive: true });

  try {
    // 実行（テスト用に gitDir を指定可能にする）
    await setupGitHooks({ gitDir });

    const prePushPath = join(hooksDir, "pre-push");
    assertEquals(await fsUtil.exists(prePushPath), true);

    const content = await Deno.readTextFile(prePushPath);
    assertStringIncludes(content, "#!/bin/sh");
    assertStringIncludes(content, "deno task qa:cov");

    // pre-commit フックも生成されていることを確認
    const preCommitPath = join(hooksDir, "pre-commit");
    assertEquals(await fsUtil.exists(preCommitPath), true);
    const preCommitContent = await Deno.readTextFile(preCommitPath);
    assertStringIncludes(preCommitContent, "#!/bin/sh");
    assertStringIncludes(preCommitContent, "deno fmt --check");
    assertStringIncludes(preCommitContent, "deno lint");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("setup-hooks - should fail if .git directory does not exist", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    let errorCaught = false;
    try {
      await setupGitHooks({ gitDir: join(tempDir, ".git") });
    } catch (_e) {
      errorCaught = true;
    }
    assertEquals(errorCaught, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
