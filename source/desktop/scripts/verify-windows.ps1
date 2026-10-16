# Verifies the Kermo Windows installer on this machine: silent install into a scratch folder, file/registry/shortcut checks,
# launch of the installed app against the work-copy gateway (CDP end-to-end), in-place upgrade, silent uninstall, cleanup.
# Credentials come from DPAPI files in agent_work\secrets; nothing secret is printed. ASCII only (Windows PowerShell 5.1).
param([string]$Server = 'http://127.0.0.1:8480', [string]$Installer = '')
$w = 'C:\Base_1C\MCP_LR_Copy_20261016\agent_work'
$rel = "$w\release"
$work = "$w\inst_test"
$inst = "$work\Kermo"
$ud = "$work\userdata"
$pd = [Environment]::GetEnvironmentVariable('ProgramData')
$log = "$rel\verify.log"
if ($Installer -eq '') { $Installer = (Get-ChildItem $rel -Filter 'Kermo-Setup-*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName }
New-Item -ItemType Directory -Force $rel | Out-Null
Remove-Item $log -ErrorAction SilentlyContinue
$script:ok = 0; $script:bad = 0
function L([string]$m) { ('{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m) | Add-Content $log -Encoding UTF8 }
function Check([string]$name, [scriptblock]$t) {
    try { $r = & $t; if ($r -eq $true) { $script:ok++; L ('PASS  ' + $name) } else { $script:bad++; L ('FAIL  ' + $name + ' :: ' + $r) } }
    catch { $script:bad++; L ('FAIL  ' + $name + ' :: ' + $_.Exception.Message) }
}
function Wait-Exit($proc, [int]$sec) { if (-not $proc.WaitForExit($sec * 1000)) { try { $proc.Kill() } catch {}; return $false }; return $true }
$sh = New-Object -ComObject WScript.Shell
function Find-Links([string]$target) {
    $dirs = @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('CommonPrograms'), [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory')) | Where-Object { $_ -and (Test-Path $_) }
    $found = @()
    foreach ($d in $dirs) {
        foreach ($f in (Get-ChildItem $d -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue)) {
            try { if ($sh.CreateShortcut($f.FullName).TargetPath -eq $target) { $found += $f.FullName } } catch {}
        }
    }
    return $found
}
function Find-Uninstall([string]$dir) {
    $keys = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall') | Where-Object { Test-Path $_ }
    foreach ($k in $keys) {
        foreach ($c in (Get-ChildItem $k -ErrorAction SilentlyContinue)) {
            $p = Get-ItemProperty $c.PSPath -ErrorAction SilentlyContinue
            if ($p -and (($p.UninstallString -like "*$dir*") -or ($p.InstallLocation -eq $dir))) { return $p }
        }
    }
    return $null
}

L ('installer: ' + $Installer)
Check 'installer file exists and is large enough' { (Test-Path $Installer) -and ((Get-Item $Installer).Length -gt 50MB) }
L ('installer size MB: ' + [math]::Round((Get-Item $Installer).Length / 1MB, 1) + ' sha256: ' + (Get-FileHash $Installer -Algorithm SHA256).Hash.ToLower())
L ('authenticode signature: ' + (Get-AuthenticodeSignature $Installer).Status)
Check 'Kermo is not running before the test' { -not (Get-Process Kermo -ErrorAction SilentlyContinue) }
if (Test-Path $work) { Remove-Item "$work\*" -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force $work | Out-Null

$zip = Get-ChildItem $rel -Filter 'Kermo-*-win-x64-portable.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($zip) {
    $pdir = "$work\portable"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $pdir)
    Check 'portable ZIP unpacks with Kermo.exe and portable.flag' { (Test-Path "$pdir\Kermo\Kermo.exe") -and (Test-Path "$pdir\Kermo\portable.flag") }
    $pp = Start-Process "$pdir\Kermo\Kermo.exe" -ArgumentList @('--disable-gpu') -PassThru
    Start-Sleep 12
    Check 'portable mode keeps data and logs next to the exe' { Test-Path "$pdir\Kermo\data\logs\kermo.log" }
    Check 'portable log reports portable mode' { (Get-Content "$pdir\Kermo\data\logs\kermo.log" -Raw -Encoding UTF8) -match ([Regex]::Unescape('\u043f\u043e\u0440\u0442\u0430\u0442\u0438\u0432\u043d\u0438\u0439: true')) }
    Get-Process Kermo -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
    Remove-Item $pdir -Recurse -Force -ErrorAction SilentlyContinue
}

$p = Start-Process $Installer -ArgumentList @('/S', '/currentuser', "/SERVER=$Server", "/D=$inst") -PassThru
Check 'silent install finishes with exit code 0' { (Wait-Exit $p 300) -and ($p.ExitCode -eq 0) }
Start-Sleep 3
Check 'Kermo.exe is installed' { Test-Path "$inst\Kermo.exe" }
Check 'application package (app.asar) is installed' { Test-Path "$inst\resources\app.asar" }
Check 'uninstaller is installed' { Test-Path "$inst\Uninstall Kermo.exe" }
Check 'third-party license files are shipped' { (Test-Path "$inst\LICENSE.electron.txt") -and (Test-Path "$inst\LICENSES.chromium.html") }
$vi = (Get-Item "$inst\Kermo.exe").VersionInfo
L ('exe version info: ProductName=' + $vi.ProductName + ' | FileDescription=' + $vi.FileDescription + ' | CompanyName=' + $vi.CompanyName + ' | FileVersion=' + $vi.FileVersion)
Check 'exe carries Kermo version info (not the default Electron one)' { ($vi.ProductName -eq 'Kermo') -and ($vi.CompanyName -ne 'GitHub, Inc.') -and ($vi.FileDescription -ne 'Electron') }
$un = Find-Uninstall $inst
Check 'uninstall entry is registered (Add/Remove Programs)' { $un -ne $null }
if ($un) { L ('uninstall entry: DisplayName=' + $un.DisplayName + ' | DisplayVersion=' + $un.DisplayVersion + ' | Publisher=' + $un.Publisher) }
$links = @(Find-Links "$inst\Kermo.exe")
Check 'Start Menu and Desktop shortcuts are created' { $links.Count -ge 2 }
L ('shortcuts: ' + (($links | ForEach-Object { Split-Path $_ -Leaf }) -join ', '))
Check 'server address from /SERVER= is stored for all users' { (Test-Path "$pd\Kermo\server.url") -and ((Get-Content "$pd\Kermo\server.url" -Raw).Trim() -eq $Server) }
Check 'silent install did not auto-start the app' { -not (Get-Process Kermo -ErrorAction SilentlyContinue) }
Get-Process Kermo -ErrorAction SilentlyContinue | Stop-Process -Force

$env:KERMO_EXE = "$inst\Kermo.exe"
$env:KERMO_UD = $ud
$env:KERMO_EXPECT_SERVER = $Server
$env:KERMO_SHOT_DIR = $rel
$env:KERMO_USER = [IO.File]::ReadAllText("$w\secrets\copymax.user", [Text.Encoding]::UTF8).Trim()
$env:KERMO_PASS = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR((ConvertTo-SecureString (Get-Content "$w\secrets\copymax.pass.dpapi"))))
$out = "$rel\e2e_desktop.out"
Remove-Item $out, "$out.err" -ErrorAction SilentlyContinue
Push-Location "$w\client_build"
$ep = Start-Process node -ArgumentList 'e2e-real\desktop.mjs' -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError "$out.err"
# the exit code of a redirected node process is not reliably available in Windows PowerShell 5.1, so the result is read from its output
Check 'installed app works end to end against the work-copy gateway' {
    if (-not (Wait-Exit $ep 170)) { return 'timeout' }
    $txt = Get-Content $out -Raw -Encoding UTF8
    return (($txt -notmatch 'FAIL') -and (([regex]::Matches($txt, 'PASS')).Count -ge 10))
}
Pop-Location
Remove-Item Env:KERMO_PASS -ErrorAction SilentlyContinue
Get-Content $out -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object { L ('e2e: ' + $_) }
Get-Content "$out.err" -ErrorAction SilentlyContinue | Select-Object -First 5 | ForEach-Object { L ('e2e-err: ' + $_) }
Get-Process Kermo -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 1

$p2 = Start-Process $Installer -ArgumentList @('/S', '/currentuser', "/D=$inst") -PassThru
Check 'in-place upgrade (installer run again) finishes with exit code 0' { (Wait-Exit $p2 300) -and ($p2.ExitCode -eq 0) }
Start-Sleep 3
Check 'after the upgrade the app, the uninstall entry and the server address are in place' { (Test-Path "$inst\Kermo.exe") -and ((Find-Uninstall $inst) -ne $null) -and (Test-Path "$pd\Kermo\server.url") }
Get-Process Kermo -ErrorAction SilentlyContinue | Stop-Process -Force

$u = Start-Process "$inst\Uninstall Kermo.exe" -ArgumentList @('/S', "_?=$inst") -PassThru
Check 'silent uninstall finishes with exit code 0' { (Wait-Exit $u 180) -and ($u.ExitCode -eq 0) }
Start-Sleep 2
Check 'application files are removed' { -not (Test-Path "$inst\Kermo.exe") }
Check 'shortcuts are removed' { @(Find-Links "$inst\Kermo.exe").Count -eq 0 }
Check 'uninstall entry is removed' { (Find-Uninstall $inst) -eq $null }
Check 'server address file is removed' { -not (Test-Path "$pd\Kermo\server.url") }

Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
if ((Test-Path "$pd\Kermo") -and -not (Get-ChildItem "$pd\Kermo" -Force)) { Remove-Item "$pd\Kermo" -Force }
L ('SUMMARY passed={0} failed={1}' -f $script:ok, $script:bad)
L 'DONE'
