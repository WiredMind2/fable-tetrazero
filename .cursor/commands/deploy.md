---
name: deploy
description: Commit local changes, push to GitHub, and deploy to tetrazero.com.
---

# Deploy — commit, push, and publish

Ship the current project to **tetrazero.com** via GitHub and SSH.

**Arguments**: `$ARGUMENTS` — optional commit message. If omitted and there are uncommitted changes, the deploy script uses a timestamped default (`deploy: update site (YYYY-MM-DD HH:mm)`).

Invoking `/deploy` without `dry-run` is explicit approval to commit (when needed), push, and deploy.

## Workflow

1. Review `git status` and `git diff` briefly — warn if secret files (`.env`, credentials) would be committed; never deploy them.
2. Run the deploy script from the repo root:

```powershell
npm run deploy -- $ARGUMENTS
```

If `$ARGUMENTS` is empty, run `npm run deploy` with no extra args.

3. Report the commit message (if any), push result, remote build output, and verification line from curl.

## What the script does

| Step | Action |
|------|--------|
| Commit | `git add -A` + `git commit` only when the working tree is dirty |
| Push | `git push origin master` |
| Remote | `ssh tetrazero` → `git pull`, `npm ci`, `npm run build` in `/var/www/fable-tetrazero` |
| Verify | HTTP check on localhost with `Host: tetrazero.com` |

Apache already serves `/var/www/fable-tetrazero/dist` — no reload needed after build.

## Flags

- `dry-run` or `plan` — show what would happen (status, planned commit message, remote commands) but do **not** commit, push, or SSH.

## Failure handling

- If commit hooks fail: fix the issue, then re-run `/deploy` — do not `--amend` unless the user asks.
- If push fails: stop and report; do not attempt remote deploy.
- If SSH or remote build fails: report the error; the site keeps serving the previous build.

## Git safety

- Never update git config
- Never skip hooks (`--no-verify`)
- Never force-push
- Never commit secret/credential files
