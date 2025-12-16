@echo off
REM Scheduled sync wrapper script for Windows Task Scheduler
REM This script runs the scheduled sync and logs output to a file

setlocal

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

REM Change to project directory
cd /d "%PROJECT_ROOT%"

REM Set log file path (in project root)
REM Generate date string in YYYYMMDD format using PowerShell
for /f "delims=" %%I in ('powershell -Command "Get-Date -Format 'yyyyMMdd'"') do set "DATE_STR=%%I"
set "LOG_FILE=%PROJECT_ROOT%\logs\scheduled-sync-%DATE_STR%.log"
set "LOG_DIR=%PROJECT_ROOT%\logs"

REM Create logs directory if it doesn't exist
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Run the scheduled sync script
REM Redirect both stdout and stderr to the log file
bun run src/cli/scheduled-sync.ts --log "%LOG_FILE%" >> "%LOG_FILE%" 2>&1

REM Exit with the same code as the script
exit /b %ERRORLEVEL%

