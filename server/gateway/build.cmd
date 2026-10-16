@echo off
setlocal
rem Builds KermoGateway.exe with the C# compiler that ships with Windows (.NET Framework 4.x), x86 because the 1C 8.1 COM connector is 32-bit.
set CSC=%windir%\Microsoft.NET\Framework\v4.0.30319\csc.exe
set OUT=%~dp0..\..\build
if not exist "%OUT%" mkdir "%OUT%"
"%CSC%" /nologo /platform:x86 /codepage:65001 /optimize+ /target:exe /out:"%OUT%\KermoGateway.exe" /r:System.Web.Extensions.dll "%~dp0src\*.cs"
if errorlevel 1 exit /b 1
echo OK: %OUT%\KermoGateway.exe
