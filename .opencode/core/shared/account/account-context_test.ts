import { assertEquals, assertStringIncludes } from "@std/assert";
import { type AccountContext, resolveAccountContext, verifyGhAuth } from "./account-context.ts";

/**
 * ユースケース: gh の認証アカウントが一致することを検証できること
 * 検証意図: 完全一致トークンがあれば verified
 */
Deno.test("verifyGhAuth: 一致すれば検証成功", () => {
  assertEquals(
    verifyGhAuth("my-account", () => ({
      code: 0,
      stdout: "my-account (keyring)",
      stderr: "",
    })),
    { verified: true, guidance: null },
  );
});

/**
 * ユースケース: 接頭辞一致を誤検証しないこと
 * 検証意図: my-account-2 は my-account と不一致になる
 */
Deno.test("verifyGhAuth: 部分一致では検証成功しない", () => {
  const result = verifyGhAuth("my-account", () => ({
    code: 0,
    stdout: "my-account-2 (keyring)",
    stderr: "",
  }));
  assertEquals(result.verified, false);
  assertStringIncludes(result.guidance ?? "", "gh auth switch --user my-account");
});

/**
 * ユースケース: stderr 側の出力でも検証できること
 * 検証意図: stdout が空で stderr に名前がある環境に対応する
 */
Deno.test("verifyGhAuth: stderr 側の名前でも検証成功する", () => {
  assertEquals(
    verifyGhAuth("my-account", () => ({
      code: 0,
      stdout: "",
      stderr: "Logged in to github.com account my-account (keyring)",
    })),
    { verified: true, guidance: null },
  );
});

/**
 * ユースケース: gh の認証アカウント不一致を検出できること
 * 検証意図: 不一致時は gh auth switch の完全形誘導文が返る（自動切替しない）
 */
Deno.test("verifyGhAuth: 不一致時は切替誘導を返す", () => {
  const result = verifyGhAuth("my-account", () => ({
    code: 0,
    stdout: "other-account (keyring)",
    stderr: "",
  }));
  assertEquals(result.verified, false);
  assertStringIncludes(result.guidance ?? "", "gh auth switch --user my-account");
});

/**
 * ユースケース: gh 未認証を検出できること
 * 検証意図: 終了コード非ゼロ時は認証誘導が返る
 */
Deno.test("verifyGhAuth: gh 失敗時は認証誘導を返す", () => {
  const result = verifyGhAuth("my-account", () => ({
    code: 1,
    stdout: "",
    stderr: "not logged in",
  }));
  assertEquals(result.verified, false);
  assertStringIncludes(result.guidance ?? "", "gh auth login");
});

const IDENTITIES_MD = [
  "## 対象プロジェクト",
  "",
  "- **Repository**: `git@github.com:MyOrg/MyRepo.git`",
  "- **Account Name**: `my-account`",
  "",
].join("\n");

/**
 * ユースケース: アカウント別設定を一連で解決できること
 * 検証意図: remote→特定→検証→設定選択が通り、切替情報が返る
 */
Deno.test("resolveAccountContext: アカウント設定を解決する", () => {
  const ctx: AccountContext = resolveAccountContext({
    gitRemoteUrl: () => "https://github.com/MyOrg/MyRepo.git",
    identitiesText: () => IDENTITIES_MD,
    harnessRcPath: () => "/env/.harnessrc",
    readHarnessRc: () => '{"projects":{"sprintBoard":11},"fields":{}}',
    ghStatus: () => ({ code: 0, stdout: "my-account", stderr: "" }),
  });
  assertEquals(ctx.accountName, "my-account");
  assertEquals(ctx.config !== null, true);
  assertEquals(ctx.config?.projects["sprintBoard"], 11);
  assertEquals(ctx.verified, true);
  assertEquals(ctx.guidance, null);
});

/**
 * ユースケース: 明示パス経路で設定とアカウントを解決できること（AC-2 結合）
 * 検証意図: HARNESS_RC_PATH 解決→設定読込→Account Name 特定が通る
 */
Deno.test("resolveAccountContext: 明示パス経路で設定とアカウントを解決する", () => {
  const ctx: AccountContext = resolveAccountContext({
    gitRemoteUrl: () => "https://github.com/MyOrg/MyRepo.git",
    identitiesText: () => IDENTITIES_MD,
    harnessRcPath: () => "/env/.harnessrc",
    readHarnessRc: (path) => {
      assertEquals(path, "/env/.harnessrc");
      return '{"projects":{"sprintBoard":11},"fields":{}}';
    },
    ghStatus: () => ({ code: 0, stdout: "my-account", stderr: "" }),
  });
  assertEquals(ctx.config?.projects["sprintBoard"], 11);
  assertEquals(ctx.accountName, "my-account");
  assertEquals(ctx.verified, true);
});

/**
 * ユースケース: 対象外リポジトリのアカウント解決を除外すること
 * 検証意図: 対応表に無い remote は accountName null・検証スキップ・誘導なし
 */
Deno.test("resolveAccountContext: 対象外は未解決を返す", () => {
  const ctx: AccountContext = resolveAccountContext({
    gitRemoteUrl: () => "git@github.com:Unknown/Repo.git",
    identitiesText: () => IDENTITIES_MD,
    harnessRcPath: () => null,
    readHarnessRc: () => "",
    ghStatus: () => ({ code: 0, stdout: "my-account", stderr: "" }),
  });
  assertEquals(ctx.accountName, null);
  assertEquals(ctx.config, null);
  assertEquals(ctx.verified, false);
  assertEquals(ctx.guidance, null);
});

/**
 * ユースケース: git remote 取得失敗時も設定読込を継続すること
 * 検証意図: accountName null だが config は維持される
 */
Deno.test("resolveAccountContext: remote 不明時も設定は読む", () => {
  const ctx: AccountContext = resolveAccountContext({
    gitRemoteUrl: () => null,
    identitiesText: () => IDENTITIES_MD,
    harnessRcPath: () => "/env/.harnessrc",
    readHarnessRc: () => '{"projects":{"sprintBoard":11},"fields":{}}',
    ghStatus: () => ({ code: 0, stdout: "my-account", stderr: "" }),
  });
  assertEquals(ctx.accountName, null);
  assertEquals(ctx.config?.projects["sprintBoard"], 11);
  assertEquals(ctx.guidance, null);
});

/**
 * ユースケース: identities 欠落時に対象外として扱うこと
 * 検証意図: 対応表なしでは特定できず検証スキップ
 */
Deno.test("resolveAccountContext: identities 欠落時は未解決を返す", () => {
  const ctx: AccountContext = resolveAccountContext({
    gitRemoteUrl: () => "https://github.com/MyOrg/MyRepo.git",
    identitiesText: () => null,
    harnessRcPath: () => null,
    readHarnessRc: () => "",
    ghStatus: () => ({ code: 0, stdout: "my-account", stderr: "" }),
  });
  assertEquals(ctx.accountName, null);
  assertEquals(ctx.verified, false);
  assertEquals(ctx.guidance, null);
});

/**
 * ユースケース: gh 未認証を解決経路で伝播すること
 * 検証意図: 特定成功＋gh 失敗時は認証誘導が返る
 */
Deno.test("resolveAccountContext: gh 失敗時は誘導を伝播する", () => {
  const ctx: AccountContext = resolveAccountContext({
    gitRemoteUrl: () => "https://github.com/MyOrg/MyRepo.git",
    identitiesText: () => IDENTITIES_MD,
    harnessRcPath: () => null,
    readHarnessRc: () => "",
    ghStatus: () => ({ code: 1, stdout: "", stderr: "not logged in" }),
  });
  assertEquals(ctx.accountName, "my-account");
  assertEquals(ctx.verified, false);
  assertStringIncludes(ctx.guidance ?? "", "gh auth login");
});

/**
 * ユースケース: 特定成功・設定不在の組合せを解決できること
 * 検証意図: AC1成功・AC2失敗時も accountName は維持される
 */
Deno.test("resolveAccountContext: 設定不在時もアカウントは維持する", () => {
  const ctx: AccountContext = resolveAccountContext({
    gitRemoteUrl: () => "https://github.com/MyOrg/MyRepo.git",
    identitiesText: () => IDENTITIES_MD,
    harnessRcPath: () => null,
    readHarnessRc: () => "",
    ghStatus: () => ({ code: 0, stdout: "my-account", stderr: "" }),
  });
  assertEquals(ctx.accountName, "my-account");
  assertEquals(ctx.config, null);
  assertEquals(ctx.verified, true);
});
