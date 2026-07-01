@echo off
title BLESSED Storefront Auto-Push
echo ==========================================
echo       BLESSED Storefront - Push to Git
echo ==========================================
echo.

:: Check if git is initialized
if not exist .git (
    echo Git is not initialized. Initializing repo...
    git init
    git branch -M main
    git remote add origin https://github.com/BLESSED22456/BLESSED.git
    echo Repository linked to https://github.com/BLESSED22456/BLESSED.git
    echo.
)

:: Automatically configure Git identity for this repository if not set
git config user.email >nul 2>&1
if %errorlevel% neq 0 (
    echo Configuring local Git identity...
    git config user.email "h56797771@gmail.com"
    git config user.name "BLESSED"
    echo Git identity configured successfully.
    echo.
)

:: Check if remote is added (in case .git exists but remote doesn't)
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo Adding remote origin...
    git remote add origin https://github.com/BLESSED22456/BLESSED.git
    echo.
)

echo Staging changes...
git add .
echo.

echo Committing changes...
set commit_msg=Storefront Update: %date% %time%
git commit -m "%commit_msg%"
echo.

echo Pushing to GitHub (origin main)...
git push -u origin main
echo.

echo ==========================================
echo Git synchronization process complete.
echo ==========================================
echo.
pause
