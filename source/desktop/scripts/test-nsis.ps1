# Compiles and runs the NSIS parameter-parsing harness with the makensis cached by electron-builder (run build-windows.ps1 once first).
# ProgramData is redirected to a scratch folder through the environment, so nothing outside agent_work is touched. ASCII only.
$w = 'C:\Base_1C\MCP_LR_Copy_20261016\agent_work'
$src = "$w\repo\source\desktop"
$tmp = "$w\nsis_test"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$tmp\pd" | Out-Null
$mk = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache" -Recurse -Filter makensis.exe -Depth 4 -ErrorAction SilentlyContinue | Sort-Object { $_.FullName.Length } | Select-Object -First 1
if (-not $mk) { 'makensis not found'; exit 1 }
$env:NSISDIR = Split-Path $mk.FullName
if (-not (Test-Path "$env:NSISDIR\Stubs")) { $env:NSISDIR = Split-Path $env:NSISDIR }
New-Item -ItemType Directory -Force "$tmp\test\nsis" | Out-Null
Copy-Item "$src\installer.nsh" "$tmp\installer.nsh"
Copy-Item "$src\test\nsis\parse-test.nsi" "$tmp\test\nsis\parse-test.nsi"
$out = & $mk.FullName /V2 "$tmp\test\nsis\parse-test.nsi" 2>&1
$out | Select-Object -Last 6 | ForEach-Object { 'makensis: ' + $_ }
$exe = "$tmp\test\nsis\parse-test.exe"
if (-not (Test-Path $exe)) { 'COMPILE FAILED'; exit 1 }
$env:ProgramData = "$tmp\pd"
$cases = @(
    @{ args = '/S /SERVER=http://127.0.0.1:8480'; want = 'http://127.0.0.1:8480' },
    @{ args = '/S /SERVER="http://erp.local:8480"'; want = 'http://erp.local:8480' },
    @{ args = '"/SERVER=https://srv.example:9443" /S'; want = 'https://srv.example:9443' },
    @{ args = '/S /server=http://lower:1 /allusers'; want = 'http://lower:1' },
    @{ args = '/S'; want = $null },
    @{ args = '/S /SERVER=ftp://bad'; want = $null },
    @{ args = '/S /SERVER='; want = $null }
)
$ok = 0; $bad = 0
foreach ($c in $cases) {
    Remove-Item "$tmp\pd\Kermo" -Recurse -Force -ErrorAction SilentlyContinue
    $p = Start-Process $exe -ArgumentList $c.args -PassThru
    [void]$p.WaitForExit(30000)
    $f = "$tmp\pd\Kermo\server.url"
    $got = $null
    if (Test-Path $f) { $got = [IO.File]::ReadAllText($f) }
    if ($got -eq $c.want) { $ok++; 'PASS  args=[' + $c.args + '] -> ' + $(if ($got) { $got } else { '(no file)' }) } else { $bad++; 'FAIL  args=[' + $c.args + '] want=[' + $c.want + '] got=[' + $got + ']' }
}
('SUMMARY passed={0} failed={1}' -f $ok, $bad)
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
