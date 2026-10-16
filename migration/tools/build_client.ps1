# Builds the web client on the 1C host and publishes it to agent_work\webroot (served by the gateway).
# The repo copy is recreated on every sync, so the build happens in a persistent sibling folder.
$w = 'C:\Base_1C\MCP_LR_Copy_20261016\agent_work'
$src = "$w\repo\source\client"
$dst = "$w\client_build"
$log = "$w\runtime\client_build.log"
New-Item -ItemType Directory -Force "$w\runtime", $dst, "$w\webroot" | Out-Null
Remove-Item $log -ErrorAction SilentlyContinue
function L($m) { ('{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m) | Add-Content $log -Encoding UTF8 }
robocopy $src $dst /MIR /XD node_modules dist test-results /NFL /NDL /NJH /NJS /NP | Out-Null
Set-Location $dst
L 'npm ci'
cmd /c "npm ci --no-audit --no-fund 2>&1" | ForEach-Object { L $_ }
L 'npm run build'
cmd /c "npm run build 2>&1" | ForEach-Object { L $_ }
if (Test-Path "$dst\dist\index.html") {
    robocopy "$dst\dist" "$w\webroot" /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
    L 'published to webroot'
} else { L 'BUILD FAILED' }
L 'DONE'
