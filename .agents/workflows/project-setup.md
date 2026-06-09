---
description: 新規プロジェクト発足と既存プロジェクト参加の両方を統合し、リポジトリ準備からプロセス統一までの一貫したセットアップを行うワークフロー。
---

# プロジェクトセットアップワークフロー (/project-setup)

本ワークフローは、プロジェクトのリポジトリを準備し、AI協働開発のルール・スキルを適用する。
完了後、`/kickoff` によるプロジェクト立ち上げが可能になる。

---

## 1. フェーズA: リポジトリ準備 (Repository Preparation)

**責務**: 仕事の情報を管理するリポジトリを確保し、GitHubとの通信経路を確立する。

### 1-1. ホスト環境構築

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[setup-harness-env](/.agents/skills/bundles/onboarding-bundle/setup-harness-env/SKILL.md)`
- **スキップロジック**: `deno --version` および `gh --version` が正常終了する場合はスキップ可能。
- **セルフチェック**:
  - [ ] deno および gh が利用可能であることを確認したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 1-2. 前提要件チェック

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[check-harness-configs](/.agents/skills/bundles/onboarding-bundle/check-harness-configs/SKILL.md)`
- **説明**: 設定ファイル（`config/identities.md` 等）の有無と状態を検証する。 チェック対象には
  Visibility フィールドを含む。
- **セルフチェック**:
  - [ ] 必要な設定ファイルが存在し、記入内容が正しいか。
  - [ ] `config/identities.md` から対象アカウントが特定できたか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 1-3. 認証設定

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **手順**:
  1. `gh auth status` を実行し、`identities.md` で特定したアカウントで既に認証済みか確認する。
     認証済みの場合は本ステップをスキップ。
  2. 未認証の場合、以下のガイドに従い PO 自身が認証操作を行った後、ワークフローを再開する。
     ```
     GitHub認証が未設定です。以下の手順で <identities.mdに記載のアカウント> で認証を行ってください：

     gh auth login

     表示される指示に従い、OAuth または HTTPS トークンによる認証を完了させてください。
     認証完了後、「次へ」と指示することでワークフローを再開します。
     ```
- **セルフチェック**:
  - [ ] `identities.md` に記載のアカウントで `gh auth status` が正常終了することを確認したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 1-4. SSH鍵の生成と登録

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[manage-git-identity](/.agents/skills/bundles/onboarding-bundle/manage-git-identity/SKILL.md)`
- **後続手順**: SSH鍵生成後、`gh ssh-key add` により公開鍵をGitHubに自動登録する。
- **セルフチェック**:
  - [ ] SSH公開鍵がGitHubに登録されていることを確認したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 1-5. リポジトリの確保

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **手順**: 以下のコマンドでリポジトリの存在を確認する。

```bash
gh repo view <owner>/<repo> --json name > /dev/null 2>&1
```

- exit code 0 → リポジトリが既存 → **1-5-a** へ
- exit code 1 → リポジトリが存在しない → **1-5-b** へ
- exit code その他 → 権限エラー等 → PO に状況を説明し、指示を仰ぐ

#### 1-5-a: 既存リポジトリのクローン

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[harness-clone](/.agents/skills/bundles/onboarding-bundle/harness-clone/SKILL.md)`
- **備考**: `harness-clone` はクローン後に `harness-attach` を内部実行するため、1-6 はスキップする。
- **セルフチェック**:
  - [ ] クローンが正常に完了し、ローカルにリポジトリが存在するか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

#### 1-5-b: 新規リポジトリの作成

- **確認プロトコル**: リポジトリ `<owner>/<repo>` は存在しません。以下の確認を行ってください。
  ```
  リポジトリ '<owner>/<repo>' は存在しません。新規に作成しますか？ [y/N]

  - リポジトリ名のスペルミスが無いかご確認ください。
  - N を選択した場合、ワークフローを中断します。
  ```
- PO の承認を得た後に以下を実行する。

**実行**（PO 承認後）:

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**: `[harness-init](/.agents/skills/bundles/onboarding-bundle/harness-init/SKILL.md)`
- **セルフチェック**:
  - [ ] 新規リポジトリが作成され、`README.md` が存在するか。

**後続手順**（harness-init 完了後）:

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[harness-clone](/.agents/skills/bundles/onboarding-bundle/harness-clone/SKILL.md)`
- **説明**: 作成したリポジトリをローカルにクローンする。 `harness-clone` はクローン後に
  `harness-attach` を内部実行する。
- **セルフチェック**:
  - [ ] クローンが正常に完了し、git config が設定されているか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 2. フェーズB: プロセス統一 (Process Standardization)

**責務**: AI開発のルール・スキルをプロジェクトに適用し、一貫性のある開発プロセスを確立する。

### 2-1. ルールの同期

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[publish-harness-rules](/.agents/skills/bundles/onboarding-bundle/publish-harness-rules/SKILL.md)`
- **セルフチェック**:
  - [ ] `.agents/rules/` がプロジェクトに配信されているか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 2-2. スキルの同期

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **実行スキル**:
  `[publish-harness-skills](/.agents/skills/bundles/onboarding-bundle/publish-harness-skills/SKILL.md)`
- **セルフチェック**:
  - [ ] `.agents/skills/` がプロジェクトに配信されているか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 3. 検証フェーズ

### 3-1. 通信経路の疎通確認

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **手順**:
  1. `ssh -T <1-4で設定したSSHエイリアス>` を実行し、SSH通信を確認する。
  2. `gh auth status` を実行し、認証状態を確認する。
- **セルフチェック**:
  - [ ] SSH通信が正常に確立されているか。
  - [ ] GitHub認証が有効であるか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

### 3-2. セットアップ完了確認

- **ロール**: `[platform-engineer.md](/.agents/rules/platform-engineer.md)` (すべての制約を遵守)
- **セルフチェック**:
  - [ ] `/kickoff` ワークフローが開始可能な状態であるか。

<!-- STOP -->
