@echo off
title ALL THE GLORY - LAN server
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed on the computer that hosts. Get it from https://nodejs.org and run this again.
  pause
  exit /b
)
start "" "%~dp0dist\all-the-glory.html"
node "%~dp0tools\lan.js"
pause
