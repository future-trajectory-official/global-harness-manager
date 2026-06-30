---
name: assess-alignment
description: プロジェクトのビジョンと、現在行使可能な能力（ロール・スキル）を確認し、セッションの価値判断基準を整える。
tags:
  - trigger: assess-alignment, alignment-check, capability-check
  - category: management
---

# assess-alignment

プロジェクトのビジョンと、現在のチーム保有能力（ロール・スキル）のアライメントを評価し、 「Vision &
Capability Alignment Report」を出力する。

## 入力形式

```json
{
  "scope": {
    "owner": "my-org",
    "repository": "my-repo"
  }
}
```

`scope` は省略可能。省略時は ConfigGateway により自動解決される。

## Quick-Start

```bash
# dry-run（事前確認）
echo '{}' | deno run -A .agents/skills/bundles/management-bundle/assess-alignment/scripts/assess_alignment.ts --dry-run

# 本実行（PO 承認後）
echo '{}' | deno run -A .agents/skills/bundles/management-bundle/assess-alignment/scripts/assess_alignment.ts
```

## 出力例

```markdown
### Vision & Capability Alignment Report

#### 1. Vision Statement

**Target Audience**: AIを活用したソフトウェア開発の初心者... **Value**:
本リポジトリをクローンし、オンボーディングを実行するだけで... **Differentiator**:
AIを「作業の丸投げ先」にしない点...

#### 2. Available Capabilities

**Roles**:

- **architect**: ユーザー要求から仕様への設計を行う...
- **developer**: 仕様や機能からの実装を行う...

**Skills**:

- **establish-vision**: リポジトリで開発するプロダクトのビジョンを掲げ...
- **session-planning**: 特定されたWork Packageと文脈に最も適した...

---

**Declaration**: 私たちは、上記のビジョンに基づき、保有する専門能力を最大限に活用して...
```

## 制約

- 表示された Plan の内容を PO が確認・承認してから本実行に進むこと
- 出力されたレポートは session-start ワークフローの成果物として利用すること
