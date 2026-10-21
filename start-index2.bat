@echo off
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 goto use_py

where python >nul 2>nul
if errorlevel 1 (
  echo Python is required to serve the website locally.
  echo Install Python, or use: npm start
  pause
  exit /b 1
)
start "Tapa website server" python -m http.server 5187 --bind 127.0.0.1
goto open_site

:use_py
start "Tapa website server" py -m http.server 5187 --bind 127.0.0.1

:open_site
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5187/index2.html"
