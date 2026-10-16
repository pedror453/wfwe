; Кермо: розширення інсталятора electron-builder (NSIS 3, Unicode; файл у UTF-8 з BOM).
; Перевірка залежностей, запис адреси сервера з параметра /SERVER=, чисте видалення.
!include "FileFunc.nsh"
!include "LogicLib.nsh"

Var kermoTmp
Var kermoParams
Var kermoServer
Var kermoPd
Var kermoFile

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
  ${GetOptions} $kermoParams "/SERVER=" $kermoServer
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
