# GitHub Packages Publishing Setup

This repository is configured to automatically publish to GitHub Packages when you push changes to `package.json` (typically when you update the version).

## How It Works

1. **Automatic Trigger**: The workflow runs when:
   - You push changes to `package.json` on `main` or `master` branch
   - You create a GitHub release
   - You manually trigger it from the Actions tab

2. **Build Process**:
   - Installs Bun and dependencies
   - Builds the package (`bun run build`)
   - Configures package.json with scoped name for GitHub Packages
   - Publishes to GitHub Packages

3. **Package Name**: 
   - On npm: `yhdl` (unscoped)
   - On GitHub Packages: `@YOUR_USERNAME/yhdl` (scoped, automatically set)

## Setup Instructions

1. **Update repository URL in package.json**:
   Replace `YOUR_USERNAME` in `package.json` with your actual GitHub username:
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/YOUR_USERNAME/yhdl.git"
   }
   ```

2. **No additional secrets needed**: The workflow uses `GITHUB_TOKEN` automatically provided by GitHub Actions.

3. **Publishing**: Just update the version in `package.json` and push:
   ```bash
   # Update version
   npm version patch  # or minor, or major
   
   # Push to trigger workflow
   git push origin main
   ```

## Installing from GitHub Packages

Users can install your package from GitHub Packages with:

```bash
# Create/update .npmrc in their project
echo "@YOUR_USERNAME:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# Install the package
npm install @YOUR_USERNAME/yhdl
```

## Viewing Published Packages

After publishing, you can view your package at:
- `https://github.com/YOUR_USERNAME/yhdl/packages`
- Or navigate to your repository → Packages (right sidebar)

## Notes

- The workflow automatically converts the package name to a scoped format for GitHub Packages
- The original `package.json` is restored after publishing (changes are only temporary)
- Both npm and GitHub Packages can coexist - you can publish to both registries

