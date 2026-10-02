# Contributing to Rhodes Archive

Thanks for your interest in contributing to **Rhodes Archive**.

Rhodes Archive is a fan-made, non-commercial Arknights story player focused on story browsing, fan translations, and a cleaner desktop experience.

## Ways to contribute

You can help with:

- Bug reports
- Feature suggestions
- Translation fixes
- New translation files
- Documentation
- Code improvements
- UI/UX improvements

## Reporting bugs

Please use the **Bug report** issue template and include as much detail as possible:

- Rhodes Archive version
- Windows version
- Affected story/chapter
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots or logs if available

## Suggesting features

Use the **Feature request** template and explain:

- What you would like to add or improve
- Why it would be useful
- How you imagine it working

## Translation contributions

Translations are stored as external `.txt` files.

Each translation file should start with:

```txt
#ARKSTAGE_TITLE=PAGE_TITLE
```

The rest of the file should contain the complete translated story script.

If you find a translation mistake, missing line, incorrect name, or chapter mismatch, please use the **Translation issue** template.

## Code contributions

If you want to contribute code:

1. Fork the repository.
2. Create a new branch for your change.
3. Keep changes focused and easy to review.
4. Test the project locally before submitting.
5. Open a Pull Request and explain what changed and why.

Development setup:

```bash
npm install
npm run tauri dev
```

Main technologies:

- Tauri 2
- Rust
- React
- TypeScript

## Pull Request guidelines

Please try to:

- Avoid unrelated changes in the same PR
- Describe the problem and solution clearly
- Mention any known limitations
- Include screenshots for UI changes when useful
- Avoid committing generated build files unless they are specifically required

## AI-assisted contributions

AI-assisted tools may be used during development, but contributors remain responsible for reviewing, testing, and understanding the code or text they submit.

Please do not submit unreviewed generated code or translations.

## Legal / fan project notice

Rhodes Archive is an unofficial fan project and is not affiliated with Hypergryph, Gryphline, or PRTS Wiki.

Arknights and its original assets belong to their respective rights holders.

By contributing, you agree that your original code contributions may be distributed under the repository's MIT License.

Thanks for helping improve Rhodes Archive.
