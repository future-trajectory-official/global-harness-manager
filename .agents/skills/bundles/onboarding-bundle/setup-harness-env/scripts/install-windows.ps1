$ErrorActionPreference = "Stop"
$HarnessRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))
$BinDir = Join-Path $HarnessRoot "bin"
$DenoTarget = "x86_64-pc-windows-msvc"

if (-Not (Test-Path $BinDir)) { New-Item -ItemType Directory -Force -Path $BinDir | Out-Null }
$DenoExe = Join-Path $BinDir "deno.exe"

if (-Not (Test-Path $DenoExe)) {
    Write-Host "Downloading Deno ($DenoTarget)..."
    $DenoZip = Join-Path $BinDir "deno.zip"
    Invoke-WebRequest -Uri "https://github.com/denoland/deno/releases/download/v2.0.2/deno-${DenoTarget}.zip" -OutFile $DenoZip
    Expand-Archive -Path $DenoZip -DestinationPath $BinDir -Force
    Remove-Item $DenoZip
}

Write-Host "Starting Deno setup..."
$SetupScript = Join-Path $HarnessRoot ".agents\skills\setup-harness-env\scripts\setup.ts"
& $DenoExe run -A $SetupScript
