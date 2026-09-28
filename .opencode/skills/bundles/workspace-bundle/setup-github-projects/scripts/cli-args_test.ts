/**
 * cli-args モジュール（共通CLI引数パーサ）のテスト（WP #763 レビュー指摘対応）。
 *
 * create-boards／create-fields の共通オプション解析・文言の一元化を検証する。
 * 外部通信は行わない（純関数のみ）。
 */

import { assertEquals, assertThrows } from "@std/assert";
import { BOARDS_USAGE, FIELDS_USAGE, handleTargetOrExit, parseCommonArgs } from "./cli-args.ts";

/**
 * ユースケース: 共通オプションを解決できること
 * 検証意図: --owner／--repo／--dry-run／--help と位置引数の分離を確認する
 */
Deno.test("共通解析: --owner／--repo／--dry-run／--helpと位置引数を分離する", () => {
  assertEquals(
    parseCommonArgs(["--owner", "test-owner", "--repo", "o/r", "--dry-run", "pos"]),
    {
      owner: "test-owner",
      repo: "o/r",
      dryRun: true,
      help: false,
      positionals: ["pos"],
      extras: {},
    },
  );
  assertEquals(parseCommonArgs(["--help"]), {
    owner: "",
    repo: null,
    dryRun: false,
    help: true,
    positionals: [],
    extras: {},
  });
});

/**
 * ユースケース: 固有の値付きフラグを受け付けられること
 * 検証意図: valueFlags 指定のフラグ値が extras に格納されることを確認する
 */
Deno.test("固有フラグ: valueFlags指定の値をextrasへ格納する", () => {
  const result = parseCommonArgs(["11", "sprintBoard", "--data-type", "TEXT"], {
    valueFlags: { "--data-type": "--data-type の値（TEXT等）が指定されていません" },
  });
  assertEquals(result.extras, { "--data-type": "TEXT" });
  assertEquals(result.positionals, ["11", "sprintBoard"]);
  assertThrows(
    () =>
      parseCommonArgs(["--data-type"], {
        valueFlags: { "--data-type": "--data-type の値（TEXT等）が指定されていません" },
      }),
    Error,
    "--data-type の値",
  );
});

/**
 * ユースケース: 未知の --* フラグは拒否すること
 * 検証意図: タイポ時に実作成へ進まないよう Error を投げることを確認する
 */
Deno.test("異常系: 未知の --* フラグでErrorを投げる", () => {
  assertThrows(
    () => parseCommonArgs(["--dryrun"]),
    Error,
    "未知のオプション",
  );
});

/**
 * ユースケース: 共通オプションの値欠落は拒否すること
 * 検証意図: --owner／--repo の値欠落で Error を投げることを確認する
 */
Deno.test("異常系: --owner／--repo の値欠落でErrorを投げる", () => {
  assertThrows(() => parseCommonArgs(["--owner"]), Error, "--owner の値");
  assertThrows(() => parseCommonArgs(["--repo"]), Error, "--repo の値");
});

/**
 * ユースケース: 利用法文字列が両CLIで定義されていること
 * 検証意図: 文言の一元化（drift防止）のため利用法が定数として存在することを確認する
 */
Deno.test("利用法: 両CLIの利用法文字列が定義されている", () => {
  assertEquals(BOARDS_USAGE.includes("create-boards"), true);
  assertEquals(FIELDS_USAGE.includes("create-fields"), true);
});

/**
 * ユースケース: 検証済みの対象アカウントから所有者を取り出せること
 * 検証意図: handleTargetOrExit の正常系（guidance なし・owner あり）で
 * 所有者が返ることを確認する（異常系はプロセス終了のため本テストでは扱わない）
 */
Deno.test("handleTargetOrExit: 検証済みなら所有者を返す", () => {
  assertEquals(
    handleTargetOrExit({ owner: "test-owner", accountName: null, verified: false, guidance: null }),
    "test-owner",
  );
});
