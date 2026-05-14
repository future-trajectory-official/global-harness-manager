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

Antigravity の「履歴管理・分析能力」を活用し、スキルの説明文（description）や CSO
タグを、実際の利用文脈に合わせて最適化します。

## 手順

直近のセッションログ（レトロスペクティブ）から反省点を抽出し、それに基づきスキルの記述を改善します。

- **実行詳細**: 詳細な分析プロセスや判断基準、使用例については
  [optimization-process.md](references/optimization-process.md)
  を参照し、その手順に従って改善を実施してください。
