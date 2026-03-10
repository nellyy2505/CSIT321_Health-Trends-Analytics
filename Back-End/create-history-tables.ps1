# Create DynamoDB tables for local/dev (Profiles, Upload History, Scan History).
# Run from Back-End folder. Requires AWS CLI configured.
# Usage: .\create-history-tables.ps1

$ErrorActionPreference = "Stop"

Write-Host "Creating CareDataProfiles-dev (auth profile)..." -ForegroundColor Cyan
aws dynamodb create-table `
  --table-name CareDataProfiles-dev `
  --attribute-definitions AttributeName=sub,AttributeType=S `
  --key-schema AttributeName=sub,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  2>$null
if ($LASTEXITCODE -eq 0) { Write-Host "  Created." -ForegroundColor Green } else { Write-Host "  (may already exist)" -ForegroundColor Yellow }

$Table1 = "CareDataUploadHistory-dev"
$Table2 = "CareDataScanHistory-dev"

Write-Host "Creating $Table1 (CSV upload history)..." -ForegroundColor Cyan
aws dynamodb create-table `
  --table-name $Table1 `
  --attribute-definitions AttributeName=sub,AttributeType=S AttributeName=upload_id,AttributeType=S `
  --key-schema AttributeName=sub,KeyType=HASH AttributeName=upload_id,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST `
  2>$null
if ($LASTEXITCODE -eq 0) { Write-Host "  Created." -ForegroundColor Green } else { Write-Host "  (may already exist)" -ForegroundColor Yellow }

Write-Host "Creating $Table2 (Health Scan history)..." -ForegroundColor Cyan
aws dynamodb create-table `
  --table-name $Table2 `
  --attribute-definitions AttributeName=sub,AttributeType=S AttributeName=scan_id,AttributeType=S `
  --key-schema AttributeName=sub,KeyType=HASH AttributeName=scan_id,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST `
  2>$null
if ($LASTEXITCODE -eq 0) { Write-Host "  Created." -ForegroundColor Green } else { Write-Host "  (may already exist)" -ForegroundColor Yellow }

Write-Host ""
Write-Host "Done. Restart the backend, then upload a CSV or run a Health Scan; items will show in Uploaded History." -ForegroundColor Green
