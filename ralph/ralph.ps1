param(
    [int]$Iterations = 4
)

$ErrorActionPreference = "Stop"

# --- Validation ---

$RepoFull = gh repo view --json nameWithOwner -q ".nameWithOwner" 2>$null
if (-not $RepoFull) {
    Write-Error "Not in a GitHub repo, or gh CLI not authenticated."
    exit 1
}

$Branch = git rev-parse --abbrev-ref HEAD

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PromptFile = Join-Path $ScriptDir "prompt.md"

if (-not (Test-Path $PromptFile)) {
    Write-Error "Prompt file not found at $PromptFile"
    exit 1
}

$Prompt = Get-Content $PromptFile -Raw -Encoding utf8

Write-Host "=== RALPH (local) ==="
Write-Host "Repo:       $RepoFull"
Write-Host "Branch:     $Branch"
Write-Host "Iterations: $Iterations"
Write-Host ""

# --- Main loop ---

for ($i = 1; $i -le $Iterations; $i++) {
    Write-Host ""
    Write-Host "=== Iteration $i/$Iterations ==="
    Write-Host ""

    $HeadBefore = git rev-parse HEAD

    # Fetch open issues
    $Issues = gh issue list --repo $RepoFull --state open --json number,title,body,comments 2>$null
    if (-not $Issues) { $Issues = "[]" }

    # Fetch recent RALPH commits
    $RalphCommits = git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>$null
    if (-not $RalphCommits) { $RalphCommits = "No RALPH commits found" }

    # Build the full prompt
    $FullPrompt = @"
ISSUES: $Issues

Previous RALPH commits: $RalphCommits

$Prompt
"@

    # Run Claude locally
    $TmpFile = [System.IO.Path]::GetTempFileName()

    claude `
        --print `
        --verbose `
        --dangerously-skip-permissions `
        --output-format stream-json `
        --model claude-opus-4-6 `
        -p $FullPrompt 2>&1 |
        ForEach-Object {
            $line = $_
            if ($line -match '^\{') {
                Add-Content -Path $TmpFile -Value $line -Encoding utf8
                try {
                    $obj = $line | ConvertFrom-Json
                    if ($obj.type -eq "assistant") {
                        foreach ($block in $obj.message.content) {
                            if ($block.type -eq "text" -and $block.text) {
                                Write-Host $block.text
                            }
                        }
                    }
                } catch {}
            }
        }

    # Check if Claude made a commit
    $HeadAfter = git rev-parse HEAD

    if ($HeadBefore -ne $HeadAfter) {
        $CommitMsg = git log -1 --format="%s"
        Write-Host ""
        Write-Host "New commit detected: $CommitMsg"
    } else {
        Write-Host ""
        Write-Host "No new commit in this iteration."
    }

    # Check for completion signal
    $ResultLines = Get-Content $TmpFile -Encoding utf8
    Remove-Item $TmpFile -Force -ErrorAction SilentlyContinue

    $FoundComplete = $false
    foreach ($line in $ResultLines) {
        if ($line -match '^\{') {
            try {
                $obj = $line | ConvertFrom-Json
                if ($obj.type -eq "result" -and $obj.result -match "<promise>COMPLETE</promise>") {
                    $FoundComplete = $true
                    break
                }
            } catch {}
        }
    }

    if ($FoundComplete) {
        Write-Host ""
        Write-Host "RALPH complete after $i iteration(s)."
        exit 0
    }
}

Write-Host ""
Write-Host "Completed $Iterations iteration(s)."
