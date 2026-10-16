# Writes agent_work\runtime\gateway.config.json for the Copymax work copy. The permission code is read from the
# existing launcher and stays on the server; nothing is printed.
$base = 'C:\Base_1C\MCP_LR_Copy_20261016'
$w = "$base\agent_work"
New-Item -ItemType Directory -Force "$w\runtime" | Out-Null
$bat = Get-Content "$base\Open_Copymax_1C.bat" -Raw
$uc = ''
if ($bat -match '/UC"?([^"\s]+)"?') { $uc = $Matches[1] }
$cfg = [ordered]@{ listen = 'http://127.0.0.1:8480/'; srvr = 'LR'; ref = 'Copymax'; permissionCode = $uc; webRoot = "$w\webroot"; maxSessions = 3; idleMinutes = 15; callTimeoutSeconds = 90; allowedInfobases = @('Copymax') }
($cfg | ConvertTo-Json) | Set-Content "$w\runtime\gateway.config.json" -Encoding UTF8
'runtime config written (permission code length ' + $uc.Length + ')'
