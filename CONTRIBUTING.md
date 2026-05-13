# Contributing to vinted-mcp-cli

Browse, search, and manage Vinted listings from Claude or the terminal. Contributions welcome.

## Before you start

- Check [open issues](https://github.com/googlarz/vinted-mcp-cli/issues) and [discussions](https://github.com/googlarz/vinted-mcp-cli/discussions)
- For new MCP tools or CLI commands, open an issue first to discuss scope

## Setup

```bash
git clone https://github.com/googlarz/vinted-mcp-cli.git
cd vinted-mcp-cli
npm install
```

## Development

```bash
npm run build     # compile TypeScript
npm test          # run tests
```

## What to contribute

- Bug fixes — search, listing, auth handling
- New MCP tools — check `src/` for existing patterns
- CLI improvements — UX, output formatting, new subcommands
- Test coverage

## Submitting a PR

1. Fork → branch from `main`
2. One fix or feature per PR
3. `npm run build && npm test` must pass
4. Update README if you add a command or tool
