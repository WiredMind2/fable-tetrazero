param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommitMessageParts
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$SSH_HOST = "tetrazero"
$REMOTE_PATH = "/var/www/fable-tetrazero"
$BRANCH = "master"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Git([string[]]$GitArgs) {
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

$status = Invoke-Git @("status", "--porcelain")
if ($status) {
    $message = if ($CommitMessageParts -and $CommitMessageParts.Count -gt 0) {
        $CommitMessageParts -join " "
    } else {
        "deploy: update site ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
    }

    Write-Step "Committing local changes"
    Write-Host $message

    Invoke-Git @("add", "-A")
    Invoke-Git @("commit", "-m", $message)
} else {
    Write-Step "No local changes to commit"
}

Write-Step "Pushing to origin/$BRANCH"
Invoke-Git @("push", "origin", $BRANCH)

Write-Step "Building and restarting on $SSH_HOST"
# Prefer system unit when passwordless sudo works; otherwise user systemd unit.
$remoteCmd = @"
set -e
cd $REMOTE_PATH
git pull origin $BRANCH
npm ci
npm run build
if [ -d /var/www/nyc_trip ]; then
  mkdir -p dist/nyc_trip
  cp -a /var/www/nyc_trip/. dist/nyc_trip/
fi
if [ -d /var/www/calendar ]; then
  mkdir -p dist/calendar
  cp -a /var/www/calendar/. dist/calendar/
fi
pkill -f 'python3 .*server/contact.py' 2>/dev/null || true
if sudo -n true 2>/dev/null; then
  sudo cp deploy/fable-tetrazero.service /etc/systemd/system/fable-tetrazero.service
  sudo systemctl daemon-reload
  sudo systemctl enable fable-tetrazero.service
  sudo systemctl restart fable-tetrazero.service
else
  mkdir -p ~/.config/systemd/user
  cp deploy/fable-tetrazero.user.service ~/.config/systemd/user/fable-tetrazero.service
  systemctl --user daemon-reload
  loginctl enable-linger "`$USER" 2>/dev/null || true
  systemctl --user enable fable-tetrazero.service
  systemctl --user restart fable-tetrazero.service
fi
"@
& ssh $SSH_HOST $remoteCmd
if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy failed with exit code $LASTEXITCODE"
}

Write-Step "Verifying site"
& ssh $SSH_HOST "curl -sI http://127.0.0.1:3080/ | head -1"
if ($LASTEXITCODE -ne 0) {
    throw "Deploy verification failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Deploy complete: https://tetrazero.com" -ForegroundColor Green
Write-Host "Ensure Caddy proxies tetrazero.com -> 127.0.0.1:3080 (see deploy/CADDY.md)" -ForegroundColor Yellow
Write-Host "Webhook lives in $REMOTE_PATH/contact.secret (mode 600); rotate in Discord then overwrite that file." -ForegroundColor Yellow
