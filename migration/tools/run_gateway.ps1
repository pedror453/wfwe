# Stops a previous gateway, builds the new one from the synced repo and starts it hidden. ASCII only.
$w = 'C:\Base_1C\MCP_LR_Copy_20261016\agent_work'
Get-Process KermoGateway -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }
Start-Sleep 1
& cmd /c "`"$w\repo\server\gateway\build.cmd`"" 2>&1
if (-not (Test-Path "$w\repo\build\KermoGateway.exe")) { 'GATEWAY BUILD FAILED'; exit 1 }
New-Item -ItemType Directory -Force "$w\bin" | Out-Null
Copy-Item "$w\repo\build\KermoGateway.exe" "$w\bin\KermoGateway.exe" -Force
Start-Process "$w\bin\KermoGateway.exe" -ArgumentList "`"$w\runtime\gateway.config.json`"" -WindowStyle Hidden
Start-Sleep 2
'gateway started: ' + [bool](Get-Process KermoGateway -ErrorAction SilentlyContinue)
