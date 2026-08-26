---
name: maintain-context
description: プロジェクト固有の用語集（product.md）へ用語を追加・変更する編集スキル。不変の管理概念（management.md）を守るガードを含む。
tags:
  - trigger: maintain-context
  - trigger: edit-product-md
  - trigger: terminology-edit
  - category: management
---

# maintain-context

AI がプロジェクト固有の用語集 `product.md` に、固有用語を追加・変更するための編集スキル。 読み込み系
`assess-context` と対をなし、不変の管理概念 `management.md` を決して変更しないことを最優先とする。

## 入力（前提）

- `.agents/context/product.md` … 編集対象（利用者編集・git追跡対象外）。
- `.agents/context/management.md` … 参照のみ。**編集禁止**。
- `.agents/context/product.md.example` … 構造見本。**編集対象外**。

## 出力（実現すること）

- `product.md` へプロジェクト固有の用語を追加・変更した状態。`management.md` は不変。

## 実行手順

> **必須リファレンス**: 本スキルは `references/edits.md`
> を唯一の編集規則（編集対象・対象外の分類、編集の作法、`management.md`
> 不変ガード、編集後検証）として参照する。**`references/edits.md`
> を読まない限り、編集対象の判断・編集方法・ガードを実行できない**。リファレンスを無視した編集を禁止する。

1. 編集を始める前に `references/edits.md` を**必ず読む**。これを読まずに編集を開始してはならない。
2. `references/edits.md` の規則に従い、編集対象・対象外を確認してから `product.md` を編集する。
3. 編集後、`references/edits.md` のガード検証手順に従い、`management.md`
   に差分がないことを検証する。

## セッション中の扱い

- 編集対象の用語解釈が曖昧な場合は、用語集の正式な用語名を PO
  に示し、「この概念・考え方でよいか」と確認を取る。
