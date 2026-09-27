$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host " Project Golden Child - Admin Setup Assistant" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed or cannot be found." -ForegroundColor Red
    Write-Host "Install Node.js 22 or newer, then run this file again."
    Read-Host "Press Enter to close"
    exit 1
}

$email = Read-Host "Enter the email address you want to use to log in"
if ([string]::IsNullOrWhiteSpace($email)) {
    Write-Host "Email cannot be blank." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$name = Read-Host "Enter administrator name [Adam Walker]"
if ([string]::IsNullOrWhiteSpace($name)) { $name = "Adam Walker" }

$role = Read-Host "Enter role [director]"
if ([string]::IsNullOrWhiteSpace($role)) { $role = "director" }

Write-Host ""
Write-Host "Choose your admin password. Nothing will appear while you type." -ForegroundColor Cyan
$securePassword = Read-Host "Password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($plainPassword) -or $plainPassword.Length -lt 12) {
    Write-Host "Use a password of at least 12 characters." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "Generating your secure admin account..." -ForegroundColor Cyan

$raw = & node "scripts/create-admin-user.mjs" $email $plainPassword $name $role 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ($raw -join "`n") -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$joined = $raw -join "`n"
$jsonMatch = [regex]::Match($joined, '(?s)\{.*?\}')
if (-not $jsonMatch.Success) {
    Write-Host "Could not read the generated administrator details." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$userObj = $jsonMatch.Value | ConvertFrom-Json
$adminJson = ConvertTo-Json -InputObject @($userObj) -Compress

$secretMatch = [regex]::Match($joined, 'Authenticator secret:\s*([A-Z2-7]+)')
$authSecret = if ($secretMatch.Success) { $secretMatch.Groups[1].Value } else { "" }

$otpMatch = [regex]::Match($joined, '(otpauth://[^\r\n]+)')
$otpUri = if ($otpMatch.Success) { $otpMatch.Groups[1].Value } else { "" }

$sessionSecret = (& node -e "console.log(require('crypto').randomBytes(48).toString('hex'))").Trim()

$outFile = Join-Path $PSScriptRoot "PGC-VERCEL-SETUP.txt"

$content = @"
PROJECT GOLDEN CHILD - VERCEL SETUP VALUES
===========================================

1. ADMIN_USERS_JSON
Paste this entire line into Vercel:

$adminJson

2. SESSION_SECRET
Paste this entire line into Vercel:

$sessionSecret

3. AUTHENTICATOR SETUP SECRET
Use this when adding Project Golden Child to Microsoft Authenticator / Google Authenticator:

$authSecret

4. AUTHENTICATOR URI
If your authenticator app allows you to enter an otpauth URI:

$otpUri

5. OTHER VERCEL VARIABLES YOU NEED
SUPABASE_URL = your Supabase Project URL
SUPABASE_SECRET_KEY = your Supabase sb_secret_... key
PUBLIC_BASE_URL = your live website address
PGC_LOCAL_DEV = 0

IMPORTANT
---------
Keep this file private.
Do not upload it to GitHub.
Delete it from your computer after Vercel and your authenticator have been set up and tested.
"@

Set-Content -LiteralPath $outFile -Value $content -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS." -ForegroundColor Green
Write-Host ""
Write-Host "I have created:" -ForegroundColor White
Write-Host "  PGC-VERCEL-SETUP.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open that file. It contains the exact values you need to paste into Vercel." -ForegroundColor White
Write-Host ""
Write-Host "Your password has NOT been saved in that file." -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close"
