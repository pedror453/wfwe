; Кермо: розширення інсталятора electron-builder (NSIS 3, Unicode; файл у UTF-8 з BOM).
; Перевірка залежностей, запис адреси сервера з параметра /SERVER=, чисте видалення.
!include "FileFunc.nsh"
!include "LogicLib.nsh"

Var kermoTmp
Var kermoParams
Var kermoServer
Var kermoPd
Var kermoFile
Var kermoLen
Var kermoIdx

; Шукає в параметрах запуску "/SERVER=значення": значення — до пробілу або лапки; символ "/" в адресі допускається.
Function KermoParseServer
  StrCpy $kermoServer ""
  StrLen $kermoLen $kermoParams
  StrCpy $kermoIdx 0
  kermoScan:
    IntCmp $kermoIdx $kermoLen kermoScanDone 0 kermoScanDone
    StrCpy $kermoTmp $kermoParams 8 $kermoIdx
    StrCmp $kermoTmp "/SERVER=" kermoFound
    IntOp $kermoIdx $kermoIdx + 1
    Goto kermoScan
  kermoFound:
    IntOp $kermoIdx $kermoIdx + 8
    StrCpy $kermoServer $kermoParams "" $kermoIdx
    StrCpy $kermoTmp $kermoServer 1
    StrCmp $kermoTmp '"' 0 kermoNoQuote
      StrCpy $kermoServer $kermoServer "" 1
    kermoNoQuote:
    StrLen $kermoLen $kermoServer
    StrCpy $kermoIdx 0
  kermoCut:
    IntCmp $kermoIdx $kermoLen kermoCutDone 0 kermoCutDone
    StrCpy $kermoTmp $kermoServer 1 $kermoIdx
    StrCmp $kermoTmp " " kermoCutDone
    StrCmp $kermoTmp '"' kermoCutDone
    IntOp $kermoIdx $kermoIdx + 1
    Goto kermoCut
  kermoCutDone:
    StrCmp $kermoIdx 0 kermoEmpty
    StrCpy $kermoServer $kermoServer $kermoIdx
    Goto kermoScanDone
  kermoEmpty:
    StrCpy $kermoServer ""
  kermoScanDone:
FunctionEnd

!macro customInit
  ; Electron 23+ не працює на Windows 7/8.x: потрібна Windows 10 (збірка 10240) або новіша.
  ReadRegStr $kermoTmp HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  ${If} $kermoTmp == ""
    StrCpy $kermoTmp "0"
  ${EndIf}
  ${If} $kermoTmp < 10240
    MessageBox MB_OK|MB_ICONSTOP "Для роботи програми «Кермо» потрібна Windows 10 або новіша." /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customInstall
  ; Тиха інсталяція: Kermo-Setup.exe /S /SERVER=http://адреса:8480 — адреса зберігається для всіх користувачів комп'ютера.
  ; У файл потрапляє лише текст адреси; програма сама перевіряє й нормалізує його (config.js).
  ${GetParameters} $kermoParams
  Call KermoParseServer
  ${If} $kermoServer != ""
    StrCpy $kermoTmp $kermoServer 4
    ${If} $kermoTmp == "http"
      ReadEnvStr $kermoPd "ProgramData"
      ${If} $kermoPd == ""
        StrCpy $kermoPd "C:\ProgramData"
      ${EndIf}
      CreateDirectory "$kermoPd\Kermo"
      FileOpen $kermoFile "$kermoPd\Kermo\server.url" w
      FileWrite $kermoFile "$kermoServer"
      FileClose $kermoFile
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ; Під час оновлення (старий деінсталятор запускає новий інсталятор) налаштування лишаємо.
  ${ifNot} ${isUpdated}
    ReadEnvStr $kermoPd "ProgramData"
    ${If} $kermoPd == ""
      StrCpy $kermoPd "C:\ProgramData"
    ${EndIf}
    Delete "$kermoPd\Kermo\server.url"
    RMDir "$kermoPd\Kermo"
  ${endIf}
!macroend
