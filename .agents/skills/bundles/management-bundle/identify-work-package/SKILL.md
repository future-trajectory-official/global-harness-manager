---
name: identify-work-package
description: バックログを読み解き、本セッションで取り組むべき唯一のWork Packageを特定する。
---

# Task Identification Skill

Scrum Master が、プロダクトバックログの優先順位に基づき、迷走を防ぐための「最小単位のWork
Package」を決定するためのスキルです。

## インストラクション

1. **バックログの分析**:
   - `[product-backlog.md](/.agents/management/product-backlog.md)` の `[TODO]` または `[WIP]`
     セクションを読み込みます。
2. **依存関係の考慮**:
   - 前回のセッションの成果（`RECOVERY LOG` 等）から、次に着手すべき論理的なステップを導き出します。
3. **初期見積もりの算出**:
   - Work
     Package選択にあたり、[backlog-guidelines.md](/.agents/management/backlog-guidelines.md#221-Work-Packageの見積り基準-effort--人間の介入回数)
     に基づいて「初期見積もり（想定介入回数）」および「見積もり理由・懸念点」を検討します。
4. **Work Packageの提示**:
   - 以下の形式でWork Packageを提示してください。

```markdown
### [Session Task Identification]

- **対象PBI**: [Epic/Feature] / [PBI名]
- **特定されたWork Package**: [1つに絞り込まれた具体的なWork Package内容]
- **受入基準 (AC)**: [PBIから該当するACを抜粋]
- **初期見積もり（想定介入回数）**: [想定される介入回数]
- **見積もり理由・懸念点**: [Work
  Package自体の曖昧さや難易度、および介入が発生すると予想される箇所・不確実性の理由]
- **最適な担当ロール**: [Work
  Packageの性質（設計、インフラ構築、テスト等）から、その時点で最もふさわしい専門家（例の盲目的なコピーではなく、文脈に沿って動的にアサインすること）]
- **レビュー推奨ロール**: [計画策定時に推奨される追加の検討視点（例: Architect, Tester,
  Devils-Advocate）。主担当ロール以外にどの視点が有用かを明示。複数指定可。]
```
