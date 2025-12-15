# Version Bumping Scripts

## Manual Version Bumping

You can manually bump the version using npm scripts:

```bash
# Patch version (1.0.0 → 1.0.1)
bun run version:patch

# Minor version (1.0.0 → 1.1.0)
bun run version:minor

# Major version (1.0.0 → 2.0.0)
bun run version:major

# Auto-detect based on commit count
bun run version:auto
```

Or use the script directly:

```bash
node scripts/bump-version.js [patch|minor|major|auto]
```

## Auto Version Bumping

The `auto` mode counts commits since the last git tag and determines the bump type:
- **< 10 commits**: patch bump (1.0.0 → 1.0.1)
- **10-99 commits**: minor bump (1.0.0 → 1.1.0)
- **100+ commits**: major bump (1.0.0 → 2.0.0)

## GitHub Actions Auto-Versioning

An optional workflow (`.github/workflows/auto-version.yml`) can automatically bump versions on each push. 

**To enable it:**
1. Uncomment the `on.push` trigger in the workflow file
2. The workflow will automatically bump versions based on commit count
3. It will commit and push the version change, which triggers the publish workflow

**Note:** The auto-version workflow is disabled by default to prevent version spam. Enable it only if you want automatic versioning.

## Publishing After Version Bump

After bumping the version:

1. **Commit the change:**
   ```bash
   git add package.json
   git commit -m "chore: bump version to X.Y.Z"
   ```

2. **Create a tag (optional but recommended):**
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```

3. **Push to trigger publish:**
   ```bash
   git push origin main
   ```

The publish workflow will automatically run when `package.json` changes.
