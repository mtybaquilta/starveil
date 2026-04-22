# StarVeil — Claude Instructions

- **Do not use git worktrees.** Work directly on a branch in the main project folder. There is no need to duplicate the workspace.

- Create a feature branch with `git checkout -b feature/<name>` and work there. Merge into `main` when done.

- New dev-mode affordances (buttons, shortcuts) should be gated behind `IS_DEV_MODE`, should be used for new features.

- Edge-function handlers that accept a devMode flag should validate it server-side.- all mutations go through "game-action" 

- For detailed UI/feature reference, read context.md

- Check `docs/backlog.md` before starting new feature work