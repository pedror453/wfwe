param([string]$Tag = 'v1', [string]$Shim = '', [switch]$Revert)
# Builds a patched .cf, loads it into a FRESH scratch 8.1 base (never Copymax) and runs the compile matrix there.
# -Revert rewrites the container without the shim: a control run for the container writer.
$base = 'C:\Base_1C\MCP_LR_Copy_20261016'
$w = "$base\agent_work"
$repo = "$w\repo"
if ($Shim -eq '') { $Shim = "$repo\server\1c\ExternalConnectionShim.bsl" }
$cfIn = "$base\LR_configuration_20261016.cf"
$cfOut = "$w\patched\ext_shim_$Tag.cf"
$ib = "$w\scratch83\iter_$Tag"
$v81 = 'C:\Program Files (x86)\1cv81\bin\1cv8.exe'
$q = '"'
New-Item -ItemType Directory -Force "$w\patched" | Out-Null
$log = "$w\patched\iterate_$Tag.log"
Remove-Item $log -ErrorAction SilentlyContinue
function L($m) { ('{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m) | Add-Content $log -Encoding UTF8 }
function Tail([string]$f) { if (Test-Path $f) { ((Get-Content $f -Encoding Default -Raw) -replace '\s+', ' ').Trim() } }
function Run81([string]$name, [string]$cmd, [int]$t) {
    $p = Start-Process $v81 -ArgumentList $cmd -PassThru -WindowStyle Hidden
    if (-not $p.WaitForExit($t * 1000)) { try { $p.Kill() } catch {}; L "$name TIMEOUT after ${t}s - killed"; return -1 }
    L "$name exit=$($p.ExitCode)"
    return $p.ExitCode
}
$third = $Shim
if ($Revert) { $third = '--revert' }
L ('patching cf (revert=' + $Revert + ')')
& 'C:\Python312\python.exe' -X utf8 "$repo\migration\tools\cf_patch.py" $cfIn $cfOut $third 2>&1 | ForEach-Object { L $_ }
if (-not (Test-Path $cfOut)) { L 'PATCH FAILED'; exit 1 }
if (Test-Path $ib) { Remove-Item $ib -Recurse -Force }
New-Item -ItemType Directory -Force $ib | Out-Null
if ((Run81 'create' ("CREATEINFOBASE File=$q$ib$q /Out $q$w\patched\create_$Tag.log$q") 300) -ne 0) { L 'ABORT'; exit 1 }
if ((Run81 'loadcfg' ("DESIGNER /F $q$ib$q /DisableStartupMessages /LoadCfg $q$cfOut$q /Out $q$w\patched\load_$Tag.log$q") 240) -ne 0) { L ('ABORT load.log: ' + (Tail "$w\patched\load_$Tag.log")); exit 1 }
L ('load.log: ' + (Tail "$w\patched\load_$Tag.log"))
if ((Run81 'updatedb' ("DESIGNER /F $q$ib$q /DisableStartupMessages /UpdateDBCfg /Out $q$w\patched\upd_$Tag.log$q") 600) -ne 0) { L ('ABORT upd.log: ' + (Tail "$w\patched\upd_$Tag.log")); exit 1 }
$u = Tail "$w\patched\upd_$Tag.log"
if ($u.Length -gt 200) { $u = $u.Substring($u.Length - 200) }
L ('upd.log tail: ' + $u)
& "$w\bin\GwProbe.exe" compile --ib $ib --out "$w\patched\matrix_$Tag.csv" 2>&1 | ForEach-Object { L $_ }
L 'DONE'
