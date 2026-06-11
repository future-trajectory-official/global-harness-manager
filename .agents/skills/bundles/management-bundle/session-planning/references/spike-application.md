# スパイクWPのセッション計画への適用方法

本ドキュメントは、`session-planning` スキルがスパイクWP（Spike Work
Package）を検出・考慮するための具体的な手順を定義する。 スパイクWPの概念定義・運用ルールは
[backlog-guidelines.md 2.2.3](/.agents/management/backlog-guidelines.md#223-スパイクwp-spike-work-package)
を参照すること。

## 分岐A: 参照リンクが存在する場合

WPのバックログに `- **参照**: [link-to-spike-report]`
形式の参照リンクが存在する場合、該当リンク先の資料（スパイクWPの調査レポート等）を**必ず読込み**、その内容を計画に反映すること。この参照リンクはスパイクWPの成果物であり、本実装WPの前提条件である。

## 分岐B: 技術的不確実性が認められる場合

Work
Packageに技術的不確実性が認められ、かつスパイクWPが未定義の場合、POに対して以下のように**明示的に提案**すること：

> 本WPは技術的不確実性が高いため、スパイクWP（`WP_N`）として分離することを提案しますか？

スパイクWPのEffort見積は原則1回（1セッション）とする。提案にあたっては `backlog-guidelines.md 2.2.3`
の定義・運用ルールを参照すること。
