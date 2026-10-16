param([string]$Base = 'http://127.0.0.1:8480', [string]$SecretsDir = 'C:\Base_1C\MCP_LR_Copy_20261016\agent_work\secrets')
# Smoke test of the running gateway against the Copymax work copy. Credentials come from DPAPI files, nothing secret or
# personal is printed: only counts, document numbers, dates, states and totals. ASCII only (Windows PowerShell 5.1).
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$user = [IO.File]::ReadAllText("$SecretsDir\copymax.user", [Text.Encoding]::UTF8).Trim()
$pass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR((ConvertTo-SecureString (Get-Content "$SecretsDir\copymax.pass.dpapi"))))
$script:ok = 0; $script:fail = 0; $script:token = $null
function Check([string]$name, [scriptblock]$test) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try { $r = & $test; if ($r -eq $true) { $script:ok++; '{0,-62} PASS  {1} ms' -f $name, $sw.ElapsedMilliseconds } else { $script:fail++; '{0,-62} FAIL  {1}' -f $name, $r } }
    catch {
        $msg = $_.Exception.Message
        if ($_.Exception.Response) { try { $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream(), [Text.Encoding]::UTF8); $msg += ' :: ' + $sr.ReadToEnd() } catch { } }
        $script:fail++; '{0,-62} FAIL  {1}' -f $name, $msg
    }
}
function Call([string]$method, [string]$path, $body = $null, [bool]$auth = $true) {
    $h = @{}
    if ($auth -and $script:token) { $h['Authorization'] = 'Bearer ' + $script:token }
    $p = @{ Uri = $Base + $path; Method = $method; Headers = $h; UseBasicParsing = $true }
    if ($body -ne $null) { $p['Body'] = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress)); $p['ContentType'] = 'application/json; charset=utf-8' }
    $r = Invoke-WebRequest @p
    if ($r.StatusCode -eq 204 -or -not $r.Content) { return $null }
    return ($r.Content | ConvertFrom-Json)
}
function Status([scriptblock]$s) { try { & $s | Out-Null; return 200 } catch { if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode } else { return -1 } } }

Check 'health responds without authentication' { (Call 'GET' '/health' $null $false).status -eq 'ok' }
Check 'protected endpoint without token -> 401' { (Status { Call 'GET' '/work-orders' $null $false }) -eq 401 }
Check 'login with a wrong password -> 401' { (Status { Call 'POST' '/auth/login' @{ user = $user; password = ($pass + 'x') } $false }) -eq 401 }
Check 'login with the stored test user' { $r = Call 'POST' '/auth/login' @{ user = $user; password = $pass } $false; $script:token = $r.token; ($r.token.Length -gt 20) -and ($r.roles.Count -ge 1) }
Check 'capabilities: read works, write is not enabled yet' { $c = Call 'GET' '/capabilities'; $c.workOrders.list -and $c.workOrders.read -and (-not $c.workOrders.post) }
$sum = $null
Check 'summary has totals and states' { $script:sum = Call 'GET' '/work-orders/summary'; "total=$($script:sum.total) posted=$($script:sum.posted) states=$($script:sum.byState.Count) last30=$($script:sum.last30Days.count)" | Out-Host; ($script:sum.total -gt 100000) -and ($script:sum.byState.Count -ge 10) -and ($script:sum.posted -le $script:sum.total) }
$page = $null
Check 'list: first page has 25 items and the same total' { $script:page = Call 'GET' '/work-orders?page=1&pageSize=25'; "items=$($script:page.items.Count) total=$($script:page.total) newest=$($script:page.items[0].number) $($script:page.items[0].date) state-set" | Out-Host; ($script:page.items.Count -eq 25) -and ($script:page.total -eq $script:sum.total) }
Check 'list: items are ordered by date descending' { $d = $script:page.items | ForEach-Object { [datetime]$_.date }; $ok = $true; for ($i = 1; $i -lt $d.Count; $i++) { if ($d[$i] -gt $d[$i - 1]) { $ok = $false } }; $ok }
Check 'list: second page differs from the first' { $p2 = Call 'GET' '/work-orders?page=2&pageSize=25'; ($p2.items.Count -eq 25) -and ($p2.items[0].id -ne $script:page.items[0].id) }
Check 'list: filter by state returns only that state' { $st = $script:page.items[0].state; $f = Call 'GET' ('/work-orders?pageSize=10&state=' + [uri]::EscapeDataString($st)); "filter-state-total=$($f.total)" | Out-Host; ($f.items.Count -gt 0) -and (@($f.items | Where-Object { $_.state -ne $st }).Count -eq 0) }
Check 'list: search by document number finds it' { $n = $script:page.items[0].number; $s = Call 'GET' ('/work-orders?q=' + [uri]::EscapeDataString($n)); ($s.total -ge 1) -and ($s.items[0].number -eq $n) }
Check 'list: search with SQL-like wildcards is escaped' { $s = Call 'GET' '/work-orders?q=%25%5F%5B'; $s.total -ge 0 }
$detail = $null
Check 'detail: opens the newest work order with lines and totals' { $id = $script:page.items[0].id; $script:detail = Call 'GET' ('/work-orders/' + $id); "detail: number=$($script:detail.number) parts=$($script:detail.parts.Count) works=$($script:detail.works.Count) performers=$($script:detail.performers.Count) total=$($script:detail.total) posted=$($script:detail.posted)" | Out-Host; ($script:detail.number -eq $script:page.items[0].number) -and ($script:detail.id -eq $id) }
Check 'detail: header total equals the list total' { [math]::Abs([double]$script:detail.total - [double]$script:page.items[0].total) -lt 0.01 }
Check 'detail: unknown id -> 404' { (Status { Call 'GET' '/work-orders/00000000-0000-4000-8000-000000000000' }) -eq 404 }
foreach ($k in 'organizations', 'customers', 'cars', 'employees', 'nomenclature', 'works', 'warehouses', 'repairTypes') {
    Check ("lookup: $k returns items") { $r = Call 'GET' "/lookups/$k`?limit=5"; "lookup $k -> $(@($r).Count)" | Out-Host; (@($r).Count -ge 1) -and ($r[0].id.Length -eq 36) }
}
Check 'lookup: unknown kind -> 404' { (Status { Call 'GET' '/lookups/nothing' }) -eq 404 }
Check 'write endpoints are not enabled yet -> 501' { (Status { Call 'POST' '/work-orders' @{ reason = 'x' } }) -eq 501 }
Check 'logout ends the session' { Call 'POST' '/auth/logout' | Out-Null; (Status { Call 'GET' '/work-orders' }) -eq 401 }
''
'passed: {0}  failed: {1}' -f $script:ok, $script:fail
if ($script:fail -gt 0) { exit 1 }
