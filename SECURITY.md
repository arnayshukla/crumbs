# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| latest  | Yes                |
| < latest | No                |

We recommend always running the latest version of Crumbs.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via [GitHub's private vulnerability reporting](https://github.com/bretzel-app/crumbs/security/advisories/new).

Include as much of the following as possible:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

You should receive an initial response within 48 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

Since Crumbs is a self-hosted application, the following are in scope:

- Authentication bypass or session hijacking
- SQL injection or data leaks
- Cross-site scripting (XSS)
- Server-side request forgery (SSRF)
- Path traversal or file access vulnerabilities
- Denial of service via crafted input

## Disclosure Policy

We follow coordinated disclosure. Once a fix is available, we will:

1. Release a patched version
2. Publish a security advisory on GitHub
3. Credit the reporter (unless anonymity is requested)
