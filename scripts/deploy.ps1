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

Write-Step "Building on $SSH_HOST"
$remoteCmd = "set -e; cd $REMOTE_PATH && git pull origin $BRANCH && npm ci && npm run build"
& ssh $SSH_HOST $remoteCmd
if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy failed with exit code $LASTEXITCODE"
}

Write-Step "Verifying site"
& ssh $SSH_HOST "curl -sI http://localhost/ -H 'Host: tetrazero.com' | head -1"
if ($LASTEXITCODE -ne 0) {
    throw "Deploy verification failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Deploy complete: https://tetrazero.com" -ForegroundColor Green
