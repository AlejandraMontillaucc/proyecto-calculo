param(
  [int]$Port = 5000,
  [string]$Host = "127.0.0.1"
)

Write-Host "Iniciando backend Flask en $Host:$Port..." -ForegroundColor Cyan

# Activar venv si existe
$venvActivate = Join-Path $PSScriptRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
  Write-Host "Activando entorno virtual (.venv)" -ForegroundColor Green
  . $venvActivate
} else {
  Write-Warning "No se encontró .venv; ejecuta: python -m venv .venv"
}

# Instalar dependencias si faltan
$req = Join-Path $PSScriptRoot "requirements.txt"
if (Test-Path $req) {
  Write-Host "Instalando dependencias desde requirements.txt" -ForegroundColor Green
  pip install -r $req | Out-Host
}

# Ejecutar app.py (usa puerto 5000 por defecto según el código actual)
python "$PSScriptRoot\app.py"

Write-Host "Backend finalizado." -ForegroundColor Yellow