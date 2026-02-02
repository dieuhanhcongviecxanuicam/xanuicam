# Deploy & Commit Instructions

Short commands to commit changes, open a PR and merge to `main` so CI/CD runs.

1. On your feature branch (example: feature/ui-update-20260202):

   git add -A
   git commit -m "chore: update UI/feature"
   git push

2. Open a Pull Request on GitHub (or use the URL printed after push).

3. Merge the PR to `main` (preferably via GitHub UI). To merge locally:

   git checkout main
   git pull --rebase origin main
   git merge --no-ff feature/ui-update-20260202 -m "chore: merge feature/ui-update-20260202"
   git push origin main

4. CI/CD notes:
   - After pushing to `main`, GitHub Actions / your deploy pipeline will run.
   - Monitor the Actions tab for build logs and deployment status.
   - If the pipeline fails, revert the merge and investigate the failing job.

5. Rollback (if needed):

   # create a revert commit on main
   git checkout main
   git pull origin main
   git revert <merge-commit-hash>
   git push origin main

Contact ops if automatic deployment requires environment secrets or manual approval.
