/**
 * resolve-target-account モジュールのテスト（WP #763 AC-4）。
 *
 * アカウント特定に基づき対象アカウントの ProjectV2 に操作できることを検証する。
 * `account-identifier`（identifyAccount／parseGitRemoteUrl／parseIdentities）と
 * `account-context`（verifyGhAuth）の委譲を検証し、再実装しないことを担保する。
 * 外部通信・実 gh 呼出は行わず、依存（git remote・identities本文・gh status）は
 * 引数注入で差し替える。実装前に失敗すること（RED）を確認するための先行テスト。
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { resolveOwnerTarget, resolveTargetAccount } from "./resolve-target-account.ts";
import { parseCreateBoardsArgs } from "./create-boards.ts";
import { parseCreateFieldsArgs } from "./create-fields.ts";

const IDENTITIES_MD = `## GHM
- **Repository**: https://github.com/future-trajectory-official/global-harness-manager
- **Account Name**: future-trajectory
`;

const REMOTE_SSH = "git@github.com:future-trajectory-official/global-harness-manager.git";

/**
 * ユースケース: git remote からボード所有者（owner）を解決できること
 * 検証意図: repo未指定時に git remote の owner が owner として返ることを確認する
 */
Deno.test("AC-4(a): git remote から owner を解決する", () => {
  const result = resolveTargetAccount(null, {
    gitRemoteUrl: () => REMOTE_SSH,
    identitiesText: () => IDENTITIES_MD,
    ghStatus: () => ({
      code: 0,
      stdout: "Logged in to github.com account future-trajectory (keyring)",
      stderr: "",
    }),
  });
  assertEquals(result.owner, "future-trajectory-official");
});

/**
 * ユースケース: identities 照合で認証アカウント（accountName）を特定できること
 * 検証意図: git remote と対応表の照合で Account Name が返ることを確認する
 */
Deno.test("AC-4(b): identities 照合で accountName を特定する", () => {
  const result = resolveTargetAccount(null, {
    gitRemoteUrl: () => REMOTE_SSH,
    identitiesText: () => IDENTITIES_MD,
    ghStatus: () => ({
      code: 0,
      stdout: "Logged in to github.com account future-trajectory (keyring)",
      stderr: "",
    }),
  });
  assertEquals(result.accountName, "future-trajectory");
});

/**
 * ユースケース: gh 認証一致時は verified=true になること
 * 検証意図: gh status の認証アカウントが特定アカウントと一致すれば検証成功を確認する
 */
Deno.test("AC-4(c): gh 認証一致時は verified=true になる", () => {
  const result = resolveTargetAccount(null, {
    gitRemoteUrl: () => REMOTE_SSH,
    identitiesText: () => IDENTITIES_MD,
    ghStatus: () => ({
      code: 0,
      stdout: "Logged in to github.com account future-trajectory (keyring)",
      stderr: "",
    }),
  });
  assertEquals(result.verified, true);
  assertEquals(result.guidance, null);
});

/**
 * ユースケース: gh 認証不一致時は誘導文を返し自動切替しないこと
 * 検証意図: verified=false かつ gh auth switch 案内の誘導文が非nullであることを確認する
 */
Deno.test("AC-4(d): gh 認証不一致時は verified=false＋誘導文を返す", () => {
  const result = resolveTargetAccount(null, {
    gitRemoteUrl: () => REMOTE_SSH,
    identitiesText: () => IDENTITIES_MD,
    ghStatus: () => ({
      code: 0,
      stdout: "Logged in to github.com account other-user (keyring)",
      stderr: "",
    }),
  });
  assertEquals(result.verified, false);
  assert(result.guidance !== null);
  assert(result.guidance.includes("gh auth switch"));
  assert(result.guidance.includes("future-trajectory"));
});

/**
 * ユースケース: 対象外リポジトリは accountName=null になること
 * 検証意図: 対応表に無いリポジトリで認証アカウントが特定されず gh 検証をスキップすることを確認する
 */
Deno.test("AC-4(e): 対象外リポジトリは accountName=null になる", () => {
  const result = resolveTargetAccount("unknown-org/unknown-repo", {
    gitRemoteUrl: () => {
      throw new Error("git remote を参照してはならない");
    },
    identitiesText: () => IDENTITIES_MD,
    ghStatus: () => {
      throw new Error("対象外時は gh 検証をスキップしなければならない");
    },
  });
  assertEquals(result.accountName, null);
  assertEquals(result.guidance, null);
});

/**
 * ユースケース: create-boards／create-fields が --repo を解析できること
 * 検証意図: generate-harnessrc と同名フラグで対象リポジトリを受け付けることを確認する
 */
Deno.test("AC-4(接続): create-boards／create-fields が --repo を解析する", () => {
  assertEquals(
    parseCreateBoardsArgs(["--repo", "future-trajectory-official/global-harness-manager"]),
    {
      owner: "",
      repo: "future-trajectory-official/global-harness-manager",
      dryRun: false,
      help: false,
    },
  );
  assertEquals(
    parseCreateFieldsArgs(
      ["11", "sprintBoard", "--repo", "future-trajectory-official/global-harness-manager"],
    ).repo,
    "future-trajectory-official/global-harness-manager",
  );
  assertThrows(
    () => parseCreateBoardsArgs(["--repo"]),
    Error,
    "--repo の値",
  );
  assertThrows(
    () => parseCreateFieldsArgs(["11", "sprintBoard", "--repo"]),
    Error,
    "--repo の値",
  );
});

/**
 * ユースケース: --owner 明示時は所有者を上書きしつつ gh 検証も行うこと
 * 検証意図: 後方互換の所有者優先を維持しながら、検証バイパスを是正すること。
 * resolve が呼ばれ、検証結果（accountName/verified/guidance）が引き継がれることを確認する
 */
Deno.test("AC-4(接続): --owner 明示時は所有者を上書きしつつ検証も行う", () => {
  let resolvedWith: string | null | undefined;
  const target = resolveOwnerTarget(
    { owner: "test-owner", repo: "future-trajectory-official/global-harness-manager" },
    (repo) => {
      resolvedWith = repo;
      return {
        owner: "future-trajectory-official",
        accountName: "future-trajectory",
        verified: true,
        guidance: null,
      };
    },
  );
  assertEquals(resolvedWith, "future-trajectory-official/global-harness-manager");
  assertEquals(target.owner, "test-owner");
  assertEquals(target.accountName, "future-trajectory");
  assertEquals(target.verified, true);
  assertEquals(target.guidance, null);
});

/**
 * ユースケース: --owner 明示時でも不一致時は誘導文を引き継ぐこと
 * 検証意図: 明示指定時も検証が行われ、呼出元が作成中止（非ゼロ終了）を判断できることを確認する
 */
Deno.test("AC-4(接続): --owner 明示時でも不一致時は誘導文を引き継ぐ", () => {
  const target = resolveOwnerTarget(
    { owner: "test-owner", repo: "future-trajectory-official/global-harness-manager" },
    () => ({
      owner: "future-trajectory-official",
      accountName: "future-trajectory",
      verified: false,
      guidance: "現在の gh 認証は 'future-trajectory' ではありません。",
    }),
  );
  assertEquals(target.owner, "test-owner");
  assertEquals(target.verified, false);
  assert(target.guidance !== null);
});

/**
 * ユースケース: git remote・identities とも不在時は対象外として返すこと
 * 検証意図: remote-null・identities-null 経路で owner/accountName とも null、
 * gh 検証なし（guidance なし）になることを確認する
 */
Deno.test("AC-4(対象外): remote・identities 不在時はすべて未特定で返す", () => {
  const result = resolveTargetAccount(null, {
    gitRemoteUrl: () => null,
    identitiesText: () => null,
    ghStatus: () => {
      throw new Error("未特定時は gh 検証を呼び出してはならない");
    },
  });
  assertEquals(result.owner, null);
  assertEquals(result.accountName, null);
  assertEquals(result.verified, false);
  assertEquals(result.guidance, null);
});

/**
 * ユースケース: --repo 解決で不一致時は誘導文が返り作成中止を判断できること
 * 検証意図: guidance 非null時に呼出元が作成を実行しない分岐の入力になることを確認する
 */
Deno.test("AC-4(接続): 不一致時は誘導文により作成中止を判断できる", () => {
  const target = resolveOwnerTarget(
    { owner: "", repo: "future-trajectory-official/global-harness-manager" },
    () => ({
      owner: "future-trajectory-official",
      accountName: "future-trajectory",
      verified: false,
      guidance: "現在の gh 認証は 'future-trajectory' ではありません。",
    }),
  );
  assertEquals(target.verified, false);
  assert(target.guidance !== null);
});
