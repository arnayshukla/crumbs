# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-03-07

### Fixed
- Update docker-compose only after Docker image is pushed

## [0.3.1] - 2026-03-07

### Fixed
- Include tags in sync pull response and update API spec

### Changed
- Update FEATURES.md, DEPLOYMENT.md, and CLAUDE.md documentation

## [0.3.0] - 2026-03-06

### Added
- Tag management system with auto-extraction from note content
- Full-text search across titles, content, and tags
- Dark mode with system preference detection
- Note pinning, archive, and trash workflows
- Image attachments with drag-and-drop upload
- 12 color themes for note cards
- PWA support with offline-first IndexedDB sync
- LWW CRDT-based conflict resolution
- Docker deployment with multi-stage build
- CI/CD pipeline with GitHub Actions
- Comprehensive E2E test suite with Playwright
- OpenAPI spec and auto-generated API docs

### Changed
- Initial public release

[0.3.2]: https://github.com/bretzel-app/crumbs/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/bretzel-app/crumbs/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/bretzel-app/crumbs/releases/tag/v0.3.0
