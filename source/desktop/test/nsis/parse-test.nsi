; Перевірка розбору параметра /SERVER= з installer.nsh: Section викликає customInstall, адреса потрапляє у %ProgramData%\Kermo\server.url.
; Збирається і запускається scripts/test-nsis.ps1 (ProgramData підміняється змінною середовища).
Unicode true
!include "LogicLib.nsh"
!include "FileFunc.nsh"
Name "KermoParseTest"
OutFile "parse-test.exe"
RequestExecutionLevel user
SilentInstall silent
!include "../../installer.nsh"
Section "main"
  !insertmacro customInstall
SectionEnd
