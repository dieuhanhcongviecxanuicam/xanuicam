# Claude Model & Anthropic API

This repository can optionally use Anthropic's Claude models. Add the following runtime configuration and secrets when enabling Claude:

- `CLAUDE_MODEL` — runtime model name. Example: `claude-haiku-4.5`.
- `ANTHROPIC_API_KEY` — API key for Anthropic (store as a GitHub secret named `ANTHROPIC_API_KEY`).

Admin/setup notes:

- Add the `ANTHROPIC_API_KEY` secret in the repository (Settings → Secrets) so CI/deploy can access it.
- To default to `claude-haiku-4.5` set `CLAUDE_MODEL=claude-haiku-4.5` in your server `.env` or deployment environment.
- Branch protection and secret management require repository admin permissions. If automation cannot set branch protection, an admin must enable it via GitHub UI or run the branch-protection API.

Example minimal `.env` entries for deployment:

```
CLAUDE_MODEL=claude-haiku-4.5
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```
