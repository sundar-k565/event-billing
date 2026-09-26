$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Stop-WithMessage([string]$Message) {
  Write-Host $Message -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}

if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) {
  Stop-WithMessage 'Docker Desktop is not installed. Install it from https://www.docker.com/products/docker-desktop/ and run this launcher again.'
}
docker.exe info *> $null
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'Docker Desktop is installed but not running. Open Docker Desktop, wait until it says Engine running, then run this launcher again.'
}
docker.exe compose version *> $null
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'Docker Compose is missing. Update Docker Desktop, restart it, then run this launcher again.'
}

if (-not (Test-Path -LiteralPath '.env')) {
  $random = New-Object byte[] 24
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $generator.GetBytes($random)
  $databasePassword = [System.BitConverter]::ToString($random).Replace('-', '').ToLowerInvariant()
  $generator.GetBytes($random)
  $appPassword = [System.BitConverter]::ToString($random).Replace('-', '').ToLowerInvariant()
  $generator.GetBytes($random)
  $adminPassword = [System.BitConverter]::ToString($random).Replace('-', '').ToLowerInvariant()
  $generator.Dispose()
  $lines = @(
    "POSTGRES_PASSWORD=$databasePassword",
    "APP_DATABASE_PASSWORD=$appPassword",
    'BOOTSTRAP_ADMIN_EMAIL=admin@waaat.local',
    "BOOTSTRAP_ADMIN_PASSWORD=$adminPassword",
    'APP_BIND_ADDRESS=127.0.0.1',
    'APP_PORT=3000',
    'COOKIE_SECURE=false'
  )
  [System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot '.env'), [string[]]$lines, [System.Text.Encoding]::ASCII)
  $credential = @(
    'WAAAT POS sign-in',
    '',
    'Email: admin@waaat.local',
    "Password: $adminPassword",
    '',
    'Keep this file private. Use the Users page in the app to add staff.'
  ) -join "`r`n"
  [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'WAAAT-Login.txt'), $credential, [System.Text.Encoding]::ASCII)
  Write-Host 'Saved your new administrator sign-in in WAAAT-Login.txt.' -ForegroundColor Green
}

if (Test-Path -LiteralPath 'waaat-images.tar') {
  docker.exe image load -i (Join-Path $PSScriptRoot 'waaat-images.tar')
  if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Could not install the WAAAT app images. Please run Start-WAAAT.bat again.' }
}

Write-Host 'Starting WAAAT POS. First start can take a few minutes.' -ForegroundColor Cyan
docker.exe compose -f compose.yaml up -d --wait --wait-timeout 240
if ($LASTEXITCODE -ne 0) {
  docker.exe compose -f compose.yaml logs --tail 30 init waaat-pos db
  Stop-WithMessage 'The app could not start. Check Docker Desktop is running and you have at least 4 GB of free memory.'
}
Write-Host 'WAAAT POS is ready at http://127.0.0.1:3000/login' -ForegroundColor Green
Start-Process 'http://127.0.0.1:3000/login'
Read-Host 'Press Enter to close this window. The app will keep running'
