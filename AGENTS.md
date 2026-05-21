# Project Instructions

This file provides context for AI assistants working on this project.

## Project Type: Node.js

### Commands

- Install: `pnpm install`
- Test: `pnpm test`
- Build: `pnpm build`
- Start: `pnpm start`

### Framework: Vite

### Documentation

See README.md for project overview.

### Version Control

This project uses Git. See .gitignore for excluded files.

## Guidelines

- Follow existing code style and patterns
- Write tests for new functionality
- Keep changes focused and atomic
- Document public APIs

## Tech Stack & Coding Requirements

- **Frontend framework**: Vue 3 + JavaScript. Do not introduce TypeScript.
- **Build tooling**: Vite + pnpm. Use pnpm for package commands.
- **Desktop framework**: Tauri for local file access and system integration.
- **UI framework**: Prefer daisyUI components and existing classes first. Preserve and reuse styles from `src/style.css`.
- **State management**: Use Pinia for shared/global state.
- **Code style**: Follow eslint + `@antfu/eslint-config`.
- **Utility library**: Prefer `xe-utils` for calculations, empty checks, and data processing helpers where applicable.
- **Date handling**: Use `dayjs` for all date-related logic.
- **Data source**: Excel `.xlsx` is the source for configuration and business data. Keep configuration and business data separated.

## Important Notes

<!-- Add project-specific notes here -->

- I use opencode. Plan mode uses `gpt-5.5`; build mode uses `deepseek-v4-pro`.
- When working in plan mode, `gpt-5.5` must provide `deepseek-v4-pro` with detailed follow-up implementation instructions, including the intended changes, relevant files, constraints, and verification steps.
