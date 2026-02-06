---
name: commit-and-push
description: Commit all changes and push to the current remote branch.
disable-model-invocation: true
argument-hint: "[commit message]"
allowed-tools: Bash(git *)
---

# Commit and Push

1. Run `git status` to see what's changed
2. Run `git diff` and `git diff --staged` to understand the changes
3. Run `git log --oneline -5` to see recent commit style
4. Stage all relevant changed files by name (do NOT use `git add -A` or `git add .`)
5. If `$ARGUMENTS` is provided, use it as the commit message. Otherwise, write a concise commit message based on the diff. Always append the co-author trailer:
   ```
   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```
6. Commit using a HEREDOC:
   ```bash
   git commit -m "$(cat <<'EOF'
   message here

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```
7. Push to the current branch with `git push`
8. Report the result
