@echo off
echo ========================================
echo   MediCare Pro - Quick Start (Windows)
echo ========================================
echo.
echo Make sure MySQL is running and server\.env is configured!
echo.

echo Installing server dependencies...
cd server
call npm install
echo Server dependencies installed.

echo.
echo Running database migrations...
call npm run migrate
echo Database migrated.

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the backend, run in this terminal:
echo   cd server ^&^& npm run dev
echo.
echo To start the frontend, open a NEW terminal and run:
echo   cd client ^&^& npm install ^&^& npm start
echo.
echo Admin login:
echo   Phone: +919999999999
echo   Password: Admin@123456
echo.
pause
