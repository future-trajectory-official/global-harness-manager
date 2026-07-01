---
description: 価値観同期・Work Package特定・戦略策定を段階的に行う高度なセッション開始儀式
---

# セッション開始ワークフロー (/session-start)

本ワークフローは、セッションの開始にあたってプロジェクトビジョンと保有能力を同期し、最適な専門ロールが戦略を策定する「多角的な合議プロセス」を定義します。

---

## 1. 価値観と能力の同期フェーズ

### 1-1. ビジョンと保有スキルの宣言

- **ロール**: `[scrum-master.md](/.agents/rules/scrum-master.md)` (進行役として開始)
- **実行スキル**:
  `[assess-alignment](/.agents/skills/bundles/management-bundle/assess-alignment/SKILL.md)`
- **成果物**: 「Vision & Capability Alignment Report」
- **セルフチェック**:
  - [ ] **[価値基準]** `[VISION.md](/.agents/management/VISION.md)`
        のエッセンスを抽出し、判断基準として宣言したか。
  - [ ] **[能力確認]** 現在のチーム（ロール）と行使可能なスキルを棚卸しし、PO に提示したか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 2. Work Package特定フェーズ

### 2-1. 1セッション1Work Packageの絞り込み

- **ロール**: `[scrum-master.md](/.agents/rules/scrum-master.md)` (優先順位の調整)
- **実行スキル**:
  `[identify-work-package](/.agents/skills/bundles/management-bundle/identify-work-package/SKILL.md)`
- **成果物**: 「Session Task Identification」報告
- **セルフチェック**:
  - [ ] **[1セッション1Work Package]** バックログから、迷走を防ぐための最小単位のWork
        Packageを特定したか。
  - [ ] **[アサイン]**
        次の設計フェーズを担当する**最適な専門家**を指名し、**「ここから先は～に委譲します」と明示的に宣言したか。**

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 3. 戦略策定（セッション計画）フェーズ

### 3-1. 専門家による詳細設計

- **ロール**: 指名された専門家
- **実行スキル**:
  `[session-planning](/.agents/skills/bundles/management-bundle/session-planning/SKILL.md)`
- **成果物**: `implementation_plan.md` (アーティファクト) `task.md` (アーティファクト)
- **セルフチェック**:
  - [ ] **[役割宣言]** 委譲を受けた直後に、自身のロールを改めて宣言したか。
  - [ ] **[Decision-Action Separation]**
        実装ステップを詳細に定義し、AIが独断で書き換えを開始しない「ガードレール」を設けたか。

**停止指示**: 次のステップの内容を先読みして実行してはならない。PO の次の指示を待て。

<!-- STOP -->

---

## 4. 合意と承認フェーズ

### 4-1. 計画の承認と WIP 更新

- **ロール**: `[scrum-master.md](/.agents/rules/scrum-master.md)` (最終確認)
- **セルフチェック**:
  - [ ] **[POの承認]** 実装計画（アーティファクト）に対し、PO からの最終合意を得たか。
  - [ ] **[ステータス管理]** **POの承認を得た後**にはじめて、バックログを `[WIP]` に更新したか。
  - [ ] **[ハンドオフ]** 実装ワークフロー（例：`/develop-work-package` や
        `/refactoring`）へ迷いなく移行できる準備が整ったか。

<!-- STOP -->
