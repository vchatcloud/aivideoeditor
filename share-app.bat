@echo off
echo.
echo ========================================================
echo   KT Auto Movie - External Sharing Tool (Ngrok)
echo ========================================================
echo.
echo 1. Please login/signup at: https://dashboard.ngrok.com/signup
echo 2. Copy your Authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
echo.
set /p NGROK_TOKEN="Paste your Ngrok Authtoken here: "

if "%NGROK_TOKEN%"=="" (
    echo Error: Token is required.
    pause
    exit /b
)

echo.
echo Configuring Ngrok...
call npx ngrok config add-authtoken %NGROK_TOKEN%

echo.
echo Starting Share URL...
echo (Press Ctrl+C to stop sharing)
echo.
call npx ngrok http 3000
