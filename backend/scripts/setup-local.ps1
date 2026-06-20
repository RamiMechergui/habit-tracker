# backend/scripts/setup-local.ps1
# ──────────────────────────────────────────────────────────────────────────────
# Powershell script to boot up DynamoDB Local and bootstrap tables.
#
# Usage:
#   .\backend\scripts\setup-local.ps1

$port = 8000
$endpoint = "http://localhost:$port"

# Check if something is already listening on port 8000
$portActive = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($portActive) {
    Write-Host "[DynamoDB Setup] Port $port is already active. Checking if DynamoDB Local is running..." -ForegroundColor Cyan
} else {
    # Port 8000 is free, try to start DynamoDB Local using docker-compose
    Write-Host "[DynamoDB Setup] Port $port is free. Attempting to start DynamoDB Local via Docker Compose..." -ForegroundColor Cyan

    # Verify if docker exists
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker-compose up -d dynamodb-local
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start Docker Compose. Please verify Docker Desktop is running."
            exit 1
        }
        
        Write-Host "[DynamoDB Setup] Waiting for DynamoDB Local to respond..." -ForegroundColor Yellow
        $retries = 10
        $success = $false
        for ($i = 1; $i -le $retries; $i++) {
            try {
                $response = Invoke-WebRequest -Uri "$endpoint/shell" -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 400) {
                    $success = $true
                    break
                }
            } catch {
                # Ignore connection errors during startup
            }
            Start-Sleep -Seconds 2
        }

        if (-not $success) {
            Write-Error "DynamoDB Local did not respond within the expected time."
            exit 1
        }
    } else {
        Write-Host "WARNING: 'docker' command was not found. Please install Docker, or start DynamoDB Local manually on port $port." -ForegroundColor Yellow
        Write-Host "If you have a local jar of DynamoDB Local, run: java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -port $port" -ForegroundColor Yellow
        Write-Host "Press enter when DynamoDB Local is running on port $port to continue with table creation..."
        Read-Host
    }
}

# Run table creation script
Write-Host "[DynamoDB Setup] Bootstrapping tables on $endpoint..." -ForegroundColor Cyan
node backend/db/createTables.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "[DynamoDB Setup] DynamoDB Local successfully configured and ready to use!" -ForegroundColor Green
} else {
    Write-Error "Table creation failed. Please check if DynamoDB Local is running."
    exit 1
}
