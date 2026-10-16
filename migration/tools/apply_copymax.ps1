param([string]$Tag = 'shim2', [string]$Shim = '', [switch]$Rollback, [string]$BackupCf = '')
# Applies a configuration .cf to the Copymax WORK COPY with the 8.1 Configurator in batch mode.
# Credentials come from DPAPI files in agent_work\secrets; secrets are masked in every log line.
# Order: read-only catalog structures -> DumpCfg backup -> LoadCfg -> UpdateDBCfg -> compile matrix on Copymax.
$base = 'C:\Base_1C\MCP_LR_Copy_20261016'
$w = "$base\agent_work"
$repo = "$w\repo"
$v81 = 'C:\Program Files (x86)\1cv81\bin\1cv8.exe'
$srvr = 'LR'; $ref = 'Copymax'   # hard guard: only the work copy
if ($Shim -eq '') { $Shim = "$repo\server\1c\ExternalConnectionShim.bsl" }
New-Item -ItemType Directory -Force "$w\patched", "$w\backup" | Out-Null
$log = "$w\patched\apply_$Tag.log"
Remove-Item $log -ErrorAction SilentlyContinue
$user = [IO.File]::ReadAllText("$w\secrets\copymax.user", [Text.Encoding]::UTF8).Trim()
$secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR((ConvertTo-SecureString (Get-Content "$w\secrets\copymax.pass.dpapi"))))
$bat = Get-Content "$base\Open_Copymax_1C.bat" -Raw
$uc = ''
if ($bat -match '/UC"?([^"\s]+)"?') { $uc = $Matches[1] }
$q = '"'
$auth = "/S$q$srvr\$ref$q /N$q$user$q /P$q$secret$q"
if ($uc) { $auth += " /UC$q$uc$q" }
function Mask([string]$s) { if ($secret) { $s = $s.Replace($secret, '***') }; if ($uc) { $s = $s.Replace($uc, '***') }; return $s }
function L($m) { ('{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), (Mask ([string]$m))) | Add-Content $log -Encoding UTF8 }
function Tail([string]$f) { if (Test-Path $f) { $t = ((Get-Content $f -Encoding Default -Raw) -replace '\s+', ' ').Trim(); if ($t.Length -gt 240) { $t = $t.Substring($t.Length - 240) }; return (Mask $t) } }
function Run81([string]$name, [string]$cmd, [int]$t, [string]$out) {
    $p = Start-Process $v81 -ArgumentList $cmd -PassThru -WindowStyle Hidden
    if (-not $p.WaitForExit($t * 1000)) { try { $p.Kill() } catch {}; L "$name TIMEOUT after ${t}s - killed"; return -1 }
    L "$name exit=$($p.ExitCode) :: $(Tail $out)"
    return $p.ExitCode
}
function Apply([string]$cf, [string]$name) {
    if ((Run81 "loadcfg($name)" "DESIGNER $auth /DisableStartupMessages /LoadCfg $q$cf$q /Out $q$w\patched\load_$Tag.log$q" 900 "$w\patched\load_$Tag.log") -ne 0) { L 'ABORT at loadcfg - decide manually'; exit 1 }
    if ((Run81 "updatedb($name)" "DESIGNER $auth /DisableStartupMessages /UpdateDBCfg /Out $q$w\patched\upd_$Tag.log$q" 3600 "$w\patched\upd_$Tag.log") -ne 0) { L 'ABORT at updatedb - decide manually'; exit 1 }
}
if ($Rollback) {
    L ('ROLLBACK to ' + $BackupCf)
    Apply $BackupCf 'rollback'
    L 'DONE'; exit 0
}
$cfOut = "$w\patched\copymax_$Tag.cf"
L 'patching cf'
& 'C:\Python312\python.exe' -X utf8 "$repo\migration\tools\cf_patch.py" "$base\LR_configuration_20261016.cf" $cfOut $Shim 2>&1 | ForEach-Object { L $_ }
if (-not (Test-Path $cfOut)) { L 'PATCH FAILED'; exit 1 }
& "$w\bin\GwProbe.exe" catstruct default 2>&1 | ForEach-Object { L ('catstruct: ' + $_) }
$bk = "$w\backup\Copymax_config_before_$Tag.cf"
if ((Run81 'dumpcfg(backup)' "DESIGNER $auth /DisableStartupMessages /DumpCfg $q$bk$q /Out $q$w\backup\dump_$Tag.log$q" 900 "$w\backup\dump_$Tag.log") -ne 0) { L 'ABORT: backup failed, nothing changed'; exit 1 }
$bs = (Get-Item $bk -ErrorAction SilentlyContinue).Length
L "backup size=$bs"
if ($bs -lt 30000000) { L 'ABORT: backup looks too small, nothing changed'; exit 1 }
Apply $cfOut 'shim'
& "$w\bin\GwProbe.exe" facts 2>&1 | ForEach-Object { L ('facts: ' + $_) }
& "$w\bin\GwProbe.exe" compile --out "$w\patched\matrix_copymax_$Tag.csv" 2>&1 | ForEach-Object { L ('compile: ' + $_) }
L 'DONE'
