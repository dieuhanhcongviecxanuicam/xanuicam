Purge sensitive secrets from Git history

Important: Rewriting Git history is destructive. Make a full backup of your repo before proceeding.

Recommended approach (use on your machine where the repo is a Git repository):

1) Create a mirror backup:

```bash
cd /path/to/your/repo
git remote remove origin || true
cd ..
git clone --mirror /path/to/your/repo repo-backup.git
```

2) Install `git-filter-repo` (recommended) or `bfg`.

- Using `git-filter-repo` (recommended):
  - Install: `pip install git-filter-repo`
  - Example to remove files and paths from history:

```bash
cd /path/to/your/repo
# Remove .cloudflared directory and specific scripts that contained tokens
git filter-repo --invert-paths --path .cloudflared --path e2e/create_named_tunnel.js --path e2e/fetch_tunnel_creds.js --path e2e/upsert_dns_cname.js --path e2e/recreate_named_tunnel.js
```

- Using BFG (alternative):
  - Download BFG jar and run:

```bash
# delete files/paths
bfg --delete-files ".cloudflared" --delete-files "e2e/create_named_tunnel.js" --delete-files "e2e/fetch_tunnel_creds.js"  /path/to/repo.git
```

3) After filter-repo/BFG, clean and force-push (if remote):

```bash
# expire refs and gc
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push to origin (only if you're sure)
git push --force --all
git push --force --tags
```

4) Replace sanitized files

After purging the history, commit sanitized versions (no hard-coded tokens) into the repo. Example: edit `e2e/create_named_tunnel.js` to read token from `process.env.CF_API_TOKEN` (already done by the assistant).

Notes & limitations
- This environment where the assistant runs does not have a `.git` repository, so I cannot rewrite history from here. You must run the above commands locally where your Git repo exists.
- If your repo is on a shared remote (GitHub/GitLab), coordinate with collaborators: everyone must reclone after force-push.
- Consider rotating any exposed tokens/credentials (invalidate old ones) after purge.

If you want, I can generate an automated shell script that runs the `git-filter-repo` commands for you to review and run locally. Or I can produce exact `bfg` commands instead — tell me which tool you prefer.