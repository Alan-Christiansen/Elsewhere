# Contributing to Elsewhere

Bug reports, feature suggestions, documentation improvements, and focused code fixes are welcome.

## Issues

Before opening an issue, check whether an existing issue already covers it. For a bug, include:

- What you expected and what happened instead
- Steps to reproduce the problem
- Your Obsidian version and operating system
- Any relevant error message, with private vault information removed

Feature suggestions should describe the workflow problem and the outcome you want. Please open an issue before starting a substantial feature, behavior change, dependency, or architectural change so the direction can be discussed first.

## Pull requests

Small fixes and documentation improvements may be submitted directly. Every pull request should:

- Explain what changed and why
- Describe how the change was tested
- Keep unrelated changes out of the pull request
- Update user documentation when behavior changes
- Preserve Elsewhere's local-first design and existing shortcut fields

To verify a code change locally:

```sh
npm install
npm test
npm run build
```

Test platform-sensitive behavior in a clean vault. Changes affecting file paths, launching, or `.url` handling should state which operating systems were tested.

By contributing, you agree that your contribution will be licensed under the repository's [MIT License](LICENSE).
