---
name: assess-context
description: 用語集を読み、要約して、AI と人間が共通の言語で話せるようにする。
tags:
  - trigger: assess-context
  - trigger: context-check
  - trigger: terminology-check
  - category: management
---

# assess-context

AI と人間が共通の言語で話せるよう、ハーネスの管理概念とプロジェクト固有の用語を読み、要点を
要約して提示する。これにより、セッション中の用語解釈の齟齬を防ぐ。

## 入力（前提）

- `.agents/context/management.md` … ハーネスの管理概念。
- `.agents/context/product.md` …
  プロジェクト固有の用語。**未存在でもよい**（その場合はプロジェクト固有の用語は「未定義」扱い）。
- ※ `.agents/context/product.md.example`（構造見本）は読まない。

## 出力（実現すること）

- 読み取った用語を出典（管理概念 / プロジェクト固有の用語）ごとに要約して提示する。
- `product.md` が未存在の場合は「未定義」と明示する。
- 提示した語彙を共有言語として宣言し、PO に確認を促す。

## 実行手順

1. `Read` で `.agents/context/management.md` を読み込む。続けて `.agents/context/product.md`
   を**存在する場合のみ**読み込む（未存在なら読み込みをスキップし「未定義」として扱う）。
2. `references/reads.md` の規則に従い、用語を出典ごとに整理して要約・提示する。
   同リファレンスにのみ定義される「表示見出し」「未定義の場合の表現」「用語の出典」
   「要約結果の永続化先」を**必ず出力に含めること**。これらを欠いた出力は不成立となる。
3. PO に共有する言語として確認を促す。

## セッション中の扱い

- 本用語集（`.agents/context/management.md` /
  `.agents/context/product.md`）を**照合先**とする。セッションが
  長くなりコンテキストが圧縮された後など、用語が曖昧になった場合は必要に応じて再参照する。
- 用語の解釈が曖昧な場合は、用語集の**正式な用語名**を PO
  に示し、「この概念・考え方でよいか」と確認を取る。
