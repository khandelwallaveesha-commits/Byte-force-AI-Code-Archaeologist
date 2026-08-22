@echo off
REM ---------------------------------------------------------------------
REM  Deploy this folder to Firebase Hosting.
REM
REM  Node was installed portably (no admin, nothing added to your PATH),
REM  so this script points at it before calling the Firebase CLI.
REM
REM    deploy login       sign in with your Google account  (do this once)
REM    deploy use --add   choose which Firebase project to publish to (once)
REM    deploy             publish the site
REM ---------------------------------------------------------------------
setlocal
set "NODE_DIR=C:\Users\lenovo\tools\node-v24.19.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "%~dp0"

if not exist "%NODE_DIR%\node.exe" (
  echo Node is missing from %NODE_DIR%
  echo Re-download it from https://nodejs.org and update NODE_DIR above.
  exit /b 1
)

if "%~1"=="" (
  echo Publishing to Firebase Hosting...
  call firebase deploy --only hosting
) else (
  call firebase %*
)
endlocal
