# Builds the Kermo Windows installer (NSIS) and the portable ZIP on this machine, then writes SHA256SUMS.
# Run from agent_work\repo\source\desktop\scripts (the repo copy is refreshed by tools\sync_repo.ps1).
# ASCII only (Windows PowerShell 5.1). Output: agent_work\release.
param([switch]$SkipClient, [switch]$NoRcedit)
$ErrorActionPreference = 'Continue'
[Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'BelowNormal'
$w = 'C:\Base_1C\MCP_LR_Copy_20261016\agent_work'
$repo = "$w\repo"
$work = "$w\desktop_build"
$rel = "$w\release"
New-Item -ItemType Directory -Force $rel, $work | Out-Null
$log = "$rel\build.log"
Remove-Item $log -ErrorAction SilentlyContinue
function L([string]$m) { ('{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m) | Add-Content $log -Encoding UTF8 }
function Run([string]$cmdline) {
    L ">> $cmdline"
    cmd /c "$cmdline 2>&1" | ForEach-Object { L $_ }
    return $LASTEXITCODE
}

if (-not $SkipClient) {
    L 'building the web client'
    & "$repo\migration\tools\build_client.ps1"
    Get-Content "$w\runtime\client_build.log" -Tail 6 | ForEach-Object { L ('client: ' + $_) }
}
if (-not (Test-Path "$w\client_build\dist\index.html")) { L 'NO CLIENT DIST - abort'; exit 1 }

robocopy "$repo\source\desktop" $work /MIR /XD node_modules client dist /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$w\client_build\dist" "$work\client" /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
Set-Location $work
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

if ((Run 'npm ci --no-audit --no-fund') -ne 0) { L 'NPM CI FAILED'; exit 1 }
$extra = ''
if ($NoRcedit) { $extra = ' -- -c.win.signAndEditExecutable=false' }
$rc = Run ('npm run dist' + $extra)
if ($rc -ne 0) {
    $txt = Get-Content $log -Raw
    if (($txt -match 'symbolic link') -and (-not $NoRcedit)) {
        L 'winCodeSign extraction needs symlinks - retrying without exe resource editing (default Electron icon/version info in Kermo.exe)'
        $rc = Run 'npm run dist -- -c.win.signAndEditExecutable=false'
    }
}
if ($rc -ne 0) { L ('DIST FAILED rc=' + $rc); exit 1 }

$setup = Get-ChildItem "$work\dist" -Filter 'Kermo-Setup-*.exe' | Select-Object -First 1
if (-not $setup) { L 'installer not found in dist'; exit 1 }
Copy-Item $setup.FullName $rel -Force
$ver = (Get-Content "$work\package.json" -Raw | ConvertFrom-Json).version

L 'building the portable ZIP'
$stage = "$work\portable_stage"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory "$stage\Kermo" | Out-Null
robocopy "$work\dist\win-unpacked" "$stage\Kermo" /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
Set-Content "$stage\Kermo\portable.flag" 'portable' -Encoding ASCII
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = "$rel\Kermo-$ver-win-x64-portable.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)

Get-ChildItem $rel -File | Where-Object { $_.Extension -in '.exe', '.zip' } | ForEach-Object {
    '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name
} | Set-Content "$rel\SHA256SUMS.txt" -Encoding ASCII
Get-ChildItem $rel -File | ForEach-Object { L ('artifact: {0} {1:N1} MB' -f $_.Name, ($_.Length / 1MB)) }
L 'DONE'
