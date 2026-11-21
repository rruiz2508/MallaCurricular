@echo off
rem Inicia el Sistema de Gestion de Malla Curricular en modo autonomo (un solo proceso).
rem Requisitos: Python 3.12+, Node.js (solo la primera vez, para compilar el frontend)
rem y los archivos backend\.env y frontend\.env.local con las credenciales de Supabase.
setlocal
cd /d "%~dp0"

if not exist "frontend\dist\index.html" (
  echo Compilando el frontend ^(solo la primera vez^)...
  pushd frontend
  call npm install || goto :error
  call npm run build || goto :error
  popd
)

if not exist "backend\.venv\Scripts\uvicorn.exe" (
  echo Preparando el entorno de Python ^(solo la primera vez^)...
  pushd backend
  python -m venv .venv || goto :error
  call .venv\Scripts\python -m pip install -e . || goto :error
  popd
)

start "" http://localhost:8000
cd backend
.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000
goto :eof

:error
echo.
echo Fallo la preparacion. Revise el mensaje anterior.
pause
exit /b 1
