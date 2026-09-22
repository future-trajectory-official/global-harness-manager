import { assertEquals } from "@std/assert";
import { identifyAccount, parseGitRemoteUrl, parseIdentities } from "./account-identifier.ts";

/**
 * ユースケース: SSH 形式の remote URL から owner/repo を抽出すること
 * 検証意図: `git@github.com:owner/repo.git` が { owner, repo } に分解される
 */
Deno.test("parseGitRemoteUrl: SSH 形式を owner/repo に分解する", () => {
  assertEquals(
    parseGitRemoteUrl("git@github.com:future-trajectory-official/global-harness-manager.git"),
    {
      owner: "future-trajectory-official",
      repository: "global-harness-manager",
    },
  );
});

/**
 * ユースケース: HTTPS 形式の remote URL から owner/repo を抽出すること
 * 検証意図: `.git` 有無の両形式が同一結果になる
 */
Deno.test("parseGitRemoteUrl: HTTPS 形式（.git 有無）を owner/repo に分解する", () => {
  assertEquals(parseGitRemoteUrl("https://github.com/octocat/hello-world.git"), {
    owner: "octocat",
    repository: "hello-world",
  });
  assertEquals(parseGitRemoteUrl("https://github.com/octocat/hello-world"), {
    owner: "octocat",
    repository: "hello-world",
  });
});

/**
 * ユースケース: 対象外の remote URL を除外すること
 * 検証意図: 非 GitHub URL・空文字は null になる
 */
Deno.test("parseGitRemoteUrl: 対象外は null を返す", () => {
  assertEquals(parseGitRemoteUrl("git@gitlab.com:owner/repo.git"), null);
  assertEquals(parseGitRemoteUrl(""), null);
  assertEquals(parseGitRemoteUrl("https://github.com/owner"), null);
});

/**
 * ユースケース: 前後空白付きの remote URL を受け付けること
 * 検証意図: get-url 生出力の末尾改行があっても分解される
 */
Deno.test("parseGitRemoteUrl: 前後空白を除去して分解する", () => {
  assertEquals(parseGitRemoteUrl("  git@github.com:owner/repo.git\n"), {
    owner: "owner",
    repository: "repo",
  });
});

/**
 * ユースケース: identities.md 形式の文字列から対応表を読み取ること
 * 検証意図: Repository と Account Name の組が抽出される
 */
Deno.test("parseIdentities: Repository と Account Name の組を抽出する", () => {
  const md = [
    "## マイリポジトリ",
    "",
    "- **Repository**: `git@github.com:MyOrg/MyRepo.git`",
    "- **Account Name**: `my-account`",
    "",
    "## 別プロジェクト",
    "",
    "- **Repository**: `git@github.com:OtherOrg/OtherRepo.git`",
    "- **Account Name**: `other-account`",
    "",
  ].join("\n");
  assertEquals(parseIdentities(md), [
    { repositoryUrl: "git@github.com:MyOrg/MyRepo.git", accountName: "my-account" },
    { repositoryUrl: "git@github.com:OtherOrg/OtherRepo.git", accountName: "other-account" },
  ]);
});

/**
 * ユースケース: git remote から Account Name を特定すること
 * 検証意図: remote の owner/repo と一致するエントリのアカウントが返る
 */
Deno.test("identifyAccount: remote に対応する Account Name を返す", () => {
  const identities = [
    { repositoryUrl: "git@github.com:MyOrg/MyRepo.git", accountName: "my-account" },
    { repositoryUrl: "git@github.com:OtherOrg/OtherRepo.git", accountName: "other-account" },
  ];
  assertEquals(
    identifyAccount("git@github.com:OtherOrg/OtherRepo.git", identities),
    "other-account",
  );
  assertEquals(
    identifyAccount("https://github.com/MyOrg/MyRepo.git", identities),
    "my-account",
  );
});

/**
 * ユースケース: 表記揺れがあっても同一リポジトリと判定すること
 * 検証意図: GitHub の owner/repo は大文字小文字を区別しない
 */
Deno.test("identifyAccount: 大文字小文字の違いを吸収する", () => {
  const identities = [
    { repositoryUrl: "git@github.com:MyOrg/MyRepo.git", accountName: "my-account" },
  ];
  assertEquals(
    identifyAccount("https://github.com/myorg/myrepo.git", identities),
    "my-account",
  );
});

/**
 * ユースケース: 対応表に存在しないリポジトリを除外すること
 * 検証意図: 不一致・空表・不正 remote は null になる
 */
Deno.test("identifyAccount: 対象外は null を返す", () => {
  const identities = [
    { repositoryUrl: "git@github.com:MyOrg/MyRepo.git", accountName: "my-account" },
  ];
  assertEquals(identifyAccount("git@github.com:Unknown/Repo.git", identities), null);
  assertEquals(identifyAccount("git@github.com:MyOrg/MyRepo.git", []), null);
  assertEquals(identifyAccount("", identities), null);
});
