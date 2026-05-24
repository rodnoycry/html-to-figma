param(
    [int]$Issue
)

$ErrorActionPreference = "Stop"

$RepoFull = gh repo view --json nameWithOwner -q ".nameWithOwner" 2>$null
if (-not $RepoFull) {
    Write-Error "Not in a GitHub repo, or gh CLI not authenticated."
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PromptFile = Join-Path $ScriptDir "prompt.md"

if (-not (Test-Path $PromptFile)) {
    Write-Error "Prompt file not found at $PromptFile"
    exit 1
}

$Prompt = Get-Content $PromptFile -Raw -Encoding utf8

if ($Issue) {
    $Issues = gh issue view $Issue --repo $RepoFull --json number,title,body,comments 2>$null
    if (-not $Issues) {
        Write-Error "Issue #$Issue not found."
        exit 1
    }
    $Issues = "[$Issues]"
} else {
    $Issues = gh issue list --repo $RepoFull --state open --json number,title,body,comments 2>$null
    if (-not $Issues) { $Issues = "[]" }
}

$RalphCommits = git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>$null
if (-not $RalphCommits) { $RalphCommits = "No RALPH commits found" }

$FullPrompt = @"
ISSUES: $Issues

Previous RALPH commits: $RalphCommits

$Prompt
"@

Set-Clipboard $FullPrompt
Write-Host "Prompt copied to clipboard. Paste it into an interactive Claude session."
