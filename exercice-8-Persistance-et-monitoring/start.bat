@echo off
echo  Application Temps Reel - Demarrage

REM Vérifie si Node.js est installé
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Erreur: Node.js n'est pas installé
    pause
    exit /b 1
)

cd server

REM Vérifie si node_modules existe
if not exist "node_modules" (
    echo Installation des dépendances...
    call npm install
    
    if errorlevel 1 (
        echo.
        echo Erreur lors de l'installation des dépendances
        pause
        exit /b 1
    )
    
    echo.
    echo Dépendances installées
    echo.
)

REM Crée le dossier logs s'il n'existe pas
if not exist "..\logs" (
    mkdir ..\logs
    echo Dossier logs créé
)
echo   Démarrage du serveur...

npm start

pause