---
name: identify-session-task
description: バックログを読み解き、本セッションで取り組むべき唯一のタスクを特定する。
---

# Task Identification Skill

Scrum Master
が、プロダクトバックログの優先順位に基づき、迷走を防ぐための「最小単位のタスク」を決定するためのスキルです。

## インストラクション

1. **バックログの分析**:
   - `[product-backlog.md](file://.agents/management/product-backlog.md)` の `[TODO]` または `[WIP]`
     セクションを読み込みます。
2. **依存関係の考慮**:
   - 前回のセッションの成果（`RECOVERY LOG` 等）から、次に着手すべき論理的なステップを導き出します。
3. **タスクの提示**:
   - 以下の形式でタスクを提示してください。

```markdown
### [Session Task Identification]

- **対象PBI**: [Epic/Feature] / [PBI名]
- **特定されたタスク**: [1つに絞り込まれた具体的なタスク内容]
- **受け入れ基準 (AC)**: [PBIから該当するACを抜粋]
- **最適な担当ロール**:
  [タスクの性質（設計、インフラ構築、テスト等）から、その時点で最もふさわしい専門家（例の盲目的なコピーではなく、文脈に沿って動的にアサインすること）]
```
