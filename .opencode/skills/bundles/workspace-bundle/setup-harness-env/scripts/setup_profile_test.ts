import { assert, assertEquals } from "@std/assert";

import {
  appendBinDirToProfile,
  buildWindowsPath,
  escapePowerShellString,
  getProfileFile,
  needsProfileUpdate,
  needsWindowsPathUpdate,
  resolveBinDir,
} from "./setup.ts";
import { withEnv } from "./setup_test_helpers.ts";

/**
 * ユースケース: 配布先bin未記載のプロファイルに解決済みbinDirが追記されること
 * 検証意図: resolveBinDirで解決した配布先パス一本がexport行として追加されること
 */
Deno.test("appendBinDirToProfile - 配布先bin未記載時は解決済みbinDirを追記する", () => {
  withEnv(
    { GLOBAL_HARNESS_BIN_DIR: undefined, HARNESS_DISTRIBUTE_BIN_DIR: "/tmp/iso-dist-bin" },
    () => {
      const binDir = resolveBinDir("/tmp/fake-root");
      assertEquals(binDir, "/tmp/iso-dist-bin");
      const updated = appendBinDirToProfile('export PATH="$PATH:/usr/bin"\n', binDir);
      assert(updated.includes(`export PATH="$PATH:${binDir}"`));
    },
  );
});

/**
 * ユースケース: 既にbinDir記載済みのプロファイルには重複追記しないこと
 * 検証意図: 完全行一致による重複防止が維持されること
 */
Deno.test("appendBinDirToProfile - 記載済みbinDirには重複追記しない", () => {
  const binDir = "/tmp/iso-dist-bin";
  const content = `export PATH="$PATH:${binDir}"\n`;
  assertEquals(needsProfileUpdate(content, binDir), false);
  assertEquals(appendBinDirToProfile(content, binDir), content);
});

/**
 * ユースケース: 類似パス（前方一致）があっても追記漏れしないこと
 * 検証意図: 部分一致による誤検出が起きないこと
 */
Deno.test("needsProfileUpdate - 前方一致パスでは更新要と判定する", () => {
  const binDir = "/tmp/iso-dist-bin";
  assert(needsProfileUpdate(`export PATH="$PATH:${binDir}-old"\n`, binDir));
  assert(needsProfileUpdate('export PATH="$PATH:/usr/bin"\n', binDir));
  assertEquals(needsProfileUpdate(`export PATH="$PATH:${binDir}"\n`, binDir), false);
});

/**
 * ユースケース: 末尾改行なしのプロファイルでも空行を増やさず追記できること
 * 検証意図: 追記結果の連結が正規化されること
 */
Deno.test("appendBinDirToProfile - 末尾改行なしでも空行を増やさない", () => {
  const binDir = "/tmp/iso-dist-bin";
  const updated = appendBinDirToProfile('export PATH="$PATH:/usr/bin"', binDir);
  assertEquals(
    updated,
    'export PATH="$PATH:/usr/bin"\n# global-harness-manager\n' +
      `export PATH="$PATH:${binDir}"\n`,
  );
});

/**
 * ユースケース: OSに応じたプロファイルが選択されること
 * 検証意図: darwin→.zshrc、それ以外→.bashrcであること
 */
Deno.test("getProfileFile - OS別に正しいプロファイルを選ぶ", () => {
  assertEquals(getProfileFile("darwin", "/home/test"), "/home/test/.zshrc");
  assertEquals(getProfileFile("linux", "/home/test"), "/home/test/.bashrc");
});

/**
 * ユースケース: WindowsはUser PATHのみを対象とし重複追加しないこと
 * 検証意図: 従来通りUser PATH一本の操作であり区切り単位で重複防止すること
 */
Deno.test("Windows PATH - 未含時は;結合し記載済み時は更新不要", () => {
  const binDir = "C:\\Users\\test\\.harness\\bin";
  assert(needsWindowsPathUpdate("C:\\Windows\\System32", binDir));
  assertEquals(
    buildWindowsPath("C:\\Windows\\System32", binDir),
    `C:\\Windows\\System32;${binDir}`,
  );
  assertEquals(needsWindowsPathUpdate(`C:\\Windows\\System32;${binDir}`, binDir), false);
});

/**
 * ユースケース: Windows PATH判定が大文字小文字・空値・類似パスを正しく扱うこと
 * 検証意図: ケース差異は同一扱い、空時はbinDirのみ、前方一致は誤検出しないこと
 */
Deno.test("Windows PATH - 大文字小文字と空値を正規化する", () => {
  const binDir = "c:\\users\\test\\.harness\\bin";
  assertEquals(needsWindowsPathUpdate("C:\\USERS\\TEST\\.HARNESS\\BIN", binDir), false);
  assertEquals(buildWindowsPath("", binDir), binDir);
  assert(buildWindowsPath("C:\\Windows\\System32;", binDir).includes(";;") === false);
  assert(needsWindowsPathUpdate("C:\\tools\\bin-old", "C:\\tools\\bin"));
});

/**
 * ユースケース: PowerShell組立て時にシングルクォートを無害化すること
 * 検証意図: 外部由来パス中のクォートによるコマンド破壊を防ぐこと
 */
Deno.test("escapePowerShellString - シングルクォートを二重化する", () => {
  assertEquals(escapePowerShellString("C:\\User's\\bin"), "C:\\User''s\\bin");
  assertEquals(escapePowerShellString("plain"), "plain");
});
