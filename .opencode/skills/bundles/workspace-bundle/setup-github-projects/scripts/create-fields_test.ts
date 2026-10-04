/**
 * create-fields モジュールのテスト（WP #763 AC-1）。
 *
 * gh 呼出部は注入可能関数（FieldGhRunner）に分離し、本テストではモックで差し替える。
 * 実装前に失敗すること（RED）を確認するための先行テスト。
 */

import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { BOARD_FIELDS } from "../../../../../core/gateway/field-registry.ts";
import {
  buildFieldsPlan,
  dryRunFields,
  ensureFields,
  fieldsForBoard,
  makeFieldGhRunner,
  parseCreateFieldsArgs,
  parseFieldListJson,
} from "./create-fields.ts";
import type { CommandResult } from "./subprocess.ts";

/**
 * ユースケース: BOARD_FIELDS 準拠のフィールド集合を返すこと
 * 検証意図: fieldsForBoard の戻り値が BOARD_FIELDS[board] と一致することを確認する
 */
Deno.test("BOARD_FIELDS準拠: fieldsForBoard が正の定義と一致する", () => {
  for (
    const board of Object.keys(BOARD_FIELDS) as Array<keyof typeof BOARD_FIELDS>
  ) {
    assertEquals([...fieldsForBoard(board)], [...BOARD_FIELDS[board]]);
  }
});

/**
 * ユースケース: 既存フィールドはスキップすること
 * 検証意図: listFields が全フィールドを返した場合、createField が呼ばれないことを確認する
 */
Deno.test("既存時スキップ分岐: 既存フィールドは作成しない", async () => {
  let createCalls = 0;
  const existing = [...BOARD_FIELDS.sprintBoard];
  const created = await ensureFields(11, "sprintBoard", {
    listFields: (_boardNumber: number, _owner: string) => Promise.resolve(existing),
    createField: (
      _boardNumber: number,
      _owner: string,
      _name: string,
      _dataType: string,
    ) => {
      createCalls++;
      return Promise.resolve();
    },
  });
  assertEquals(created, []);
  assertEquals(createCalls, 0);
});

/**
 * ユースケース: 不足フィールドのみ作成すること
 * 検証意図: listFields が空の場合、BOARD_FIELDS[board] の全件が作成対象になることを確認する
 */
Deno.test("不存在→作成分岐: 不足フィールドのみ作成する", async () => {
  const createdNames: string[] = [];
  const created = await ensureFields(10, "productBacklog", {
    listFields: (_boardNumber: number, _owner: string) => Promise.resolve([]),
    createField: (
      _boardNumber: number,
      _owner: string,
      name: string,
      _dataType: string,
    ) => {
      createdNames.push(name);
      return Promise.resolve();
    },
  });
  assertEquals(createdNames.sort(), [...BOARD_FIELDS.productBacklog].sort());
  assertEquals(created.sort(), [...BOARD_FIELDS.productBacklog].sort());
});

/**
 * ユースケース: 実 `gh project field-list --format json` 出力をパースして既存検出すること
 * 検証意図: 実JSON（fields配下・id/type付き・harness-*14件＋組込13件）から名前一覧を抽出できることを確認する
 */
Deno.test("実JSONパース: gh project field-list 出力から既存フィールドを検出する", () => {
  const raw = JSON.stringify({
    fields: [
      { id: "PVTF_x1", name: "Title", type: "ProjectV2Field" },
      {
        id: "PVTSSF_x2",
        name: "Status",
        options: [{ id: "a", name: "Todo" }],
        type: "ProjectV2SingleSelectField",
      },
      { id: "PVTF_x3", name: "harness-sequence", type: "ProjectV2Field" },
      { id: "PVTF_x4", name: "harness-kpt-keep", type: "ProjectV2Field" },
      {
        id: "PVTF_x5",
        name: "harness-metrics-intent-alignment",
        type: "ProjectV2Field",
      },
      { id: "PVTF_x6", name: null, type: "ProjectV2Field" },
    ],
    totalCount: 6,
  });
  const parsed = parseFieldListJson(raw);
  assertEquals(parsed, [
    "Title",
    "Status",
    "harness-sequence",
    "harness-kpt-keep",
    "harness-metrics-intent-alignment",
  ]);
});

/**
 * ユースケース: 1件欠落時は欠落分のみ作成すること
 * 検証意図: 13件既存＋1件不在の場合、作成呼出が1件・対象フィールドのみであることを確認する
 */
Deno.test("部分欠落→作成分岐: 欠落した1フィールドのみ作成する", async () => {
  const missing = "harness-sequence";
  const existing = [...BOARD_FIELDS.sprintBoard].filter((name) => name !== missing);
  assertEquals(existing.length, BOARD_FIELDS.sprintBoard.length - 1);
  const createdNames: string[] = [];
  const created = await ensureFields(11, "sprintBoard", {
    listFields: (_boardNumber: number, _owner: string) => Promise.resolve(existing),
    createField: (
      _boardNumber: number,
      _owner: string,
      name: string,
      _dataType: string,
    ) => {
      createdNames.push(name);
      return Promise.resolve();
    },
  });
  assertEquals(created, [missing]);
  assertEquals(createdNames, [missing]);
});

/**
 * ユースケース: BOARD_FIELDS との等価性（HARNESS_FIELDS直書きでないことの担保）
 * 検証意図: 全3ボードで fieldsForBoard が BOARD_FIELDS[board] と同一参照・同一内容であることを確認する
 */
Deno.test("BOARD_FIELDS等価性: 全ボードで正の定義と同一参照・同一内容である", () => {
  for (
    const board of Object.keys(BOARD_FIELDS) as Array<keyof typeof BOARD_FIELDS>
  ) {
    // 同一参照であることは直書きコピーでないことの担保になる
    assertEquals(fieldsForBoard(board) === BOARD_FIELDS[board], true);
    assertEquals([...fieldsForBoard(board)].sort(), [...BOARD_FIELDS[board]].sort());
  }
  assertEquals(BOARD_FIELDS.productBacklog.length, 7);
  assertEquals(BOARD_FIELDS.sprintBoard.length, 14);
  assertEquals(BOARD_FIELDS.retrospectiveBoard.length, 10);
});

/**
 * ユースケース: CLI引数から --owner / --data-type / --dry-run を解決できること
 * 検証意図: フラグ形式と位置引数の両方でボード番号・ボード・所有者を特定できることを確認する
 */
Deno.test("引数解析: --ownerと--data-typeと--dry-runを解決する", () => {
  assertEquals(
    parseCreateFieldsArgs(["11", "sprintBoard", "--owner", "test-owner", "--dry-run"]),
    {
      boardNumber: 11,
      board: "sprintBoard",
      owner: "test-owner",
      repo: null,
      dataType: "TEXT",
      dryRun: true,
      help: false,
    },
  );
  assertEquals(parseCreateFieldsArgs(["11", "sprintBoard"]), {
    boardNumber: 11,
    board: "sprintBoard",
    owner: "",
    repo: null,
    dataType: "TEXT",
    dryRun: false,
    help: false,
  });
  assertEquals(
    parseCreateFieldsArgs(["--data-type", "TEXT", "11", "sprintBoard"]),
    {
      boardNumber: 11,
      board: "sprintBoard",
      owner: "",
      repo: null,
      dataType: "TEXT",
      dryRun: false,
      help: false,
    },
  );
  assertEquals(parseCreateFieldsArgs(["--help"]), {
    boardNumber: 0,
    board: "",
    owner: "",
    repo: null,
    dataType: "TEXT",
    dryRun: false,
    help: true,
  });
});

/**
 * ユースケース: 実行計画を純関数で組み立てられること
 * 検証意図: 全存在時はスキップ14件・作成0件、1件欠落時はスキップ13件・作成1件になることを確認する
 */
Deno.test("実行計画: 既存件数に応じたスキップ・作成件数を組み立てる", () => {
  const full = buildFieldsPlan("sprintBoard", [...BOARD_FIELDS.sprintBoard]);
  assertEquals(full.skipCount, 14);
  assertEquals(full.createCount, 0);
  assertEquals(full.toCreate, []);

  const missing = "harness-sequence";
  const partial = buildFieldsPlan(
    "sprintBoard",
    [...BOARD_FIELDS.sprintBoard].filter((name) => name !== missing),
  );
  assertEquals(partial.skipCount, 13);
  assertEquals(partial.createCount, 1);
  assertEquals(partial.toCreate, [missing]);
  assertEquals(partial.lines.join("\n").includes(missing), true);
});

/**
 * ユースケース: --dry-run は作成呼出なしでスキップ14件・作成0件の計画を出すこと
 * 検証意図: 実フィールド新規作成の副作用なしに計画が得られることを確認する
 */
Deno.test("--dry-run: 作成呼出なしでスキップ計画を返す", async () => {
  let createCalls = 0;
  const output = await dryRunFields(
    11,
    "sprintBoard",
    {
      listFields: (_boardNumber: number, _owner: string) =>
        Promise.resolve([...BOARD_FIELDS.sprintBoard]),
      createField: (
        _boardNumber: number,
        _owner: string,
        _name: string,
        _dataType: string,
      ) => {
        createCalls++;
        return Promise.resolve();
      },
    },
  );
  assertEquals(createCalls, 0);
  assertStringIncludes(output, "スキップ14件");
  assertStringIncludes(output, "作成0件");
});

/**
 * ユースケース: --dry-run は部分欠落時も作成呼出なしで計画を出すこと
 * 検証意図: 1件欠落時も createField が呼ばれず、作成1件の計画になることを確認する
 */
Deno.test("--dry-run部分欠落: 作成呼出なしで作成1件の計画を返す", async () => {
  const missing = "harness-sequence";
  let createCalls = 0;
  const output = await dryRunFields(
    11,
    "sprintBoard",
    {
      listFields: (_boardNumber: number, _owner: string) =>
        Promise.resolve([...BOARD_FIELDS.sprintBoard].filter((name) => name !== missing)),
      createField: (
        _boardNumber: number,
        _owner: string,
        _name: string,
        _dataType: string,
      ) => {
        createCalls++;
        return Promise.resolve();
      },
    },
  );
  assertEquals(createCalls, 0);
  assertStringIncludes(output, "スキップ13件");
  assertStringIncludes(output, "作成1件");
  assertStringIncludes(output, missing);
});

/**
 * ユースケース: 不正JSONの gh project field-list 出力は拒否すること
 * 検証意図: parseFieldListJson が不正JSONで Error を投げることを確認する
 */
Deno.test("異常系: parseFieldListJson が不正JSONでErrorを投げる", () => {
  assertThrows(
    () => parseFieldListJson("{not-json}"),
    Error,
    "JSON 形式が不正",
  );
});

/**
 * ユースケース: 未知の --* フラグは実作成へ進まず拒否すること
 * 検証意図: --dryrun 等のタイポ時に Error を投げることを確認する
 */
Deno.test("異常系: 未知の --* フラグでErrorを投げる", () => {
  assertThrows(
    () => parseCreateFieldsArgs(["11", "sprintBoard", "--dryrun"]),
    Error,
    "未知のオプション",
  );
  assertThrows(
    () => parseCreateFieldsArgs(["11", "sprintBoard", "--bogus", "x"]),
    Error,
    "--bogus",
  );
});

/**
 * ユースケース: 余剰の位置引数は利用法エラーになること
 * 検証意図: 3件目以降の位置引数で Error を投げることを確認する
 */
Deno.test("異常系: 余剰の位置引数でErrorを投げる", () => {
  assertThrows(
    () => parseCreateFieldsArgs(["11", "sprintBoard", "extra"]),
    Error,
    "余剰",
  );
});

/**
 * ユースケース: --owner／--data-type の値欠落は拒否すること
 * 検証意図: フラグのみで終端した場合に Error を投げることを確認する
 */
Deno.test("異常系: --owner／--data-type の値欠落でErrorを投げる", () => {
  assertThrows(
    () => parseCreateFieldsArgs(["11", "sprintBoard", "--owner"]),
    Error,
    "--owner の値",
  );
  assertThrows(
    () => parseCreateFieldsArgs(["11", "sprintBoard", "--data-type"]),
    Error,
    "--data-type の値",
  );
});

/**
 * ユースケース: env付きrunnerがGH_TOKENを子プロセスへ転送すること
 * 検証意図: makeFieldGhRunner(env)の実行がenv付きでghを呼ぶことを確認する（AC-1の主旨）
 */
Deno.test("makeFieldGhRunner: envをgh呼出へ転送する", async () => {
  const seen: { args: string[]; env?: Record<string, string> }[] = [];
  const fakeRun = (
    args: string[],
    opts?: { env?: Record<string, string> },
  ): Promise<CommandResult> => {
    seen.push({ args, env: opts?.env });
    return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
  };
  const runner = makeFieldGhRunner({ GH_TOKEN: "TOKEN_B" }, fakeRun);
  await runner.listFields(11, "some-owner");
  assertEquals(seen.length, 1);
  assertEquals(seen[0].env, { GH_TOKEN: "TOKEN_B" });
  assertEquals(seen[0].args.slice(0, 2), ["project", "field-list"]);
});

/**
 * ユースケース: env未指定時はenvなしでghを呼ぶこと
 * 検証意図: 既定runnerが従来どおりambient動作することを確認する（AC-2後方互換）
 */
Deno.test("makeFieldGhRunner: env未指定時はenvなしで呼ぶ", async () => {
  const seen: { args: string[]; env?: Record<string, string> }[] = [];
  const fakeRun = (
    args: string[],
    opts?: { env?: Record<string, string> },
  ): Promise<CommandResult> => {
    seen.push({ args, env: opts?.env });
    return Promise.resolve({ code: 0, stdout: "[]", stderr: "" });
  };
  const runner = makeFieldGhRunner(undefined, fakeRun);
  await runner.listFields(11, "some-owner");
  assertEquals(seen.length, 1);
  assertEquals(seen[0].env, undefined);
});
