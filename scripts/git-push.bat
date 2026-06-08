@echo off
cd /d C:\Users\Arjie\Downloads\metrolink-backend\metrolink-backend
echo Current git status:
git status
echo.
echo Staging all changes...
git add -A
echo.
echo Committing...
git commit -m "feat: split login layout with bus photo background, CoreUI palette redesign"
echo.
echo Pushing to remote...
git push
echo.
echo Done!
pause
