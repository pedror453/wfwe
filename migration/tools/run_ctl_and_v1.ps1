$s = 'C:\Base_1C\MCP_LR_Copy_20261016\agent_work\repo\migration\tools\iterate_shim.ps1'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $s -Tag ctl -Revert
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $s -Tag v1
