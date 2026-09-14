import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";

import { installGh, normalizeBinDir, resolveBinDir } from "./setup.ts";
import { createIsolatedDeps, withEnv, withTempDir } from "./setup_test_helpers.ts";

/**
 * ユースケース: GLOBAL_HARNESS_BIN_DIR指定時にそのディレクトリへ解決されること
 * 検証意図: 従来変数の指定値が正規化されずそのまま返ること
 */
Deno.test("resolveBinDir - GLOBAL_HARNESS_BIN_DIR指定時はそのdirを返す", () => {
  withEnv(
    { GLOBAL_HARNESS_BIN_DIR: "/tmp/iso-global-bin", HARNESS_DISTRIBUTE_BIN_DIR: undefined },
    () => {
      assertEquals(resolveBinDir("/tmp/fake-root"), "/tmp/iso-global-bin");
    },
  );
});

/**
 * ユースケース: HARNESS_DISTRIBUTE_BIN_DIR指定時に配布先へ解決されること
 * 検証意図: 配布先変数の指定値がそのまま返ること
 */
Deno.test("resolveBinDir - HARNESS_DISTRIBUTE_BIN_DIR指定時はそのdirを返す", () => {
  withEnv(
    { GLOBAL_HARNESS_BIN_DIR: undefined, HARNESS_DISTRIBUTE_BIN_DIR: "/tmp/iso-dist-bin" },
    () => {
      assertEquals(resolveBinDir("/tmp/fake-root"), "/tmp/iso-dist-bin");
    },
  );
});

/**
 * ユースケース: 両変数未指定時に従来通り<root>/binへフォールバックすること
 * 検証意図: デフォルト動作がローカルbin維持であること
 */
Deno.test("resolveBinDir - 未指定時は従来<root>/binを返す", () => {
  withEnv({ GLOBAL_HARNESS_BIN_DIR: undefined, HARNESS_DISTRIBUTE_BIN_DIR: undefined }, () => {
    assertEquals(resolveBinDir("/tmp/fake-root"), join("/tmp/fake-root", "bin"));
  });
});

/**
 * ユースケース: 両変数指定時にGLOBAL_HARNESS_BIN_DIRが優先されること
 * 検証意図: 優先順位がコード定義通りであること
 */
Deno.test("resolveBinDir - GLOBALがHARNESS_DISTRIBUTEより優先される", () => {
  withEnv(
    {
      GLOBAL_HARNESS_BIN_DIR: "/tmp/iso-global-bin",
      HARNESS_DISTRIBUTE_BIN_DIR: "/tmp/iso-dist-bin",
    },
    () => {
      assertEquals(resolveBinDir("/tmp/fake-root"), "/tmp/iso-global-bin");
    },
  );
});

/**
 * ユースケース: 空文字・空白のみの指定は未指定扱いでフォールバックすること
 * 検証意図: 空envが意図外の相対解決を起こさないこと
 */
Deno.test("resolveBinDir - 空文字指定時はフォールバックする", () => {
  withEnv(
    { GLOBAL_HARNESS_BIN_DIR: "", HARNESS_DISTRIBUTE_BIN_DIR: "   " },
    () => {
      assertEquals(resolveBinDir("/tmp/fake-root"), join("/tmp/fake-root", "bin"));
    },
  );
});

/**
 * ユースケース: 末尾スラッシュ・~指定が正規化されること
 * 検証意図: 意図外ディレクトリへのmkdir/downloadを防ぐこと
 */
Deno.test("resolveBinDir - 末尾スラッシュとチルダを正規化する", () => {
  withEnv(
    { GLOBAL_HARNESS_BIN_DIR: undefined, HARNESS_DISTRIBUTE_BIN_DIR: "~/.harness/bin/" },
    () => {
      const home = Deno.env.get("HOME") ?? "";
      assertEquals(resolveBinDir("/tmp/fake-root"), join(home, ".harness/bin"));
    },
  );
  assertEquals(normalizeBinDir("/tmp/iso-dist-bin/", "/tmp/home"), "/tmp/iso-dist-bin");
  assertEquals(normalizeBinDir("", "/tmp/home"), "");
});

/**
 * ユースケース: installGhが隔離dir配下にバイナリを配置すること
 * 検証意図: 解決済みbinDir一本で動作し隔離外へ触れないこと
 */
Deno.test("installGh - 隔離dir指定時にそのdirへ配置する", async () => {
  await withTempDir(async (isolatedDir) => {
    const record = { paths: [] as string[] };
    await installGh(isolatedDir, "linux", "x86_64", createIsolatedDeps(record));
    assert(record.paths.includes(join(isolatedDir, "gh")));
    assert(record.paths.every((p) => p.startsWith(isolatedDir)));
  });
});
