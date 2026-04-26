# Reference: Cross-Platform Reset Commands

環境に応じたコンテキスト退避用のコマンドリファレンスです。

## 1. Linux / macOS / WSL (Bash)
現在の主要な実行環境です。

```bash
TARGET_ROOT="$HOME/.gemini/antigravity"
BACKUP_DIR="/tmp/antigravity_context_$(date +%s)"
mkdir -p "$BACKUP_DIR"

for dir in brain knowledge conversations; do
  if [ -d "$TARGET_ROOT/$dir" ]; then
    mv "$TARGET_ROOT/$dir" "$BACKUP_DIR/"
    mkdir -p "$TARGET_ROOT/$dir"
  fi
done
```

## 2. Windows (PowerShell)
ネイティブな Windows 環境で実行する場合に使用します。

```powershell
$TargetRoot = "$env:USERPROFILE\.gemini\antigravity"
$Timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$BackupDir = Join-Path $env:TEMP "antigravity_context_$Timestamp"
New-Item -ItemType Directory -Force -Path $BackupDir

foreach ($dir in @("brain", "knowledge", "conversations")) {
    $Source = Join-Path $TargetRoot $dir
    if (Test-Path $Source) {
        Move-Item -Path $Source -Destination $BackupDir -Force
        New-Item -ItemType Directory -Force -Path $Source
    }
}
```
