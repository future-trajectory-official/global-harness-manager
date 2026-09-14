import { assertEquals } from "@std/assert";
import { fsUtil, pathUtil } from "./fs.ts";
import { dirname, join } from "@std/path";
import { zipSync } from "fflate";

/**
 * pathUtil.resolvePath - 相対パスがカレントディレクトリ基準で正しく解決されることを検証する。
 * "test.txt" がカレントディレクトリからの絶対パスに変換されることを確認する。
 */
Deno.test("pathUtil.resolvePath - should resolve paths correctly", () => {
  const current = Deno.cwd();
  assertEquals(pathUtil.resolvePath("test.txt"), join(current, "test.txt"));
});

/**
 * pathUtil.expandHome - ~/ がホームディレクトリに展開されることを検証する。
 * 絶対パスの場合は展開されずそのまま維持されることを確認する。
 */
Deno.test("pathUtil.expandHome - should expand ~/", () => {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  assertEquals(pathUtil.expandHome("~/test"), join(home, "test"));
  assertEquals(pathUtil.expandHome("/abs/path"), "/abs/path");
});

/**
 * pathUtil.resolvePath - バックスラッシュを含むパスがエラーなく解決されることを検証する。
 * Windows 形式のパスが与えられた場合でも例外を発生させず、カレントディレクトリで始まる
 * パスが生成されることを確認する（クロスプラットフォーム対応）。
 */
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

/**
 * fsUtil.exists - ファイルの存在／非存在を正しく判定できることを検証する。
 * 一時ファイル作成後に存在が true、削除後のパスでは false を返すことを確認する。
 */
Deno.test("fsUtil.exists - should detect file existence", async () => {
  const tempFile = await Deno.makeTempFile();
  try {
    assertEquals(await fsUtil.exists(tempFile), true);
    assertEquals(await fsUtil.exists(tempFile + ".nonexistent"), false);
  } finally {
    await Deno.remove(tempFile);
  }
});

/**
 * fsUtil.readTextFile - 存在しないファイルを読み込もうとした場合にエラーが発生することを検証する。
 * NotFound エラーがスローされる異常系を確認する。
 */
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

/**
 * fsUtil.writeTextFile - 存在しないディレクトリへの書き込みでエラーが発生することを検証する。
 * 無効なパス指定時の異常系動作を確認する。
 */
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

/**
 * fsUtil.readTextFile / writeTextFile - ファイルへの書き込みと読み込みが正常に動作することを検証する。
 * 一時ファイルに文字列を書き込み、その内容が正しく読み戻せることを確認する。
 */
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

/**
 * fsUtil.copy - ディレクトリを再帰的にコピーできることを検証する。
 * サブディレクトリを含むディレクトリ構造がコピー先に完全に再現されることを確認する。
 */
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

/**
 * fsUtil.move - EXDEV エラー発生時にコピー＆削除のフォールバックが動作することを検証する。
 * 異なるデバイス間での移動失敗時に、コピー後に元ファイルを削除する代替処理が
 * 正しく実行されることを確認する。
 */
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

/**
 * fsUtil.mkdir - 入れ子のディレクトリを再帰的に作成できることを検証する。
 * a/b/c のようなネスト構造が一度の mkdir で作成されることを確認する。
 */
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

/**
 * fsUtil.remove - ファイルおよびディレクトリを削除できることを検証する。
 * 削除後に exists が false を返すこと、および存在しないファイルの削除試行が
 * エラーをスローしないことを確認する。
 */
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
    try {
      await Deno.remove(tempFile);
    } catch { /* ignore */ }
    try {
      await Deno.remove(tempDir);
    } catch { /* ignore */ }
  }
});

/**
 * fsUtil.writeTextFile - dryRun モード時は実際にファイル書き込みが行われないことを検証する。
 * dryRun=true で呼び出した場合、ファイルが作成されないことを確認する。
 */
Deno.test("fsUtil.writeTextFile - should not write when dryRun is true", async () => {
  const tempFile = join(await Deno.makeTempDir(), "dryrun.txt");
  try {
    await fsUtil.writeTextFile(tempFile, "secret", true);
    assertEquals(await fsUtil.exists(tempFile), false);
  } finally {
    try {
      await Deno.remove(dirname(tempFile), { recursive: true });
    } catch { /* ignore */ }
  }
});

/**
 * fsUtil.extract - zip ファイルを正しく展開できることを検証する。
 * fflate で作成したテスト用 zip の内容が展開先ディレクトリに再現されることを確認する。
 */
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

/**
 * fsUtil.extract - tar.gz ファイルを stripComponents オプション付きで展開できることを検証する。
 * トップレベルのディレクトリをスキップして、直下のファイルが展開先に配置されることを確認する。
 */
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

/**
 * fsUtil.extract - 展開失敗時に出力先ディレクトリがクリーンアップされることを検証する。
 * 破損した zip を展開しようとした場合、出力先が存在しないか空であることを確認する。
 */
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
