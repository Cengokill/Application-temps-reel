@echo off
REM Script de démarrage du Tableau de Bord Collaboratif pour Windows

echo ==========================================
echo Tableau de Bord Collaboratif
echo ==========================================
echo.

REM Vérifier si Node.js est installé
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Erreur: Node.js n'est pas installe
    echo Installez Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Naviguer dans le dossier server
cd server

REM Vérifier si node_modules existe
if not exist "node_modules\" (
    echo Installation des dependances...
    call npm install
    echo.
)

REM Démarrer le serveur
echo Demarrage du serveur...
echo.
npm start

