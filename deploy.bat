@echo off
echo ========================================
echo  CovoitAir Backend Deployment Script
echo ========================================
echo.
echo Adding all changes...
git add .
echo.
set /p commit_msg="Enter commit message: "
echo.
echo Committing changes...
git commit -m "%commit_msg%"
echo.
echo Pushing to GitHub (will trigger Railway deployment)...
git push origin V-0.1-13-feb
echo.
echo ========================================
echo  Deployment initiated! 
echo  Railway will automatically deploy from GitHub.
echo  Check https://airport-app-production.up.railway.app
echo ========================================
pause