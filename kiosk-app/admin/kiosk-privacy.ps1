<#
  군포시 민원 서식 작성 도우미 — 키오스크 관리자 설정
  ------------------------------------------------------------------
  하는 일 : ① 인쇄할 실물 프린터를 **지정**해 프로그램이 그 프린터로만 출력하게 하고,
            ② 인쇄 내용을 파일로 저장하는 가상 프린터를 제거하며,
            ③ 관리자 종료 PIN 을 설정한다.
            시민이 입력한 개인정보가 이 PC에 파일로 남지 않게 하기 위한 설치 1회 작업이다.

  실행은 같은 폴더의 「관리자_개인정보보호_설정.bat」으로 한다.
  (이 파일을 직접 실행할 필요는 없다.)

  ※ 프로그램은 인쇄 대화상자를 열지 않으므로 시민이 'PDF로 저장'을 고를 경로가 없다.
     남는 위험은 **지정 프린터가 가상 프린터인 경우** 하나뿐이라, 그것을 여기서 막는다.
     설정값은 아래 kiosk.json 에 적히고, 프로그램이 시작할 때 읽는다.
#>
param([string]$Arg1 = "", [string]$Arg2 = "")

$CfgDir  = Join-Path $env:ProgramData "군포민원서식도우미"
$CfgPath = Join-Path $CfgDir "kiosk.json"

# 예전 크롬 방식에서 쓰던 정책 키 — /undo 로 정리만 한다(현재 방식은 쓰지 않음)
$CKEY = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$PKEY = "$CKEY\PrinterTypeDenyList"

# 인쇄 내용을 파일로 저장하는 프린터 판별
#  - 포트 기준: 실물 프린터는 이런 포트를 쓰지 않음
$VirtPortRe = '^(PORTPROMPT:|SHRFAX:|nul:?)$'
#  - 이름 기준: 널리 쓰이는 PDF/문서 저장 프린터 (한컴오피스 포함)
$VirtNameRe = 'Print to PDF|XPS Document Writer|OneNote|Hancom PDF|Adobe PDF|CutePDF|doPDF|Bullzip|PDF24|Foxit|PrimoPDF|Nitro|PDFCreator|Fax'
#  - 실물로 보이는 포트(네트워크·USB 등). 여기에 안 맞으면 '확인 필요'로만 알린다
$RealPortRe = '^(IP_|USB|LPT|COM|WSD|\d+\.\d+\.\d+\.\d+)'

function Get-PrinterList {
  try   { Get-Printer | Select-Object Name, PortName, DriverName }
  catch { Get-CimInstance Win32_Printer | Select-Object Name, PortName, DriverName }
}
function Test-Virtual([object]$p) { ($p.PortName -match $VirtPortRe) -or ($p.Name -match $VirtNameRe) }
function Test-RealPort([object]$p) { $p.PortName -match $RealPortRe }

function Show-Printer([object]$p, [string]$prefix = "         - ") {
  Write-Host ("{0}{1}   (port: {2})" -f $prefix, $p.Name, $p.PortName)
}
function Remove-OnePrinter([string]$name) {
  try { Remove-Printer -Name $name -ErrorAction Stop; return $true }
  catch {
    # PrintManagement 모듈이 없거나 실패한 경우 printui 로 재시도
    Start-Process rundll32 -ArgumentList ('printui.dll,PrintUIEntry /dl /q /n "{0}"' -f $name) -Wait -WindowStyle Hidden
    return -not (Get-PrinterList | Where-Object { $_.Name -eq $name })
  }
}
function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Require-Admin {
  if (Test-Admin) { return $true }
  Write-Host ""
  Write-Host "  [!] 관리자 권한이 필요합니다." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "      「관리자_개인정보보호_설정.bat」을 마우스 오른쪽 버튼으로 클릭한 뒤"
  Write-Host "      [관리자 권한으로 실행] 을 선택해 주세요."
  Write-Host ""
  Write-Host "      * 상태만 보려면 관리자 권한 없이 이렇게 실행하세요:"
  Write-Host "          관리자_개인정보보호_설정.bat /status"
  Write-Host ""
  return $false
}
function Set-WindowsFeature([string]$feature, [bool]$enable) {
  try {
    if ($enable) { Enable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -All -ErrorAction Stop | Out-Null }
    else         { Disable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -ErrorAction Stop | Out-Null }
    return $true
  } catch { return $false }
}

# ---- 설정 파일 (프로그램이 읽는 곳) --------------------------------------
function Read-Config {
  if (Test-Path $CfgPath) {
    try { return (Get-Content -Path $CfgPath -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { }
  }
  return (New-Object psobject)
}
function Set-Field([object]$cfg, [string]$name, $value) {
  if ($cfg.PSObject.Properties[$name]) { $cfg.$name = $value }
  else { $cfg | Add-Member -MemberType NoteProperty -Name $name -Value $value }
}
function Save-Config([object]$cfg) {
  if (-not (Test-Path $CfgDir)) { New-Item -ItemType Directory -Path $CfgDir -Force | Out-Null }
  # ⚠️ BOM 없이 저장한다 — BOM 이 붙으면 프로그램의 JSON 읽기가 실패한다.
  [IO.File]::WriteAllText($CfgPath, ($cfg | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
}
function Get-Sha256([string]$s) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ((($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($s))) | ForEach-Object { $_.ToString('x2') }) -join '') }
  finally { $sha.Dispose() }
}
function Read-Secret([string]$prompt) {
  $s = Read-Host $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

$mode = ($Arg1 -replace '^[-/]+', '').ToLower()

# ===================================================================
switch ($mode) {

# ------------------------------- 상태 확인 (변경하지 않음)
'status' {
  Write-Host ""
  Write-Host "=========================================================="
  Write-Host "  키오스크 관리자 설정  -  현재 상태 (변경하지 않음)"
  Write-Host "=========================================================="
  Write-Host ""

  $cfg = Read-Config
  Write-Host "  [프로그램 설정]"
  Write-Host ("        설정 파일               : {0}" -f $CfgPath)
  if (Test-Path $CfgPath) { Write-Host "        파일 존재               : 예  [양호]" }
  else { Write-Host "        파일 존재               : 아니오  [주의] 인쇄가 되지 않습니다" -ForegroundColor Yellow }

  $target = $cfg.printerDeviceName
  if ($target) { Write-Host ("        지정 프린터             : {0}  [양호]" -f $target) }
  else { Write-Host "        지정 프린터             : 미지정  [주의] 인쇄가 되지 않습니다" -ForegroundColor Yellow }

  if ($cfg.exitPinHash) { Write-Host "        관리자 종료 PIN         : 설정됨  [양호]" }
  else { Write-Host "        관리자 종료 PIN         : 미설정  [주의] PIN 없이 종료됩니다" -ForegroundColor Yellow }

  if ($target) {
    $p = Get-Printer -Name $target -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "  [지정 프린터 상태]"
    if ($p) {
      Write-Host ("        상태                    : {0}" -f $p.PrinterStatus)
      Write-Host ("        포트                    : {0}" -f $p.PortName)
      if ($p.KeepPrintedJobs) {
        Write-Host "        인쇄된 문서 유지        : 켜짐  [주의] 인쇄 후에도 작업이 대기열에 남습니다" -ForegroundColor Yellow
      } else { Write-Host "        인쇄된 문서 유지        : 꺼짐  [양호]" }
      $jobs = @(Get-PrintJob -PrinterName $target -ErrorAction SilentlyContinue)
      if ($jobs.Count -gt 0) {
        Write-Host ("        대기 중인 인쇄 작업     : {0}건  [주의] 개인정보가 남아 있을 수 있습니다" -f $jobs.Count) -ForegroundColor Yellow
      } else { Write-Host "        대기 중인 인쇄 작업     : 없음  [양호]" }
    } else {
      Write-Host ("        [!] '{0}' 프린터를 찾을 수 없습니다." -f $target) -ForegroundColor Yellow
    }
  }

  $all  = @(Get-PrinterList)
  $virt = @($all | Where-Object { Test-Virtual $_ })
  $susp = @($all | Where-Object { -not (Test-Virtual $_) -and -not (Test-RealPort $_) })

  Write-Host ""
  Write-Host "  [파일로 저장하는 프린터]  제거 대상"
  if ($virt) {
    $virt | ForEach-Object { Show-Printer $_ }
    Write-Host "        [주의] 위 프린터는 인쇄 내용을 파일로 저장합니다. 제거가 필요합니다." -ForegroundColor Yellow
  } else { Write-Host "        없음  [양호]" }

  Write-Host ""
  Write-Host "  [확인이 필요한 프린터]  실물 프린터 포트가 아닌 것"
  if ($susp) {
    $susp | ForEach-Object { Show-Printer $_ }
    Write-Host "        파일로 저장되는 프린터라면 직접 제거해 주세요." -ForegroundColor Yellow
  } else { Write-Host "        없음  [양호]" }

  Write-Host ""
  Write-Host "  [설치된 프린터 전체]  아래 이름을 /only 에 그대로 적으세요"
  $all | ForEach-Object { Show-Printer $_ }

  Write-Host ""
  Write-Host "  설정하려면 (마우스 오른쪽 - 관리자 권한으로 실행) :"
  Write-Host '        관리자_개인정보보호_설정.bat /only "실물프린터이름"'
  Write-Host "        관리자_개인정보보호_설정.bat /pin"
  Write-Host ""
}

# ------------------------------- 관리자 종료 PIN 설정
'pin' {
  if (-not (Require-Admin)) { break }
  Write-Host ""
  Write-Host "=========================================================="
  Write-Host "  관리자 종료 PIN 설정"
  Write-Host "=========================================================="
  Write-Host ""
  Write-Host "  프로그램을 종료할 때(Ctrl+Shift+Q) 물어볼 PIN 입니다."
  Write-Host "  숫자 4자리 이상을 권장하며, 직원만 알고 있어야 합니다."
  Write-Host "  * 입력한 PIN 은 저장되지 않고, 대조용 해시(SHA-256)만 기록됩니다."
  Write-Host ""
  $p1 = Read-Secret "  새 PIN 입력"
  if ([string]::IsNullOrWhiteSpace($p1) -or $p1.Length -lt 4) {
    Write-Host ""
    Write-Host "  [!] 4자 이상 입력해 주세요. 설정하지 않았습니다." -ForegroundColor Yellow
    Write-Host ""
    break
  }
  $p2 = Read-Secret "  한 번 더 입력"
  if ($p1 -cne $p2) {
    Write-Host ""
    Write-Host "  [!] 두 번 입력한 값이 다릅니다. 설정하지 않았습니다." -ForegroundColor Yellow
    Write-Host ""
    break
  }
  $cfg = Read-Config
  Set-Field $cfg 'exitPinHash' (Get-Sha256 $p1)
  Save-Config $cfg
  Write-Host ""
  Write-Host "  설정했습니다. 프로그램을 다시 시작하면 적용됩니다."
  Write-Host ("  기록 위치 : {0}" -f $CfgPath)
  Write-Host ""
}

# ------------------------------- 되돌리기
'undo' {
  if (-not (Require-Admin)) { break }
  Write-Host ""
  Write-Host "=========================================================="
  Write-Host "  키오스크 관리자 설정  -  되돌리기"
  Write-Host "=========================================================="
  Write-Host ""
  Write-Host "  [1/2] 예전 크롬 방식 정책 정리"
  if (Test-Path $PKEY) { Remove-Item $PKEY -Recurse -Force -ErrorAction SilentlyContinue }
  foreach ($n in 'AllowFileSelectionDialogs','DownloadRestrictions','PrintPreviewUseSystemDefaultPrinter') {
    Remove-ItemProperty -Path $CKEY -Name $n -Force -ErrorAction SilentlyContinue
  }
  Write-Host "        완료"
  Write-Host ""
  Write-Host "  [2/2] 윈도우 기능 다시 켜기 (Microsoft Print to PDF 복원)"
  Write-Host "        * 1~2분 걸릴 수 있습니다."
  foreach ($f in 'Printing-PrintToPDFServices-Features','Printing-XPSServices-Features') {
    $ok = Set-WindowsFeature $f $true
    Write-Host ("        {0} : {1}" -f $f, $(if ($ok) { "완료" } else { "건너뜀" }))
  }
  Write-Host ""
  Write-Host "  되돌렸습니다. 윈도우를 재시작하면 프린터가 복원됩니다."
  Write-Host "  ※ /only 로 제거한 다른 프린터는 자동 복원되지 않습니다."
  Write-Host "     [설정] - [Bluetooth 및 장치] - [프린터 및 스캐너] 에서 다시 추가해 주세요."
  Write-Host ("  ※ 프로그램 설정({0})은 지우지 않았습니다." -f $CfgPath)
  Write-Host ""
}

# ------------------------------- 사용법
{ $_ -in 'help','h','?' } {
  Write-Host ""
  Write-Host "  사용법:"
  Write-Host '    관리자_개인정보보호_설정.bat /only "프린터이름"   프린터 지정 + 가상 프린터 제거 (관리자 권한)'
  Write-Host "    관리자_개인정보보호_설정.bat /pin               관리자 종료 PIN 설정        (관리자 권한)"
  Write-Host "    관리자_개인정보보호_설정.bat /status            상태만 확인 (변경하지 않음)"
  Write-Host "    관리자_개인정보보호_설정.bat /preview           무엇이 바뀔지 미리보기 (변경하지 않음)"
  Write-Host "    관리자_개인정보보호_설정.bat /undo              되돌리기    (관리자 권한)"
  Write-Host ""
  Write-Host "  설치 순서 : /status 로 프린터 이름 확인  →  /only 로 지정  →  /pin 으로 PIN 설정"
  Write-Host ""
}

# ------------------------------- 적용 ('' · only · preview)
{ $_ -in '','only','preview' } {
  # /preview = 같은 절차를 그대로 훑되 아무것도 바꾸지 않는다(권한 불필요)
  $dry = ($mode -eq 'preview')
  $only = $Arg2
  if ($mode -eq 'only' -and -not $only) {
    Write-Host ""
    Write-Host "  [!] /only 뒤에 지정할 프린터 이름을 큰따옴표로 적어 주세요." -ForegroundColor Yellow
    Write-Host '      예:  관리자_개인정보보호_설정.bat /only "캐논 복합기"'
    Write-Host ""
    Write-Host "      프린터 이름은 /status 로 확인할 수 있습니다."
    Write-Host ""
    break
  }
  if (-not $dry) { if (-not (Require-Admin)) { break } }

  Write-Host ""
  Write-Host "=========================================================="
  if ($dry) { Write-Host "  키오스크 관리자 설정  -  미리보기 (변경하지 않음)" }
  else      { Write-Host "  키오스크 관리자 설정  -  적용" }
  Write-Host "=========================================================="
  Write-Host ""

  Write-Host "  [1/4] 파일로 저장하는 프린터 제거 (Microsoft Print to PDF, Hancom PDF 등)"
  $virt = @(Get-PrinterList | Where-Object { Test-Virtual $_ })
  if ($virt) {
    foreach ($p in $virt) {
      if ($dry) { Write-Host ("         - {0}  →  제거 예정" -f $p.Name); continue }
      $ok = Remove-OnePrinter $p.Name
      Write-Host ("         - {0}  →  {1}" -f $p.Name, $(if ($ok) { "제거" } else { "제거 실패(직접 삭제 필요)" }))
    }
  } else { Write-Host "         (해당 프린터 없음)" }

  Write-Host ""
  if ($only) {
    Write-Host ("  [2/4] 지정한 프린터만 남기기  :  {0}" -f $only)
    if (Get-PrinterList | Where-Object { $_.Name -eq $only }) {
      foreach ($p in @(Get-PrinterList | Where-Object { $_.Name -ne $only })) {
        if ($dry) { Write-Host ("         - 제거 예정: {0}" -f $p.Name); continue }
        $ok = Remove-OnePrinter $p.Name
        Write-Host ("         - 제거: {0}  →  {1}" -f $p.Name, $(if ($ok) { "완료" } else { "실패" }))
      }
      if ($dry) { Write-Host ("         - '{0}' 를 기본 프린터로 지정 예정" -f $only) }
      else {
        try {
          $cim = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $only }
          if ($cim) { Invoke-CimMethod -InputObject $cim -MethodName SetDefaultPrinter | Out-Null }
          Write-Host "        완료 (기본 프린터로 지정)"
        } catch { Write-Host "        완료 (기본 프린터 지정은 실패 - 수동 지정 필요)" }
      }
    } else {
      Write-Host ("         [!] '{0}' 라는 이름의 프린터가 없습니다. 이 단계를 건너뜁니다." -f $only) -ForegroundColor Yellow
      Write-Host "         /status 로 정확한 이름을 확인해 주세요."
      $only = $null
    }
  } else {
    Write-Host "  [2/4] 프린터 지정  :  건너뜀 (/only 옵션 미사용)"
    Write-Host "        [주의] 프린터를 지정하지 않으면 프로그램이 인쇄하지 않습니다." -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "  [3/4] 인쇄 작업이 대기열에 남지 않게 하기 + 프로그램에 프린터 알려 주기"
  if ($only) {
    if ($dry) {
      Write-Host ("         - '{0}' 의 [인쇄된 문서 유지] 를 끌 예정" -f $only)
      Write-Host ("         - {0} 에 프린터 이름을 기록할 예정" -f $CfgPath)
    } else {
      try {
        Set-Printer -Name $only -KeepPrintedJobs $false -ErrorAction Stop
        Write-Host "         - [인쇄된 문서 유지] 끔  (인쇄가 끝나면 작업이 대기열에서 사라집니다)"
      } catch {
        Write-Host "         - [인쇄된 문서 유지] 설정 실패 - 프린터 속성에서 직접 꺼 주세요." -ForegroundColor Yellow
      }
      try {
        $cfg = Read-Config
        Set-Field $cfg 'printerDeviceName' $only
        Save-Config $cfg
        Write-Host ("         - 기록 완료 : {0}" -f $CfgPath)
      } catch {
        Write-Host ("         - [!] 설정 파일 기록 실패: {0}" -f $_.Exception.Message) -ForegroundColor Red
      }
    }
  } else {
    Write-Host "         건너뜀 (/only 로 프린터를 지정해야 합니다)"
  }

  Write-Host ""
  Write-Host "  [4/4] 윈도우 기능 끄기 - Print to PDF / XPS (다시 생기지 않도록)"
  Write-Host "        * 1~2분 걸릴 수 있습니다. 창을 닫지 마세요."
  foreach ($f in 'Printing-PrintToPDFServices-Features','Printing-XPSServices-Features') {
    if ($dry) { Write-Host ("        {0} : 끌 예정" -f $f); continue }
    $ok = Set-WindowsFeature $f $false
    Write-Host ("        {0} : {1}" -f $f, $(if ($ok) { "끔" } else { "건너뜀(이미 꺼짐 또는 미지원)" }))
  }

  $all = @(Get-PrinterList)
  # 위 [1/4]에서 다룬 것은 빼고, 실물 포트가 아닌 나머지만 '확인 필요'로 알린다
  $susp = @($all | Where-Object { -not (Test-RealPort $_) -and -not (Test-Virtual $_) })

  Write-Host ""
  Write-Host "----------------------------------------------------------"
  if ($dry) {
    Write-Host "  미리보기입니다. 실제로 적용된 것은 없습니다."
    Write-Host "  적용하려면 이 파일을 마우스 오른쪽 - [관리자 권한으로 실행] 하세요."
  } else {
    Write-Host "  설정을 마쳤습니다."
    Write-Host ""
    Write-Host "  다음 : 관리자_개인정보보호_설정.bat /pin  으로 종료 PIN 을 설정하세요."
  }
  Write-Host ""
  if ($dry) { Write-Host "  [현재 프린터]" } else { Write-Host "  [남은 프린터]" }
  $all | ForEach-Object { Show-Printer $_ }
  if ($susp) {
    Write-Host ""
    Write-Host "  [확인이 필요한 프린터]  실물 프린터 포트가 아닌 것"
    $susp | ForEach-Object { Show-Printer $_ }
    Write-Host "        위 프린터가 인쇄물을 파일로 저장한다면 직접 제거해 주세요." -ForegroundColor Yellow
  }
  Write-Host ""
  Write-Host "  [확인 방법]"
  Write-Host "        군포민원서식도우미.exe --selfcheck  를 실행하면"
  Write-Host "        프린터·보안 설정이 실제로 적용됐는지 점검 결과가 파일로 저장됩니다."
  Write-Host ""
  Write-Host "  [되돌리기]  관리자_개인정보보호_설정.bat /undo"
  Write-Host "----------------------------------------------------------"
  Write-Host ""
}

# ------------------------------- 알 수 없는 옵션
default {
  Write-Host ""
  Write-Host ("  [!] 알 수 없는 옵션입니다: {0}" -f $Arg1) -ForegroundColor Yellow
  Write-Host "      관리자_개인정보보호_설정.bat /? 로 사용법을 확인하세요."
  Write-Host ""
}

}
