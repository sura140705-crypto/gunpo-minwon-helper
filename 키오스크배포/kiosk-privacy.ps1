<#
  군포시 민원 서식 작성 도우미 — 키오스크 개인정보 보호 설정
  ------------------------------------------------------------------
  하는 일 : 인쇄창에서 'PDF로 저장'을 고를 수 없게 만들어, 시민이 입력한
            개인정보가 이 PC에 파일로 남지 않게 한다.
            실물 프린터로 인쇄하는 기능은 그대로 사용한다.

  실행은 같은 폴더의 「관리자_개인정보보호_설정.bat」으로 한다.
  (이 파일을 직접 실행할 필요는 없다.)

  차단 경로 2가지
    1) 크롬 내장 'PDF로 저장'      → 크롬 정책 PrinterTypeDenyList
    2) 윈도우 가상 프린터(Print to PDF, Hancom PDF 등)
                                   → 프린터 제거 + 윈도우 기능 끄기
#>
param([string]$Arg1 = "", [string]$Arg2 = "")

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
function Set-Policy([string]$path, [string]$name, $value, [string]$type) {
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  New-ItemProperty -Path $path -Name $name -Value $value -PropertyType $type -Force | Out-Null
}
function Set-WindowsFeature([string]$feature, [bool]$enable) {
  try {
    if ($enable) { Enable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -All -ErrorAction Stop | Out-Null }
    else         { Disable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -ErrorAction Stop | Out-Null }
    return $true
  } catch { return $false }
}

$mode = ($Arg1 -replace '^[-/]+', '').ToLower()

# ===================================================================
switch ($mode) {

# ------------------------------- 상태 확인 (변경하지 않음)
'status' {
  Write-Host ""
  Write-Host "=========================================================="
  Write-Host "  키오스크 개인정보 보호 설정  -  현재 상태 (변경하지 않음)"
  Write-Host "=========================================================="
  Write-Host ""
  Write-Host "  [크롬 정책]"
  $deny = $null
  if (Test-Path $PKEY) {
    $k = Get-ItemProperty $PKEY
    $deny = @(1..8 | ForEach-Object { $k.$_ } | Where-Object { $_ })
  }
  if ($deny) { Write-Host ("        PDF 목적지 차단         : 설정됨  [양호]  ({0})" -f ($deny -join ", ")) }
  else       { Write-Host "        PDF 목적지 차단         : 미설정  [주의] PDF 저장 가능" -ForegroundColor Yellow }

  foreach ($v in @(@{n='AllowFileSelectionDialogs'; t='파일 저장 대화상자 차단'},
                   @{n='DownloadRestrictions';      t='다운로드 차단          '})) {
    $cur = (Get-ItemProperty -Path $CKEY -Name $v.n -ErrorAction SilentlyContinue).($v.n)
    if ($null -ne $cur) { Write-Host ("        {0} : 설정됨  [양호]  (={1})" -f $v.t, $cur) }
    else                { Write-Host ("        {0} : 미설정  [주의]" -f $v.t) -ForegroundColor Yellow }
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
  Write-Host ""
}

# ------------------------------- 되돌리기
'undo' {
  if (-not (Require-Admin)) { break }
  Write-Host ""
  Write-Host "=========================================================="
  Write-Host "  키오스크 개인정보 보호 설정  -  되돌리기"
  Write-Host "=========================================================="
  Write-Host ""
  Write-Host "  [1/2] 크롬 정책 삭제"
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
  Write-Host "  (크롬은 완전히 종료한 뒤 다시 실행해야 정책이 풀립니다.)"
  Write-Host "  ※ /only 로 제거한 다른 프린터는 자동 복원되지 않습니다."
  Write-Host "     [설정] - [Bluetooth 및 장치] - [프린터 및 스캐너] 에서 다시 추가해 주세요."
  Write-Host ""
}

# ------------------------------- 사용법
{ $_ -in 'help','h','?' } {
  Write-Host ""
  Write-Host "  사용법:"
  Write-Host "    관리자_개인정보보호_설정.bat                     설정 적용   (관리자 권한)"
  Write-Host '    관리자_개인정보보호_설정.bat /only "프린터이름"   적용 + 그 프린터만 남기기'
  Write-Host "    관리자_개인정보보호_설정.bat /status             상태만 확인 (변경하지 않음)"
  Write-Host "    관리자_개인정보보호_설정.bat /preview            무엇이 바뀔지 미리보기 (변경하지 않음)"
  Write-Host "    관리자_개인정보보호_설정.bat /undo               되돌리기    (관리자 권한)"
  Write-Host ""
  Write-Host "  먼저 /status 로 프린터 이름을 확인한 뒤 /only 로 적용하세요."
  Write-Host ""
}

# ------------------------------- 적용 ('' · only · preview)
{ $_ -in '','only','preview' } {
  # /preview = 같은 절차를 그대로 훑되 아무것도 바꾸지 않는다(권한 불필요)
  $dry = ($mode -eq 'preview')
  if ($mode -eq 'only' -and -not $Arg2) {
    Write-Host ""
    Write-Host "  [!] /only 뒤에 남길 프린터 이름을 큰따옴표로 적어 주세요." -ForegroundColor Yellow
    Write-Host '      예:  관리자_개인정보보호_설정.bat /only "캐논 복합기"'
    Write-Host ""
    Write-Host "      프린터 이름은 /status 로 확인할 수 있습니다."
    Write-Host ""
    break
  }
  if (-not $dry) { if (-not (Require-Admin)) { break } }
  $only = $Arg2

  Write-Host ""
  Write-Host "=========================================================="
  if ($dry) { Write-Host "  키오스크 개인정보 보호 설정  -  미리보기 (변경하지 않음)" }
  else      { Write-Host "  키오스크 개인정보 보호 설정  -  적용" }
  Write-Host "=========================================================="
  Write-Host ""

  Write-Host "  [1/5] 크롬 인쇄창에서 'PDF로 저장' 목적지 없애기"
  try {
    $i = 1
    foreach ($t in 'pdf','cloud','privet','extension') { if (-not $dry) { Set-Policy $PKEY "$i" $t 'String' }; $i++ }
    Write-Host ("        PrinterTypeDenyList = pdf, cloud, privet, extension  →  {0}" -f $(if ($dry) { "설정 예정" } else { "완료" }))
  } catch {
    Write-Host "        [!] 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "        관리자 권한 여부와 보안 정책을 확인해 주세요."
    break
  }

  Write-Host ""
  Write-Host "  [2/5] 파일 저장 대화상자 - 다운로드 차단"
  try {
    if (-not $dry) {
      Set-Policy $CKEY 'AllowFileSelectionDialogs' 0 'DWord'
      Set-Policy $CKEY 'DownloadRestrictions' 3 'DWord'
      Set-Policy $CKEY 'PrintPreviewUseSystemDefaultPrinter' 1 'DWord'
    }
    Write-Host ("        AllowFileSelectionDialogs=0, DownloadRestrictions=3  →  {0}" -f $(if ($dry) { "설정 예정" } else { "완료" }))
  } catch {
    Write-Host "        [!] 실패: $($_.Exception.Message)" -ForegroundColor Red
    break
  }

  Write-Host ""
  Write-Host "  [3/5] 파일로 저장하는 프린터 제거 (Microsoft Print to PDF, Hancom PDF 등)"
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
    Write-Host ("  [4/5] 지정한 프린터만 남기기  :  {0}" -f $only)
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
    }
  } else {
    Write-Host "  [4/5] 지정 프린터만 남기기  :  건너뜀 (/only 옵션 미사용)"
  }

  Write-Host ""
  Write-Host "  [5/5] 윈도우 기능 끄기 - Print to PDF / XPS (다시 생기지 않도록)"
  Write-Host "        * 1~2분 걸릴 수 있습니다. 창을 닫지 마세요."
  foreach ($f in 'Printing-PrintToPDFServices-Features','Printing-XPSServices-Features') {
    if ($dry) { Write-Host ("        {0} : 끌 예정" -f $f); continue }
    $ok = Set-WindowsFeature $f $false
    Write-Host ("        {0} : {1}" -f $f, $(if ($ok) { "끔" } else { "건너뜀(이미 꺼짐 또는 미지원)" }))
  }

  $all = @(Get-PrinterList)
  # 위 [3/5]에서 다룬 것은 빼고, 실물 포트가 아닌 나머지만 '확인 필요'로 알린다
  $susp = @($all | Where-Object { -not (Test-RealPort $_) -and -not (Test-Virtual $_) })

  Write-Host ""
  Write-Host "----------------------------------------------------------"
  if ($dry) {
    Write-Host "  미리보기입니다. 실제로 적용된 것은 없습니다."
    Write-Host "  적용하려면 이 파일을 마우스 오른쪽 - [관리자 권한으로 실행] 하세요."
  } else {
    Write-Host "  설정을 마쳤습니다."
  }
  Write-Host ""
  if (-not $dry) {
    Write-Host ""
    Write-Host "  * 크롬이 실행 중이면 완전히 종료한 뒤 다시 실행해야 적용됩니다."
    Write-Host "  * 윈도우를 한 번 재시작하면 확실합니다."
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
  Write-Host "        1) 일반 크롬 창에서 chrome://policy 접속"
  Write-Host "           PrinterTypeDenyList 가 pdf, cloud, privet, extension 인지 확인"
  Write-Host "        2) 도우미 화면에서 [인쇄]를 눌러 인쇄창을 열고"
  Write-Host "           프린터 목록에 'PDF로 저장'이 없는지 확인"
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
