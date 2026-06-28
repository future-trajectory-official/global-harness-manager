---
name: establish-vision
description: リポジトリで開発するプロダクトのビジョンを掲げ、常に確認できる状態にする。
tags:
  - trigger: establish-vision, create-vision, define-vision
  - category: management
---

# establish-vision

リポジトリで開発するプロダクトのビジョンを掲げ、常に確認できる状態にする。
ユーザーとの対話を通じてビジョン要素（対象ユーザー・提供価値・差別化要因・アウトカム）を具体化し、確立する。

## 制約

- Quick-Start の各 Step 間でユーザーの回答を待つこと（先読みして次に進まない）
- 対話中はユーザーの発言を要約してから次の質問に移ること

## Quick-Start

### Step 1: ビジョン要素の収集（対話）

ユーザーとの対話を通じてビジョンの各要素を具体化する。 質問の仕方は
[references/reference.md > ビジョン要素の深掘り質問集](/.agents/skills/bundles/management-bundle/establish-vision/references/reference.md)
を参照すること。

<!-- STOP -->

### Step 2: 確定と実行

収集した情報を
[references/reference.md > 入力 JSON の組み立て](/.agents/skills/bundles/management-bundle/establish-vision/references/reference.md)
の形式にマッピングし、dry-run で内容確認 → ユーザー承認 → 本実行の順で進める。

```bash
# dry-run（事前確認）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/establish-vision/scripts/establish_vision.ts --dry-run

# 本実行（ユーザー承認後）
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/establish-vision/scripts/establish_vision.ts
```
