# Global Harness Manager

プロンプトやコンテキストを超え、AIエージェントの振る舞い・スキル・およびプロジェクトの「権限境界」をシステムレベルで統制する、グローバル管理リポジトリ（制御ハーネス）です。

## 思想と目的 (Harness Engineering)

本リポジトリは、以下の思想に基づいて構築されています。

1. **ポータビリティと衛生管理:**
   OSのユーザーディレクトリを汚染せず、スタンドアロンなツール（`gh`バイナリ等）と相対パスを用いて、クリーンな再現性を提供します。
2. **アイデンティティ（アカウント）の物理的隔離:**
   複数のプロジェクト・複数のGitHubアカウントが混在する環境において、設定ミスによる「誤送信（誤プッシュ）」を物理的（SSHエイリアスと個別の公開鍵）に遮断します。
3. **グローバルスキルの供給:**
   複数のプロジェクトから参照可能な共通の `Skills`、`Rules`、`Workflows` を提供し、エージェントのパフォーマンスを一貫して引き上げます。

---

## 初期セットアップ

本リポジトリを導入する環境（新しいWSLなど）で、最初に一度だけ行う手順です。

### 1. 管理対象スキルの設定と初期化
Antigravity に認識させるスキルパスを設定し、制御に必要なバイナリを導入します。

```bash
# 設定ファイルの作成（雛形のコピー）
cp config/global-skills-path.txt.example config/global-skills-path.txt

# テキストエディタを開き、登録したいディレクトリの相対パス/絶対パスを記述
nano config/global-skills-path.txt

# ハーネスの初期化
./scripts/initialize-harness.sh
```
> [!NOTE] 
> スクリプトは `jq` などの外部ツールに依存しません。パスの反映やスタンドアロン `gh` の導入・パス通し（`~/.bashrc`）まで自動で行われます。

---

## マルチアカウント管理とプロジェクト保護

プロジェクトごとに別々の GitHub アカウントを安全に使い分けるための運用フローです。

### 1. アイデンティティの宣言と鍵の生成
`config/identities.txt` にアカウント情報を記述し、一括で安全な SSH 鍵（Ed25519）を生成します。

```bash
# 設定ファイルの作成
cp config/identities.txt.example config/identities.txt

# フォーマットに従い [アカウント名],[メールアドレス] を記述
nano config/identities.txt

# 鍵と SSH Config の一括生成・点検
./scripts/add-identity.sh
```
> [!IMPORTANT]
> スクリプトの出力に従い、生成された各公開鍵を **それぞれ正しいアカウントでログインし直してから** GitHub に登録してください。

### 2. プロジェクトへのハーネス装着（Attach）
特定のプロジェクトを、指定したアカウント「専用」の通信経路に固定（隔離）します。

```bash
# 使用法: ./scripts/harness-attach.sh <アカウント名> <プロジェクトパス>
./scripts/harness-attach.sh your-account-name path/to/your/project
```
> [!TIP]
> **物理的な誤爆防止**: リモート URL が `git@github.com-[アカウント名]:...` に強制書き換えられ、プロジェクトごとの `user.name` / `user.email` も固定されます。これにより、意図しないアカウントでの `git push` が通信レベルで拒否されるようになります。

---

## スキルのグローバル同期（Publishing）

ワークスペース（`.agents/skills/`）で開発・調整したスキルを、共通のグローバルディレクトリへ同期して「出版」するフローです。

### 1. 同期対象の選択 (準備)
どのスキルを同期対象にするかを `publish-targets.md` で指定します。

```bash
# 設定ファイルの作成（初回のみ）
cp config/publish-targets.md.example config/publish-targets.md

# 同期したいスキルのフォルダ名を ## 見出しとして記述
nano config/publish-targets.md
```

### 2. エージェントへの同期依頼 (実行)
準備ができたら、Antigravity に対して以下のように依頼してください。

> 「ワークスペースのスキルをグローバルに同期して」

エージェントが管理用スキル（`publish-harness-skills`）を自動的に呼び出し、同期を完了させます。

> [!TIP]
> **手動実行**: コマンドラインから直接同期を行いたい場合は、以下のスクリプトを直接実行することも可能です。
> `./.agents/skills/publish-harness-skills/scripts/publish.sh`

---

## ディレクトリ構成

- `scripts/`: プラットフォームを汚さず、安全な隔離空間を構築する制御エンジン。
  - `initialize-harness.sh` (初期化)
  - `add-identity.sh` (アイデンティティ設定)
  - `harness-attach.sh` (装着・固定)
- `config/`: 認証および環境設定を管理（※実際の `.txt` や `.md` は Git で無視され、ローカルに保護されます）。
  - `publish-targets.md` (スキル同期対象の定義)
- `bin/`: ダウンロードされたスタンドアロンバイナリ等が格納されます。
- `.agents/`: エージェントに供給される専門ツール群（Skills / Rules / Workflows）。
- `.local/`: コミットされない個人的な未完了タスク（Task）やメモを安全に保存するための保護領域。
