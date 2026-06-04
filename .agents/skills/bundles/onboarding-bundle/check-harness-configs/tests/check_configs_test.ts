import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkFiles } from "../scripts/check_configs.ts";

/**
 * checkFiles - 全てのファイルが存在する場合に true を返すことを検証する。
 * 正常系として、指定されたファイル群が全て存在するケースを確認する。
 */
Deno.test("checkFiles - returns true when all files exist", async () => {
  const tempDir = await Deno.makeTempDir();
  const files = ["test1.txt", "test2.md"];
  for (const file of files) {
    await Deno.writeTextFile(`${tempDir}/${file}`, "content");
  }

  const result = await checkFiles(tempDir, files);
  assertEquals(result, true);

  await Deno.remove(tempDir, { recursive: true });
});

/**
 * checkFiles - ファイルが1つでも欠落している場合に false を返すことを検証する。
 * 異常系として、存在しないファイルを含むリストでのチェック結果を確認する。
 */
Deno.test("checkFiles - returns false when a file is missing", async () => {
  const tempDir = await Deno.makeTempDir();
  const files = ["exists.txt", "missing.md"];
  await Deno.writeTextFile(`${tempDir}/exists.txt`, "content");

  const result = await checkFiles(tempDir, files);
  assertEquals(result, false);

  await Deno.remove(tempDir, { recursive: true });
});

/**
 * checkFiles - ファイルが空の場合に false を返すことを検証する。
 * 空ファイルを正常に検出し、設定不備として報告されることを確認する。
 */
Deno.test("checkFiles - returns false when a file is empty", async () => {
  const tempDir = await Deno.makeTempDir();
  const files = ["empty.txt"];
  await Deno.writeTextFile(`${tempDir}/empty.txt`, "");

  const result = await checkFiles(tempDir, files);
  assertEquals(result, false);

  await Deno.remove(tempDir, { recursive: true });
});
