# GitHub Publishing Checklist

Target repository:

```text
https://github.com/BlackStar1979/mcp-tests
```

## Publish Scope

The first GitHub import should include the TEST MCP runtime, tools, specs, smoke tests, workflow canon, Docker scaffolding, plugin sample, and small public filesystem fixtures.

The first import should not include local operational artifacts, raw logs, workflow snapshots, retired backups, local agent state, large external code corpora, or research sandboxes.

## Pre-Push Checks

Run:

```powershell
npm test
```

Optional full network smoke:

```powershell
npm run test:full
```

## First Git Setup

If this directory has no Git repository yet:

```powershell
git init -b main
git remote add origin https://github.com/BlackStar1979/mcp-tests.git
git status --short
```

Review ignored files before the first commit:

```powershell
git status --short --ignored
```

Create the first commit:

```powershell
git add .
git commit -m "initial mcp-tests import"
```

Push only after reviewing the staged file list:

```powershell
git push -u origin main
```

## License

No open-source license has been selected in this prep. Until a license file is added, the repository should be treated as all-rights-reserved even if it is public on GitHub.
