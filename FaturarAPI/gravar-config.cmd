@echo off
setlocal
if "%~1"=="" (
  echo Uso: gravar-config.cmd "a-tua-chave" [http://localhost:50738]
  exit /b 1
)

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo Nao encontrei o compilador do .NET Framework.
  exit /b 1
)

"%CSC%" /nologo /t:exe /out:"%TEMP%\AlphaFaturaConfig.exe" "%~dp0gravar-config.cs"
if errorlevel 1 exit /b 1

if "%~2"=="" (
  "%TEMP%\AlphaFaturaConfig.exe" "%~dp0config.json" "%~1"
) else (
  "%TEMP%\AlphaFaturaConfig.exe" "%~dp0config.json" "%~1" "%~2"
)
exit /b %ERRORLEVEL%
