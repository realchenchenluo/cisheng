@echo off
setlocal
cd /d "%~dp0"
title WordVoice - YTJ
set "PORT=8787"

where python >nul 2>nul
if errorlevel 1 goto try_py
set "PYTHON=python"
goto start_server

:try_py
where py >nul 2>nul
if errorlevel 1 goto open_file
set "PYTHON=py -3"

:start_server
echo.
echo   WordVoice - local web page
echo   http://127.0.0.1:%PORT%/
echo.
echo   Keep this window open while you use the page.
echo   Close this window to stop the local server.
echo.
start "" /b %PYTHON% -m http.server %PORT% --bind 127.0.0.1 >nul 2>nul
ping -n 3 127.0.0.1 >nul
start "" "http://127.0.0.1:%PORT%/"
pause >nul
goto :eof

:open_file
echo.
echo   Python was not found. Opening the page directly...
echo   If dictionary lookup does not work, install Python or use Chrome / Edge.
echo.
start "" "%~dp0index.html"
timeout /t 2 /nobreak >nul
