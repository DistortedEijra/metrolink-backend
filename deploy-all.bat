@echo off
set SRC=C:\Users\Arjie\Downloads\metrolink-backend\metrolink-backend\frontend
set DEST=C:\Users\Arjie\tomcat\apache-tomcat-10.1.39\webapps\metrolink-frontend
set IMG=C:\Users\Arjie\Downloads\1000026282.jpg

echo Deploying to Tomcat...
copy /Y "%SRC%\app.css" "%DEST%\app.css"
copy /Y "%SRC%\app.js" "%DEST%\app.js"
copy /Y "%IMG%" "%DEST%\bus-bg.jpg"
copy /Y "%IMG%" "%SRC%\bus-bg.jpg"
echo.
echo All done! Check results:
dir "%DEST%"
pause
