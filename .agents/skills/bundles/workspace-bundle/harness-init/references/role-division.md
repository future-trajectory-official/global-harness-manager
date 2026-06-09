# 役割分担: harness-init vs harness-clone

## harness-init

- **責務**: GitHub上に新規リポジトリを作成する
- **入力**: `config/identities.md`
- **出力**: GitHub上の空リポジトリ（README付き）
- **後続処理**: 呼び出し元ワークフローが `git clone` → `harness-attach` を実行する

## harness-clone

- **責務**: 既存リポジトリをクローンし、`harness-attach` を実行する
- **入力**: リポジトリURL
- **出力**: ローカルにクローンされたリポジトリ（harness-attach済み）

## 共通パス

プロジェクトセットアップワークフローでは、新規・既存いずれの場合も 以下の共通パスに合流する：

```
[新規] harness-init → git clone → harness-attach → publish-rules → publish-skills
[既存]                git clone → harness-attach → publish-rules → publish-skills
```

`harness-init` と `harness-clone` は責務が排他的であり、
同じプロジェクトで両方を実行することはない。
