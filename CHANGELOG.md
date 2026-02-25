# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-25

### Added
- `pinch import` command — import a JSON package from AI output and scaffold a full project
- `pinch export` command — export current project as a portable JSON package
- `pinch prompt` command — generate an AI prompt for building a new tool
- Weather Dashboard showcase template with chart UI
- AI Chat showcase template with streaming responses
- Shared MCP client library for proper protocol handshake
- Spinner and progress indicators for long operations
- Update notifications when a new version is available
- Project-local `.pinchrc` config support
- Environment variable support for Cloudflare credentials
- CI/CD with GitHub Actions (build, test, publish)
- Vitest test suite for core functionality
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- Issue and PR templates

### Changed
- Renamed templates: Starter → Hello World, Custom UI → Full Stack, Data Fetcher → API Client, Automation → Task Manager
- README completely rewritten for open source audience
- CLI is now standalone-first — works without a Pinchers.ai account
- Default deploy target is now `cloudflare` (was `pinchers`)
- REPL in `pinch dev` now properly initializes MCP sessions
- `publish` command merged into `deploy pinchers`
- Version read from package.json instead of hardcoded
- Better error messages with fix suggestions throughout

### Removed
- Standalone `publish` command (use `pinch deploy pinchers` instead)
- Unused `chokidar` dependency

### Fixed
- REPL sending raw JSON-RPC without MCP initialization handshake
- Code duplication between `publish.ts` and `deploy.ts`
- Inconsistent source file resolution across deploy targets

## [0.2.0] - 2025-12-15

### Added
- Multi-file server support with `server_files`
- Cloudflare D1 database auto-provisioning
- Schema migration on deploy
- Docker deployment target
- Custom UI template with AI-first build workflow

## [0.1.0] - 2025-10-01

### Added
- Initial release
- `pinch init` with 5 starter templates
- `pinch dev` with hot reload and REPL
- `pinch test` with manifest validation and contract tests
- `pinch login` for Pinchers.ai authentication
- `pinch publish` for marketplace submission
- Cloudflare Workers deployment

[1.0.0]: https://github.com/AndrewLeonardi/pinch-cli/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/AndrewLeonardi/pinch-cli/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AndrewLeonardi/pinch-cli/releases/tag/v0.1.0
