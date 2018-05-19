@echo off

node.exe -v >nul 2>&1
if %ERRORLEVEL%==9009 goto :error

if exist node_modules\* goto run

call npm install --no-bin-links --no-package-lock

call npm install --prefix .\plugins\discord .\plugins\discord --no-bin-links --no-package-lock
call npm install --prefix .\plugins\scorecard .\plugins\scorecard --no-bin-links --no-package-lock

rmdir /S /Q .\plugins\discord\etc
rmdir /S /Q .\plugins\scorecard\etc

:run
node ameto.js
exit /B 0

:error
echo Node.js runtime not found in path.
exit /B 1