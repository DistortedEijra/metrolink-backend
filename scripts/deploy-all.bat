@echo off
set SRC=C:\Users\Arjie\Downloads\metrolink-backend\metrolink-backend\frontend
set DEST=C:\Users\Arjie\tomcat\apache-tomcat-10.1.39\webapps\metrolink-frontend
set IMG=C:\Users\Arjie\Downloads\1000026282.jpg

echo Deploying to Tomcat...
copy /Y "%SRC%\app.css" "%DEST%\app.css"
copy /Y "%SRC%\app.js" "%DEST%\app.js"
copy /Y "%IMG%" "%DEST%\bus-bg.jpg"
copy /Y "%IMG%" "%SRC%\bus-bg.jpg"

rem Bump cache-busting version so browsers fetch the new app.css/app.js instead of a cached copy
for /f %%v in ('powershell -NoProfile -Command "[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()"') do set CACHEVER=%%v
powershell -NoProfile -Command "(Get-Content '%SRC%\index.html') -replace '\?v=\d+', '?v=%CACHEVER%' | Set-Content '%SRC%\index.html'"
copy /Y "%SRC%\index.html" "%DEST%\index.html"
if not exist "%DEST%\WEB-INF" mkdir "%DEST%\WEB-INF"
copy /Y "%SRC%\WEB-INF\web.xml" "%DEST%\WEB-INF\web.xml"
echo.
echo All done! Check results:
dir "%DEST%"
pause
