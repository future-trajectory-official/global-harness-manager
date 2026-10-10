---
description: 新規プロジェクト発足と既存プロジェクト参加の両方を統合し、リポジトリ準備からプロセス統一までの一貫したセットアップを行うワークフロー。
subtask: false
---

# /project-setup — プロジェクトセットアップワークフロー

本ワークフローは、プロジェクトのリポジトリを準備し、ハーネス資源をプロジェクトに適用する。
完了後、`/kickoff` によるプロジェクト立ち上げが可能になる。

---

## 1. フェーズA: リポジトリ準備 (Repository Preparation)

**責務**: 仕事の情報を管理するリポジトリを確保し、GitHubとの通信経路を確立する。 **ロール**:
本フェーズの全ステップは `[platform-engineer.md](/.opencode/agents/platform-engineer.md)`
(すべての制約を遵守) で実行すること。

### 1-1. ホスト環境構築

- **実行スキル**:
  `[setup-harness-env](/.opencode/skills/bundles/workspace-bundle/setup-harness-env/SKILL.md)`
- **スキップロジック**: `deno --version` および `gh --version` が正常終了する場合はスキップ可能。
- **セルフチェック**:
  - [ ] deno および gh が利用可能であることを確認したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

### 1-2. 前提要件チェック

- **実行スキル**:
  `[check-harness-configs](/.opencode/skills/bundles/workspace-bundle/check-harness-configs/SKILL.md)`
- **セルフチェック**:
  - [ ] 必要な設定ファイルが存在し、記入内容が正しいか。
  - [ ] `config/identities.md` から対象アカウントが特定できたか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

### 1-3. 認証設定

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
  3. 以下のコマンドを実行し、`project` スコープを追加する（Projects V2 操作に必須）：
     ```
     gh auth refresh -s project
     ```
     ブラウザが開き OAuth 認証を求められるため、画面上の指示に従って承認すること。
- **セルフチェック**:
  - [ ] `identities.md` に記載のアカウントで `gh auth status` が正常終了することを確認したか。
  - [ ] `gh auth status` の出力に `project` が含まれていることを確認したか（Projects V2
        操作に必須）。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

### 1-4. SSH鍵の生成と登録

- **実行スキル**:
  `[manage-git-identity](/.opencode/skills/bundles/workspace-bundle/manage-git-identity/SKILL.md)`
- **後続手順**: SSH鍵生成後、`gh ssh-key add` により公開鍵をGitHubに自動登録する。
- **セルフチェック**:
  - [ ] SSH公開鍵がGitHubに登録されていることを確認したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

### 1-5. リポジトリの確保

- **手順**:

  1. `gh repo view <owner>/<repo> --json name` を実行し、終了コードでリポジトリの存在を判定する。
     - 成功（リポジトリ既存）→ 手順 2 へ
     - 失敗（リポジトリ不在）→ PO に以下の確認を行う：
       ```
       リポジトリ '<owner>/<repo>' は存在しません。新規に作成しますか？ [y/N]

       - リポジトリ名のスペルミスが無いかご確認ください。
       - N を選択した場合、ワークフローを中断します。
       ```
       PO の承認後: `[harness-init](/.opencode/skills/bundles/workspace-bundle/harness-init/SKILL.md)`
       を実行
     - 権限エラー等 → PO に状況を説明し、指示を仰ぐ

  2. リポジトリをローカルにクローンする。
     - **実行スキル**:
       `[harness-clone](/.opencode/skills/bundles/workspace-bundle/harness-clone/SKILL.md)`
     - **備考**: `harness-clone` はクローン後に `harness-attach` を内部実行する。
     - **セルフチェック**:
       - [ ] クローンが正常に完了し、git config が設定されているか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

---

## 2. フェーズB: プロセス統一 (Process Standardization)

**責務**: ハーネス資源をプロジェクトに適用する。加えてGitHub Project V2のボード・設定を構築し、一貫性のある開発プロセスを確立する。
**ロール**: 本フェーズの全ステップは
`[platform-engineer.md](/.opencode/agents/platform-engineer.md)` (すべての制約を遵守)
で実行すること。

### 2-1. ハーネス資源の配布

- **実行スキル**:
  `[distribute-harness](/.opencode/skills/bundles/workspace-bundle/distribute-harness/SKILL.md)`
- **手順**: スキルの使用方法に従い、`--dry-run` → `--dest` 実配布 → 配布後除外の順に実行する（詳細はスキル側が正）。
- **セルフチェック**:
  - [ ] スキル側の合否基準を満たすこと（詳細・合否基準は distribute-harness スキル側が正）。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

### 2-2. ボード構築と設定生成

- **実行スキル**:
  `[setup-github-projects](/.opencode/skills/bundles/workspace-bundle/setup-github-projects/SKILL.md)`
- **手順**: スキルの使用方法に従い、boards → fields → labels → link → harnessrc
  の順に実行する（詳細はスキル側が正）。
  harnessrc 生成と同時に同一ディレクトリへ2行の `.gitignore`
  （`.harnessrc`＋`.gitignore` 自身）が併置されること（WP#786 AC-1）。
- **入力**: `1-5. リポジトリの確保` で確定した `<owner/repo>`。
- **実行場所**: ハーネス側リポジトリで実行する（ハーネス資源配布（2-1）とは独立に実行可能なため、本ステップを `2-3` より前に配置する）。
- **前提条件**: `1-3. 認証設定` で `project` スコープが付与済みであること（確認: `gh auth status` の出力に `project` が含まれること）。
- **セルフチェック**:
  - [ ] 3ボード (productBacklog/sprintBoard/retrospectiveBoard) が利用可能か（例: `gh project view <番号> --owner <owner>` の成功）。
  - [ ] 8件のtype:*ラベルが対象リポジトリに存在するか（例: `gh label list --repo <owner/repo>`）。
  - [ ] `.harnessrc` が生成されているか（`.github/schemas/.harnessrc` の存在と `projects` キーの有無）。
  - [ ] 同階層の `.gitignore` が2行（`.harnessrc`＋`.gitignore`）であるか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

### 2-3. 通信経路の疎通確認

- **手順**:
  1. 1-4 で設定したSSHエイリアスを用いてSSH通信を確認する。
  2. `gh auth status` を実行し、認証状態を確認する。
- **セルフチェック**:
  - [ ] SSH通信が正常に確立されているか。
  - [ ] GitHub認証が有効であるか。
  - [ ] `/kickoff` ワークフローが開始可能な状態であるか。

<!-- SSoT: 停止前に .session/task.md を更新すること -->
<!-- STOP -->

---

## 遵守事項

- ワークフロー内の STOP マーカーと停止指示は Opencode の機能ではなく AI への指示表記である。到達点で必ず報告し、PO の明示的な指示があるまで次のフェーズを先読みしない。
- 手順の単一の正は本ファイルである。コマンドは呼び出し側の手順（実行順序・状態遷移）のみを表現し、各実行スキルの内部操作（手順・コマンド・JSON形式）には踏み込まない。
- 並行実行を要する個所では該当スキル側がサブエージェントの作成・実行を明示的に行う。コマンド自身はサブエージェントを起動せず、本ファイルの手順進行に専念する。
- **SSoT更新規律**: STOPゲート到達時は、報告・停止する前に必ず `.session/task.md`
  を最新の状態に更新すること。更新なき停止は規律違反とする。各STOP直前のマーカー行は想起用であり、正は本条である。ただしセッション終了時のクリーンアップ後の最終ゲートは例外とする（成果はGitHubへ記録済み）。
