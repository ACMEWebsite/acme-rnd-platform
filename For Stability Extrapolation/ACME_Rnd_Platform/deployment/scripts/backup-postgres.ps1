param(
    [Parameter(Mandatory = $true)][string]$BackupDirectory,
    [int]$RetentionDays = 30
)
$ErrorActionPreference = "Stop"
$resolvedProject = Resolve-Path (Join-Path $PSScriptRoot "..\..")
New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
$resolvedBackup = (Resolve-Path $BackupDirectory).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $resolvedBackup "acme-rnd-$timestamp.dump"
$containerFile = "/tmp/acme-rnd-backup.dump"
Push-Location $resolvedProject
try {
    docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --file=/tmp/acme-rnd-backup.dump'
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
    docker compose cp "db:$containerFile" $backupFile
    if ($LASTEXITCODE -ne 0) { throw "Copying the database backup failed." }
    docker compose exec -T db rm -f $containerFile
    Get-ChildItem -LiteralPath $resolvedBackup -File -Filter "acme-rnd-*.dump" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force
    Write-Output "Backup completed: $backupFile"
} finally { Pop-Location }
