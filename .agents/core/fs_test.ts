import { assertEquals } from "@std/assert";
import { fsUtil, pathUtil } from "./fs.ts";
import { join } from "@std/path";

Deno.test("pathUtil.resolvePath - should resolve paths correctly", () => {
  const current = Deno.cwd();
  assertEquals(pathUtil.resolvePath("test.txt"), join(current, "test.txt"));
});

Deno.test("pathUtil.expandHome - should expand ~/", () => {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
  assertEquals(pathUtil.expandHome("~/test"), join(home, "test"));
  assertEquals(pathUtil.expandHome("/abs/path"), "/abs/path");
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
