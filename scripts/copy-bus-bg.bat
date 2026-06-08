@echo off
copy "C:\Users\Arjie\Downloads\1000026282.jpg" "C:\Users\Arjie\Downloads\metrolink-backend\metrolink-backend\frontend\bus-bg.jpg" /Y
copy "C:\Users\Arjie\Downloads\1000026282.jpg" "C:\Users\Arjie\tomcat\apache-tomcat-10.1.39\webapps\metrolink-frontend\bus-bg.jpg" /Y
echo Done > "%~dp0copy-log.txt"
