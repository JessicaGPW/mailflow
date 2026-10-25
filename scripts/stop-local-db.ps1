$ErrorActionPreference = "Stop"

$demoEnv = Join-Path (Get-Location) ".env.demo"
if (-not (Test-Path $demoEnv)) {
  throw ".env.demo não existe; não é possível localizar as credenciais locais."
}

$databaseLine = Get-Content $demoEnv | Where-Object { $_.StartsWith("DATABASE_URL=") } | Select-Object -First 1
if (-not $databaseLine) {
  throw "DATABASE_URL não foi encontrada em .env.demo."
}
$databaseUri = [uri]$databaseLine.Substring("DATABASE_URL=".Length)
$credentials = $databaseUri.UserInfo.Split(":", 2)
if ($credentials.Length -ne 2) {
  throw "DATABASE_URL local não contém credenciais reconhecidas."
}

$admin = Get-ChildItem "C:\Program Files\MariaDB*\bin\mariadb-admin.exe" -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $admin) {
  throw "mariadb-admin.exe não foi encontrado."
}

& $admin.FullName "--host=127.0.0.1" "--port=$($databaseUri.Port)" "--user=$($credentials[0])" "--password=$($credentials[1])" shutdown
if ($LASTEXITCODE -ne 0) {
  throw "Não foi possível desligar o MariaDB local."
}
Write-Output "MariaDB local foi desligado; os dados permanecem em %LOCALAPPDATA%\MailFlow\MariaDB."
