# account-usage

アカウント取り扱いの参照。

## 正の定義

- アカウント解決: `.opencode/core/shared/account/account-context.ts` （`resolveAccountContext` /
  `verifyGhAuth`）。
- ボード所有者と認証アカウントは別物として扱う （`generate-harnessrc.ts` の `deriveBoardOwner` と
  `resolveRepoAccount` 参照）。

## 解決フロー（WP #763 AC-4）

- 解決の正: `scripts/resolve-target-account.ts` の `resolveTargetAccount`／`resolveOwnerTarget`。
  内部は `account-identifier.ts`（`parseGitRemoteUrl`／`identifyAccount`）と
  `account-context.ts`（`verifyGhAuth`）への委譲のみ（再実装禁止）。
- 手順: remote URL 確定（`--repo` 指定時は合成、未指定時は git remote）→ owner 抽出 → Account Name
  照合 → gh 検証。対象外時は gh 検証をスキップする。
- `create-boards.ts`／`create-fields.ts` は `--repo` （`generate-harnessrc.ts`
  と同名フラグ）で本モジュールと接続する。 `--owner`
  明示時はそれを優先し検証を行わない（後方互換）。

## 不一致時の運用

- `guidance` 非 null（`verified=false`）時は作成を実行せず、誘導文を表示して
  非ゼロ終了する（`--dry-run` を含む）。
- `gh auth switch` の実行はスクリプト内で行わない。PO が誘導文に従い
  `gh auth switch --user <Account Name>` を手動実行してから再試行すること。

## 自動切替の禁止

- gh 認証の不一致時は自動で切り替えない。 `gh auth switch --user <Account Name>` の誘導文を返し、PO
  の操作を待つこと。
