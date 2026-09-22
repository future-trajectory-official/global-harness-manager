/**
 * 呼出元リポジトリのアカウント識別ヘルパー。
 *
 * グローバル配布（`~/.harness`）したスクリプトは、呼出元リポジトリの git 設定
 * （remote URL）から owner/repo を抽出し、`config/identities.md` の対応表と
 * 照合して Account Name を特定する。
 * 識別子の正は identities.md の Account Name とし、`gh auth` 状態の検証は
 * 別モジュールが担う（plan.md 設計判断）。
 *
 * 本モジュールは純関数で実装し、テスト容易性を保つ。remote URL の抽出パターンは
 * `gateway/plan-gateway-adapter.ts` の `handleScopeResolve` と共有する
 * （本関数が正の抽出器。adapter 側は本関数を利用し、非GitHub SSH の
 * フォールバックのみ自前で保持する）。github.com 系のみ対象で、
 * Enterprise 等の非GitHub ホストは対象外とする。
 */

/** git remote URL から抽出した owner/repo。 */
export interface RepoScope {
  /** GitHub のオーナー（Organization または個人アカウント）名。 */
  readonly owner: string;
  /** リポジトリ名。 */
  readonly repository: string;
}

/** identities.md から読み取った Repository と Account Name の組。 */
export interface IdentityEntry {
  /** リポジトリの remote URL（`Repository` フィールド値）。 */
  readonly repositoryUrl: string;
  /** GitHub アカウント識別子（`Account Name` フィールド値）。 */
  readonly accountName: string;
}

/**
 * git remote URL から owner/repo を抽出する（純関数）。
 *
 * SSH 形式（`git@github.com:owner/repo.git`）と HTTPS 形式
 * （`https://github.com/owner/repo[.git]`）に対応する。
 *
 * @param remoteUrl `git remote get-url origin` の出力文字列
 * @returns 抽出した owner/repo。対象外の場合は null
 */
export function parseGitRemoteUrl(remoteUrl: string): RepoScope | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;
  const matched = trimmed.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!matched) return null;
  return { owner: matched[1], repository: matched[2] };
}

/**
 * identities.md 形式の文字列から対応表を読み取る（純関数）。
 *
 * `## <プロジェクト名>` セクション配下の `- **Repository**: ...` と
 * `- **Account Name**: ...` の組を抽出する。バッククォート囲みは除去する。
 *
 * @param markdown identities.md の本文
 * @returns Repository と Account Name の組の一覧
 */
export function parseIdentities(markdown: string): IdentityEntry[] {
  const entries: IdentityEntry[] = [];
  const sections = markdown.split(/^##\s+/m).slice(1);
  for (const section of sections) {
    const repo = section.match(/-\s+\*\*Repository\*\*:\s*`?([^`\n]+)`?/)?.[1]?.trim();
    const account = section.match(/-\s+\*\*Account Name\*\*:\s*`?([^`\n]+)`?/)?.[1]?.trim();
    if (repo && account) {
      entries.push({ repositoryUrl: repo.replace(/^`|`$/g, ""), accountName: account });
    }
  }
  return entries;
}

/**
 * git remote URL に対応する Account Name を特定する（純関数）。
 *
 * remote 側の owner/repo と、対応表側の Repository の owner/repo を比較する
 * ため、SSH/HTTPS の表記揺れを吸収できる。GitHub の owner/repo は
 * 大文字小文字を区別しないため、比較前に小文字化する。
 *
 * @param remoteUrl `git remote get-url origin` の出力文字列
 * @param identities `parseIdentities` の出力
 * @returns 特定した Account Name。対象外の場合は null
 */
export function identifyAccount(
  remoteUrl: string,
  identities: IdentityEntry[],
): string | null {
  const scope = parseGitRemoteUrl(remoteUrl);
  if (!scope) return null;
  const owner = scope.owner.toLowerCase();
  const repository = scope.repository.toLowerCase();
  for (const entry of identities) {
    const entryScope = parseGitRemoteUrl(entry.repositoryUrl);
    if (
      entryScope &&
      entryScope.owner.toLowerCase() === owner &&
      entryScope.repository.toLowerCase() === repository
    ) {
      return entry.accountName;
    }
  }
  return null;
}
