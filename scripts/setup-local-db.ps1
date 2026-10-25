$ErrorActionPreference = "Stop"

$installDb = Get-ChildItem "C:\Program Files\MariaDB*\bin\mariadb-install-db.exe" -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $installDb) {
  throw "MariaDB não foi encontrado. Instale MariaDB Server antes de continuar."
}

$bin = Split-Path $installDb.FullName
$stateDir = Join-Path $env:LOCALAPPDATA "MailFlow\MariaDB"
$dataDir = Join-Path $stateDir "data"
$demoEnv = Join-Path (Get-Location) ".env.demo"
if (Test-Path $demoEnv) {
  throw ".env.demo já existe; o script não irá sobrescrever suas configurações."
}
if (Test-Path $dataDir) {
  throw "Os dados locais do MariaDB já existem em $dataDir; nada foi alterado."
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 3307)
try {
  $listener.Start()
} catch {
  throw "A porta 3307 já está em uso. Encerre o serviço que a utiliza ou ajuste a porta no script."
} finally {
  $listener.Stop()
}

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$databasePassword = [guid]::NewGuid().ToString("N")
& (Join-Path $bin "mariadb-install-db.exe") "--datadir=$dataDir" "--password=$databasePassword" "--port=3307" "--silent"
if ($LASTEXITCODE -ne 0) {
  throw "Não foi possível inicializar o banco MariaDB (código $LASTEXITCODE)."
}

$stdout = Join-Path $stateDir "server.log"
$stderr = Join-Path $stateDir "server-error.log"
$serverArgs = @("--datadir=$dataDir", "--port=3307", "--bind-address=127.0.0.1", "--console")
$server = Start-Process `
  -FilePath (Join-Path $bin "mariadbd.exe") `
  -ArgumentList $serverArgs `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr `
  -PassThru

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  Start-Sleep -Seconds 1
  & (Join-Path $bin "mariadb.exe") "--host=127.0.0.1" "--port=3307" "--user=root" "--password=$databasePassword" "--execute=SELECT 1" 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  if ($server.HasExited) {
    break
  }
}
if (-not $ready) {
  Get-Content $stderr -ErrorAction SilentlyContinue | Select-Object -Last 20
  throw "MariaDB não iniciou. Consulte os logs em $stateDir."
}

& (Join-Path $bin "mariadb.exe") "--host=127.0.0.1" "--port=3307" "--user=root" "--password=$databasePassword" "--execute=CREATE DATABASE mailflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
if ($LASTEXITCODE -ne 0) {
  throw "MariaDB iniciou, mas não foi possível criar o banco de demonstração."
}

$jwtSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$trackingSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
@(
  "DATABASE_URL=mysql://root:$databasePassword@127.0.0.1:3307/mailflow"
  "DATABASE_SSL=false"
  "JWT_SECRET=$jwtSecret"
  "TRACKING_SECRET=$trackingSecret"
  "PORT=3000"
  "PUBLIC_ORIGIN=http://localhost:3000"
  "DEMO_ADMIN_EMAIL=demo@mailflow.local"
  "DEMO_ADMIN_PASSWORD=DemoMailflow123!"
) | Set-Content -Path $demoEnv -Encoding ascii

Write-Output "MariaDB local está pronto em 127.0.0.1:3307; os dados ficam fora do repositório."
Write-Output "Configuração gravada em .env.demo. A conta fictícia será criada pelo comando db:demo."
Write-Output "Login de demonstração: demo@mailflow.local / DemoMailflow123!"
