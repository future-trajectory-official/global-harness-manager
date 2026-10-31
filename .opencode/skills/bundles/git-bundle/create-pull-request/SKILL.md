---
name: create-pull-request
description: GitHub の Pull Request を作成し、ユーザーへエビデンス付きで解説を行います。
tags:
  - trigger: create-pr
  - trigger: make-pull-request
  - trigger: submit-pr
  - trigger: open-pr
  - category: git
  - constraints: requires-gh-cli, requires-pushed-branch
---

# create-pull-request

GitHub CLI (`gh`)
を活用してプルリクエストを作成し、レビューア（ユーザー）への説明と証拠の提示を行います。

## 手順

1. ブランチがリモートに push されていることを確認する。
2. **[ベースブランチの解決]** PRの宛先は「分岐元」を既定とする。共有スクリプトで解決する。
   ```bash
   deno run -A .opencode/core/shared/git/resolve_base_branch.ts
   # → {"baseBranch":"master","source":"remote-head"}
   ```
   - 出力の `baseBranch` を以降の `<base>` として使う。**`main` を決め打ちしない。**
   - 分岐元と異なる宛先へPRを出す場合（release / LTS / stacked PR 等）は `--base <branch>`
     で明示的に上書きする。
   - `source` が `fallback` のときは分岐元の推定に失敗している。`<base>` を提示して PO
     に宛先を確認すること。
   - 解決結果（`baseBranch` と `source`）は PR 作成前にユーザーへ提示する。`source` が `explicit` /
     `upstream` / `remote-head` 以外（＝推定値）の場合は、宛先が分岐元と
     一致しているかを併せて確認すること。
3. **履歴の確認**: `git log <base>..HEAD`
   （またはベースブランチとの差分）を実行し、今回のブランチに含まれる**すべてのコミット内容**を把握する。
   - ※単一セッションの差分だけでなく、過去のセッションでの変更が含まれていないか必ず確認すること。
4. `gh pr create` コマンドを用いて、現在の作業ブランチから `<base>`
   宛のPRを作成する（`--base <base>` を明示する。省略すると GitHub
   既定のブランチが使われ、分岐元と一致するとは限らない）。
   - **⚠️ 必須要件**: エージェントのハングアップを防ぐため、必ず完全な非対話モードで実行すること。
   - **⚠️ マルチライン本文の必須規約**: 本文に改行が含まれる場合は必ず `--body-file <file>` （または
     `gh api -F body=@<file>`）を使用すること。`--body "...
     ..."`
     へのエスケープ文字組みはシェル依存でリテラル `\n`
     と化けやすく、PR本文が1行に潰れる事故が実測されている（Sprint 21・PR #713
     の介入より）。一時ファイルはリポジトリ外の `/tmp` 配下に置くこと。
   - **⚠️ 禁止: クローズキーワード（`Closes` / `Fixes` / `Resolves`）**: PR本文・PRタイトル・
     コミットメッセージのいずれかに書くと、マージ時に GitHub が対象 Issue を**自動で CLOSED** に
     する（リポジトリ設定で無効化する方法は無い）。ハーネスでは完了判定は
     `complete-work-package`（AC✅化＋`Status=Done`）、クローズはスプリント終了時の
     `archive-product-backlog-items`（`open` かつ `Status=Done` が前提）が担うため、PRでの
     自動クローズはこの前提を壊す（実例: PR #886 が #877 を `Status=In Progress`・AC未✅のまま
     CLOSED にした）。Issue参照は **`Refs #N`** または素の `#N` 言及に留めること。
5. 作成したPR本文にクローズキーワードが残っていないか確認する。
   - `gh pr view <N> --json body --jq '.body' | grep -inE '(clos(e|es|ed)|fix(e|es|ed)|resolv(e|es|ed))[[:space:]]+#[0-9]+'`
   - 検出した場合は `gh pr edit <N> --body-file <修正済みファイル>` で `Refs #N` へ修正する。
6. チャットにて、ユーザーに対して「実装の要点」と「テスト結果」を分かりやすく日本語で解説し、進行の承認（マージのGOサイン）を求める。
   - ※ユーザーがWeb上で直接コードを見なくても判断できるレベルの詳細な要約を提供すること。
7. **証拠画像のチャット表示**
   - 契機: 開発した機能の正しさが視覚的にしか確認できない場合（UI変更など）。
   - 指示:
     PRの解説時に、画像をともなう必要がある場合は、必ず実行結果の証拠画像（PNG/JPG等）をチャットウィンドウに直接表示（`![alt](absolute_path)`
     の形式で埋め込み）して解説すること。
   - 理由: gitignore されている一時ファイル等は GitHub
     上では見られないため、このチャット画面での視覚的共有を最優先する。
