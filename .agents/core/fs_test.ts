import { assertEquals } from "@std/assert";
import { fsUtil, pathUtil } from "./fs.ts";
import { dirname, join } from "@std/path";
import { zipSync } from "fflate";

Deno.test("pathUtil.resolvePath - should resolve paths correctly", () => {
  const current = Deno.cwd();
  assertEquals(pathUtil.resolvePath("test.txt"), join(current, "test.txt"));
});

Deno.test("pathUtil.expandHome - should expand ~/", () => {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  assertEquals(pathUtil.expandHome("~/test"), join(home, "test"));
  assertEquals(pathUtil.expandHome("/abs/path"), "/abs/path");
});

Deno.test("pathUtil.resolvePath - should handle cross-platform slashes gracefully", () => {
  const current = Deno.cwd();
  // We use Deno's native behavior to normalize paths, so we test if backslashes are handled correctly based on OS.
  // Actually, `@std/path` normalize does different things on win32 vs posix.
  // Let's ensure it does not throw and produces a predictable path.
  const pathWithBackslash = "folder\\subfolder\\file.txt";
  const resolved = pathUtil.resolvePath(pathWithBackslash);
  // It shouldn't crash, and should start with current dir.
  assertEquals(
    resolved.startsWith(current) || resolved.startsWith(current.replace(/\//g, "\\")),
    true,
  );
});

Deno.test("fsUtil.exists - should detect file existence", async () => {
  const tempFile = await Deno.makeTempFile();
  try {
    assertEquals(await fsUtil.exists(tempFile), true);
    assertEquals(await fsUtil.exists(tempFile + ".nonexistent"), false);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("fsUtil.readTextFile - should throw error for non-existent file", async () => {
  let threw = false;
  try {
    await fsUtil.readTextFile("/path/to/very/non/existent/file.txt");
  } catch (e) {
    threw = true;
    assertEquals(e instanceof Deno.errors.NotFound, true);
  }
  assertEquals(threw, true);
});

Deno.test("fsUtil.writeTextFile - should throw error for read-only directory or invalid path", async () => {
  let threw = false;
  try {
    // Cannot write to an invalid path like a directory that doesn't exist
    await fsUtil.writeTextFile("/path/to/very/non/existent/dir/file.txt", "content");
  } catch (e) {
    threw = true;
    assertEquals(
      e instanceof Deno.errors.NotFound || e instanceof Deno.errors.PermissionDenied,
      true,
    );
  }
  assertEquals(threw, true);
});

Deno.test("fsUtil.read/writeTextFile - should work as expected", async () => {
  const tempFile = await Deno.makeTempFile();
  const content = "Hello Deno World";
  try {
    await fsUtil.writeTextFile(tempFile, content);
    assertEquals(await fsUtil.readTextFile(tempFile), content);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("fsUtil.copy - should copy files and directories recursively", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const src = join(tempDir, "src");
    const dest = join(tempDir, "dest");
    await Deno.mkdir(join(src, "subdir"), { recursive: true });
    await Deno.writeTextFile(join(src, "file.txt"), "hello");
    await Deno.writeTextFile(join(src, "subdir", "sub.txt"), "world");

    await fsUtil.copy(src, dest);

    assertEquals(await Deno.readTextFile(join(dest, "file.txt")), "hello");
    assertEquals(await Deno.readTextFile(join(dest, "subdir", "sub.txt")), "world");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("fsUtil.move - should move files", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const src = join(tempDir, "src.txt");
    const dest = join(tempDir, "dest.txt");
    await Deno.writeTextFile(src, "move me");

    await fsUtil.move(src, dest);

    assertEquals(await fsUtil.exists(src), false);
    assertEquals(await Deno.readTextFile(dest), "move me");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("fsUtil.move - should fallback to copy/remove when EXDEV occurs", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const src = join(tempDir, "src.txt");
    const dest = join(tempDir, "dest.txt");
    await Deno.writeTextFile(src, "fallback me");

    // Deno.rename の代わりに EXDEV エラーを投げるフェイク関数を渡す
    const fakeRename = () => {
      throw new Error("EXDEV: cross-device link or rename");
    };

    await fsUtil.move(src, dest, { rename: fakeRename });

    assertEquals(await fsUtil.exists(src), false); // 元ファイルは削除されているはず
    assertEquals(await Deno.readTextFile(dest), "fallback me"); // 先にコピーされているはず
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("fsUtil.mkdir - should create directories recursively", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const nested = join(tempDir, "a", "b", "c");
    await fsUtil.mkdir(nested, { recursive: true });
    const stat = await Deno.stat(nested);
    assertEquals(stat.isDirectory, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("fsUtil.remove - should remove files and directories", async () => {
  const tempFile = await Deno.makeTempFile();
  const tempDir = await Deno.makeTempDir();
  try {
    await fsUtil.remove(tempFile);
    assertEquals(await fsUtil.exists(tempFile), false);

    await fsUtil.remove(tempDir);
    assertEquals(await fsUtil.exists(tempDir), false);
  } finally {
    // ensure cleanup
    try { await Deno.remove(tempFile); } catch { /* ignore */ }
    try { await Deno.remove(tempDir); } catch { /* ignore */ }
  }
});

Deno.test("fsUtil.writeTextFile - should not write when dryRun is true", async () => {
  const tempFile = join(await Deno.makeTempDir(), "dryrun.txt");
  try {
    await fsUtil.writeTextFile(tempFile, "secret", true);
    assertEquals(await fsUtil.exists(tempFile), false);
  } finally {
    try { await Deno.remove(dirname(tempFile), { recursive: true }); } catch { /* ignore */ }
  }
});

Deno.test("fsUtil.extract - should extract zip files", async () => {
  const tempDir = await Deno.makeTempDir();
  const zipFile = join(tempDir, "test.zip");
  const extractDest = join(tempDir, "out");

  // fflate を使用してテスト用 zip データを作成
  const zipData = zipSync({
    "file1.txt": new TextEncoder().encode("hello zip"),
    "dir/file2.txt": new TextEncoder().encode("world zip"),
  });
  await Deno.writeFile(zipFile, zipData);

  try {
    await fsUtil.extract(zipFile, extractDest);
    assertEquals(await Deno.readTextFile(join(extractDest, "file1.txt")), "hello zip");
    assertEquals(await Deno.readTextFile(join(extractDest, "dir", "file2.txt")), "world zip");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("fsUtil.extract - should extract tar.gz files with stripComponents", async () => {
  const tempDir = await Deno.makeTempDir();
  const tarFile = join(tempDir, "test.tar.gz");
  const extractDest = join(tempDir, "out");
  await Deno.mkdir(extractDest);

  try {
    // テスト用の tar.gz を作成（外部コマンドを使用）
    const sourceDir = join(tempDir, "source", "nested");
    await Deno.mkdir(sourceDir, { recursive: true });
    await Deno.writeTextFile(join(sourceDir, "content.txt"), "tar content");
    
    const command = new Deno.Command("tar", {
      args: ["-czf", tarFile, "-C", join(tempDir, "source"), "nested"],
    });
    await command.output();

    // 展開の実行 (stripComponents: 1 により 'nested/' を飛ばす)
    await fsUtil.extract(tarFile, extractDest, { stripComponents: 1 });
    
    assertEquals(await Deno.readTextFile(join(extractDest, "content.txt")), "tar content");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("fsUtil.extract - should cleanup destination on failure", async () => {
  const tempDir = await Deno.makeTempDir();
  const corruptedZip = join(tempDir, "broken.zip");
  const extractDest = join(tempDir, "out");
  await Deno.writeTextFile(corruptedZip, "not a zip content");

  try {
    let errorCaught = false;
    try {
      await fsUtil.extract(corruptedZip, extractDest);
    } catch (_e) {
      errorCaught = true;
    }
    assertEquals(errorCaught, true);
    
    // 展開先ディレクトリが「存在しない」か「空である」ことを確認
    const destExists = await fsUtil.exists(extractDest);
    if (destExists) {
      const entries = [];
      for await (const entry of Deno.readDir(extractDest)) {
        entries.push(entry);
      }
      assertEquals(entries.length, 0, "Destination should be empty on failure");
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
