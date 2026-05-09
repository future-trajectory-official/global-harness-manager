---
name: skill-optimizer
description: 実行ログを分析し、スキルの発見性（CSO）を向上させるために説明文やタグを自動改善します。
tags:
  trigger:
    - optimize-skills
    - improve-discovery
    - post-session-cleanup
  category: meta
  constraints: requires-session-logs
---

# skill-optimizer

Antigravity の「履歴管理・分析能力」を活用し、スキルの説明文（description）や CSO タグを、実際の利用文脈に合わせて最適化します。

## プロセス

1. **ログの収集と分析**
   - 過去の `overview.txt` やセッションログから、以下のパターンを抽出します。
     - エージェントがスキルの選択に迷った（複数のスキルを検討したが失敗した）シーン。
     - ユーザーが「○○して」と指示したが、適切なスキルが見つからず手動でコマンドを打ったシーン。
     - スキルの呼び出し引数が不適切でエラーになったシーン。

2. **キーワードの抽出**
   - 失敗したシーンにおけるユーザーの要求語彙、エラーメッセージ、およびコンテキストを特定します。

3. **SKILL.md の更新**
   - 特定したキーワードを、対象スキルの `description` や `tags.trigger` に追加します。
   - `description` は、単なる機能説明ではなく「エージェントがどのような時にこのファイルを読むべきか」という視点で書き換えます。

## 使用例

「`stateless-reset` という言葉を知らないユーザーが『履歴を消して最初からやり直したい』と言ったが、エージェントが反応できなかった」というログを見つけた場合：
- `stateless-reset/SKILL.md` の `trigger` に `clear-history` を追加。
- `description` に「履歴を消してやり直したい時」というフレーズを追加。

## 注意事項

- 原型の機能を損なうような大幅な書き換えは行わない。
- ユーザーの意図をハルシネーションしないよう、必ずログの事実に基いて改善する。
