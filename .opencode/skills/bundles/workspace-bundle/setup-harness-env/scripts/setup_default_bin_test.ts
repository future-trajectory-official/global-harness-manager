import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";

import { GH_VERSION, installGh, type InstallGhDeps, resolveBinDir } from "./setup.ts";
import { silentLogger, withEnvAsync, withTempDir } from "./setup_test_helpers.ts";

// WP #733 AC-3 採用バージョン（調査確定版）。
// - Deno v2.9.6: 最新安定版（Latest タグ 2026-08-27）と一致のため据え置き。
// - gh v2.100.0: 最新安定版（2026-09-03公開・immutable・prereleaseなし）。
//   資産命名 gh_<ver>_<target>.<ext> の維持を GitHub Releases API で確認済み。
//   実DL未実施のため配置成否は後続検証（C5残課題→引継ぎメモ参照）。
const EXPECTED_DENO_VERSION = "v2.9.6";
const EXPECTED_GH_VERSION = "v2.100.0";

/**
 * ユースケース: GH_VERSION定数が調査確定版と一致すること
 * 検証意図: バージョンの単一の正がコードとテストで乖離しないこと
 */
Deno.test("GH_VERSION - 調査確定版と一致する", () => {
  assertEquals(GH_VERSION, EXPECTED_GH_VERSION);
});

/**
 * ユースケース: AC-3 既存bin/維持のためgh後継安定版のDL経路が正しいこと
 * 検証意図: installGhが組み立てるDL URLがv2.100.0かつ資産命名規則に従うこと（mock捕捉のみ・DL実行なし）
 */
Deno.test("installGh - 後継安定版gh v2.100.0のDL URLを組み立てる", async () => {
  const cases: Array<{ os: string; arch: string; expectedFile: string }> = [
    { os: "linux", arch: "x86_64", expectedFile: "gh_2.100.0_linux_amd64.tar.gz" },
    { os: "linux", arch: "aarch64", expectedFile: "gh_2.100.0_linux_arm64.tar.gz" },
    { os: "darwin", arch: "x86_64", expectedFile: "gh_2.100.0_macOS_amd64.zip" },
    { os: "darwin", arch: "aarch64", expectedFile: "gh_2.100.0_macOS_arm64.zip" },
    { os: "windows", arch: "x86_64", expectedFile: "gh_2.100.0_windows_amd64.zip" },
    { os: "windows", arch: "aarch64", expectedFile: "gh_2.100.0_windows_amd64.zip" },
  ];
  for (const { os, arch, expectedFile } of cases) {
    await withTempDir(async (binDir) => {
      const urls: string[] = [];
      const deps: InstallGhDeps = {
        fs: {
          downloadFile: (url: string, _destPath: string) => {
            urls.push(url);
            return Promise.resolve();
          },
          extract: () => Promise.resolve(),
          exists: (_path: string) => Promise.resolve(false),
          move: () => Promise.resolve(),
          remove: () => Promise.resolve(),
          mkdir: () => Promise.resolve(),
        },
        cmd: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
        logger: silentLogger(),
      };
      await installGh(binDir, os, arch, deps);

      assertEquals(urls.length, 1, `${os}/${arch} でDLが1回呼ばれること`);
      assertEquals(
        urls[0],
        `https://github.com/cli/cli/releases/download/${EXPECTED_GH_VERSION}/${expectedFile}`,
        `${os}/${arch} のDL URLが後継安定版を指すこと`,
      );
    });
  }
});

/**
 * ユースケース: AC-3 デフォルト動作（env未指定→<root>/bin）が従来通りであること
 * 検証意図: 隔離root配下のbin解決とinstallGh書込みが隔離dir内のみで完結し実bin/に触れないこと
 */
Deno.test("resolveBinDir/installGh - env未指定時は隔離<root>/bin配下のみに触れる", async () => {
  const fakeRoot = await Deno.makeTempDir();
  try {
    await withEnvAsync(
      { GLOBAL_HARNESS_BIN_DIR: undefined, HARNESS_DISTRIBUTE_BIN_DIR: undefined },
      async () => {
        const binDir = resolveBinDir(fakeRoot);
        assertEquals(binDir, join(fakeRoot, "bin"), "既定は従来通り<root>/binであること");

        const touched: string[] = [];
        const deps: InstallGhDeps = {
          fs: {
            downloadFile: (_url: string, destPath: string) => {
              touched.push(destPath);
              return Promise.resolve();
            },
            extract: () => Promise.resolve(),
            exists: (_path: string) => Promise.resolve(false),
            move: (src: string, dest: string) => {
              touched.push(src);
              touched.push(dest);
              return Promise.resolve();
            },
            remove: (path: string, _options?: { recursive?: boolean }) => {
              touched.push(path);
              return Promise.resolve();
            },
            mkdir: (path: string, _options?: { recursive?: boolean }) => {
              touched.push(path);
              return Promise.resolve();
            },
          },
          cmd: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }),
          logger: silentLogger(),
        };
        await installGh(binDir, "linux", "x86_64", deps);

        assert(touched.length > 0, "何らかのパス操作が記録されること");
        for (const p of touched) {
          assert(p.startsWith(binDir), `隔離外への書込みがないこと: ${p}`);
        }
      },
    );
  } finally {
    await Deno.remove(fakeRoot, { recursive: true });
  }
});

/**
 * ユースケース: AC-3 既存install経路（install-*.sh/ps1）が壊れないこと
 * 検証意図: DENO定数が最新安定版v2.9.6で既定BIN_DIRが<root>/bin維持であること（読取のみ・実bin不接触）
 */
Deno.test("install scripts - DENO v2.9.6固定と既定bin配置を維持する", async () => {
  const scriptsDir = new URL(".", import.meta.url).pathname;
  const linux = await Deno.readTextFile(join(scriptsDir, "install-linux.sh"));
  assert(
    linux.includes(`releases/download/${EXPECTED_DENO_VERSION}/deno-`),
    `install-linux.sh がDENO ${EXPECTED_DENO_VERSION}を参照すること`,
  );
  assert(
    linux.includes('BIN_DIR="$HARNESS_ROOT/bin"'),
    "install-linux.sh の既定が<root>/binであること",
  );

  const mac = await Deno.readTextFile(join(scriptsDir, "install-mac.sh"));
  assert(
    mac.includes(`releases/download/${EXPECTED_DENO_VERSION}/deno-`),
    `install-mac.sh がDENO ${EXPECTED_DENO_VERSION}を参照すること`,
  );
  assert(
    mac.includes('BIN_DIR="$HARNESS_ROOT/bin"'),
    "install-mac.sh の既定が<root>/binであること",
  );

  const win = await Deno.readTextFile(join(scriptsDir, "install-windows.ps1"));
  assert(
    win.includes(`releases/download/${EXPECTED_DENO_VERSION}/deno-`),
    `install-windows.ps1 がDENO ${EXPECTED_DENO_VERSION}を参照すること`,
  );
  assert(
    win.includes('Join-Path $HarnessRoot "bin"'),
    "install-windows.ps1 の既定が<root>/binであること",
  );
});
