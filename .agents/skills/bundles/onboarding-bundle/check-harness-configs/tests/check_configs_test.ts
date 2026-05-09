import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkFiles } from "../scripts/check_configs.ts";

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

Deno.test("checkFiles - returns false when a file is missing", async () => {
  const tempDir = await Deno.makeTempDir();
  const files = ["exists.txt", "missing.md"];
  await Deno.writeTextFile(`${tempDir}/exists.txt`, "content");

  const result = await checkFiles(tempDir, files);
  assertEquals(result, false);

  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("checkFiles - returns false when a file is empty", async () => {
  const tempDir = await Deno.makeTempDir();
  const files = ["empty.txt"];
  await Deno.writeTextFile(`${tempDir}/empty.txt`, "");

  const result = await checkFiles(tempDir, files);
  assertEquals(result, false);

  await Deno.remove(tempDir, { recursive: true });
});
