# Contributing to Pinch CLI

Thanks for your interest in contributing to Pinch! We welcome contributions of all kinds — bug reports, feature requests, documentation improvements, and code.

## Development Setup

1. **Fork and clone the repo**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pinch-cli.git
   cd pinch-cli
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run in development mode** (auto-rebuild on changes):
   ```bash
   npm run dev
   ```

5. **Test the CLI locally**:
   ```bash
   # Run the built CLI directly
   node dist/index.js init my-test-tool

   # Or link it globally for easier testing
   npm link
   pinch init my-test-tool
   ```

6. **Run the test suite**:
   ```bash
   npm test
   ```

## Project Structure

```
pinch-cli/
  src/
    index.ts              # CLI entry point (Commander.js)
    commands/             # One file per command
      init.ts             # Project scaffolding
      dev.ts              # Dev server + REPL
      test.ts             # Manifest validation + contract tests
      deploy.ts           # CF Workers, Docker, Pinchers deployment
      import.ts           # JSON package import
      export.ts           # JSON package export
      prompt.ts           # AI prompt generation
      login.ts            # Pinchers.ai auth
    lib/                  # Shared utilities
      config.ts           # Config file loading (~/.pinchrc)
      worker-gen.ts       # CF Worker code generation
      mcp-client.ts       # MCP protocol client
      bundle.ts           # File bundling utilities
      package-format.ts   # JSON package format validation
      errors.ts           # Custom error classes
    templates/            # Project scaffolding templates
      index.ts            # Template registry
      server-runtime.ts   # Shared dev server generator
      playground.ts       # Interactive HTML playground
      hello-world.ts      # Minimal template
      full-stack.ts       # MCP + custom UI template
      invoice.ts          # Invoice tool template
      api-client.ts       # HTTP tools template
      task-manager.ts     # CRUD + storage template
      weather-dashboard.ts # Showcase template
      ai-chat.ts          # Showcase template
  tests/                  # Vitest test suite
  dist/                   # Compiled output (gitignored)
```

## Pull Request Process

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes and add tests for new functionality.

3. Ensure everything passes:
   ```bash
   npm run build && npm test
   ```

4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add new command` (new feature)
   - `fix: resolve REPL crash` (bug fix)
   - `docs: update README` (documentation)
   - `chore: update dependencies` (maintenance)
   - `refactor: simplify deploy logic` (code improvement)

5. Open a PR against `main`.

## What to Contribute

Here are some ideas for contributions:

### New Templates
Create a new project template in `src/templates/`. Each template exports a function that returns `Record<string, string>` (file path to content). Look at existing templates for the pattern.

### New Deploy Targets
Add a new deployment target in `src/commands/deploy.ts`. Current targets: Cloudflare Workers, Docker, Pinchers.ai. Ideas: Railway, Fly.io, AWS Lambda, Deno Deploy.

### Bridge API Extensions
The bridge (`window.pinch`) connects frontends to MCP servers. New capabilities like real-time subscriptions, file uploads, or analytics could be added to `src/templates/server-runtime.ts`.

### Bug Fixes
Check [open issues](https://github.com/AndrewLeonardi/pinch-cli/issues) for bugs to fix.

## Code Style

- TypeScript strict mode is enabled
- Use ESM imports (`.js` extension for relative imports)
- Prefer `const` over `let`
- Use descriptive variable names
- Add comments for non-obvious logic

## Reporting Bugs

Use the [Bug Report template](https://github.com/AndrewLeonardi/pinch-cli/issues/new?template=bug_report.yml). Include:
- Your Node.js version (`node --version`)
- Your OS and version
- Steps to reproduce the issue
- Expected vs actual behavior

## Questions?

Open a [Discussion](https://github.com/AndrewLeonardi/pinch-cli/discussions) or join our community.
