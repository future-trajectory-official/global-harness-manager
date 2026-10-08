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

- 用語の解決規則: `<caller>` はスキル実行時CWDのリポジトリ、`<repo>` は本リポジトリを指す。`~` は
  `$HOME` に展開し、絶対パスで `Read` する。 自己実行（CWDが本リポジトリ）の判定はCWD一致で行う。
- `~/.harness/context/management.md` …
  ハーネスの管理概念（グローバル配置・参照専用。配布物に含めない）。 本リポジトリ自身での実行時は
  `<repo>/.github/context/management.md`（正本・版管理）を参照する（正本不在時はグローバル配置にフォールバックする）。
- `<caller>/.github/context/product.md` … 呼出元リポジトリ固有の用語。本リポジトリ自身での実行時は
  `<repo>/.github/context/product.md`
  を参照する。**未存在でもよい**（その場合はプロジェクト固有の用語は「未定義」扱い）。
- 生成テンプレート: 本リポジトリ自身での実行時は `<repo>/.github/context/product.md.example`、
  呼出元リポジトリでの実行時は `~/.harness/context/product.md.example`
  （グローバル配置・参照専用。配布物に含めない。他リポジトリへの配布は廃止）。
  product.md不在時の作成誘導で案内する。テンプレート内記述の旧配置名は matrix の解決先に読み替える。
- ※ 構造見本の直読はしない（見本用語の混入を防ぐ）。
- 呼出元不明時（c-p）は「未定義」とし、呼出元特定を促す。特定後は呼出元解決順序（b-p）を適用する。

## 出力（実現すること）

- 読み取った用語を出典（管理概念 / プロジェクト固有の用語）ごとに要約して提示する。
- `product.md` が未存在の場合は「未定義」と明示する。
- 提示した語彙を共有言語として宣言し、PO に確認を促す。

## 実行手順

1. `Read` で `~/.harness/context/management.md` を読み込む（本リポジトリ自身での実行時は
   `<repo>/.github/context/management.md` 正本。正本不在時はグローバル配置にフォールバックする。
   management.md不在時は異常終了する：本リポジトリ自身では正本必須、呼出元実行では setup-harness-env
   への誘導、呼出元不明ではエラーとして報告する）。続けて `<caller>/.github/context/product.md`
   を**存在する場合のみ**読み込む（未存在なら読み込みをスキップし「未定義」として扱い、
   生成テンプレートを案内する。呼出元不明時は呼出元特定を促し、特定後に呼出元解決順序を適用する）。
2. `references/reads.md` の規則に従い、用語を出典ごとに整理して要約・提示する。
   同リファレンスにのみ定義される「表示見出し」「未定義の場合の表現」「用語の出典」
   「要約結果の永続化先」を**必ず出力に含めること**。これらを欠いた出力は不成立となる。
3. PO に共有する言語として確認を促す。

## セッション中の扱い

- 本用語集（`~/.harness/context/management.md` /
  `<caller>/.github/context/product.md`。本リポジトリ自身での実行時は `<repo>/.github/context/`
  正本）を**照合先**とする。セッションが
  長くなりコンテキストが圧縮された後など、用語が曖昧になった場合は必要に応じて再参照する。
- 用語の解釈が曖昧な場合は、用語集の**正式な用語名**を PO
  に示し、「この概念・考え方でよいか」と確認を取る。
