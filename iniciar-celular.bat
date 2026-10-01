@echo off
chcp 65001 >nul
title Coinzinho - servidor + tunel HTTPS
cd /d "%~dp0"

REM =====================================
REM  COINZINHO NO CELULAR
REM  Dois cliques aqui: sobe o servidor e abre o tunel HTTPS.
REM =====================================

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)

if not exist cloudflared.exe (
  echo Baixando o cloudflared ^(so na primeira vez, ~60 MB^)...
  curl.exe -L --fail -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  if errorlevel 1 (
    echo Falha ao baixar o cloudflared. Verifique a internet e tente de novo.
    del cloudflared.exe 2>nul
    pause
    exit /b 1
  )
)

node celular.js
pause
