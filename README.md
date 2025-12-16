# yhdl

Download artist discographies from Deezer with smart folder organization and automatic library synchronization.

## Features

- **One command** - Download an artist's complete discography
- **Smart organization** - `Artist / Album Name` folder structure
- **Auto-detection** - Identifies releases as Album, EP, or Single
- **Deduplication** - Skips already-downloaded albums
- **Multiple formats** - FLAC, MP3 320kbps, or MP3 128kbps
- **Retry logic** - Handles network issues gracefully
- **Library sync** - Automatically check your entire library for new releases
- **Smart caching** - Fast subsequent runs using cached library scan
- **Ignore list** - Skip artists you don't want to sync
- **Programmatic API** - Use as a library in your own projects
- **Scheduled sync** - Non-interactive mode for task schedulers

## Quick Start

Requires [Bun](https://bun.sh):

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Download an artist's discography
bun run dev "Artist Name"
```

Before first run, create a `.env` file in the project root (see Configuration section below).

## CLI Commands

### Download Artist Discography

Download a specific artist's complete discography:

```bash
# Using the main entry point (backward compatible)
bun run dev "Tame Impala"
bun run dev "Tame Impala" -b 320
bun run dev "Tame Impala" --dry-run

# Using the new command structure
bun run dev download "Tame Impala"
bun run dev download "Tame Impala" -b 320
bun run dev download "Tame Impala" --dry-run
```

| Option | Description |
|--------|-------------|
| `-b, --bitrate` | `flac`, `320`, or `128` (default: flac) |
| `--dry-run` | Preview what would be downloaded without actually downloading |

### Sync Library

Sync your entire music library to find and download new releases:

```bash
# Sync all artists (skips recently checked ones)
bun run sync

# Force check all artists
bun run sync --full

# Sync specific artist only
bun run sync --artist "Tame Impala"

# With options
bun run sync --full --bitrate 320 --concurrency 10
```

| Option | Description |
|--------|-------------|
| `--full` | Force check all artists (ignore last check time) |
| `--artist <name>` | Sync specific artist only |
| `--dry-run` | Preview what would be downloaded |
| `-c, --concurrency <n>` | Number of parallel artist checks (default: 5) |
| `--since <hours>` | Only check artists not checked in last N hours (default: 24) |
| `-b, --bitrate` | `flac`, `320`, or `128` (default: flac) |

## Configuration

Configuration is stored in a `.env` file in the project root. Create this file manually:

```bash
# Create .env file
touch .env
```

Then edit `.env` with your settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEZER_ARL` | Your Deezer ARL token (see below for how to get it) | Required |
| `MUSIC_ROOT_PATH` | Where downloaded music will be saved | `~/Music` (or `%USERPROFILE%\Music` on Windows) |
| `SYNC_STATE_PATH` | Path to sync state file | `.yhdl/sync-state.json` |
| `ERROR_LOG_PATH` | Path to error log file | `.yhdl/sync-errors.json` |
| `SYNC_CONCURRENCY` | Number of parallel artist checks during sync | `5` |
| `SYNC_CHECK_INTERVAL` | Hours between artist checks (for skipping) | `24` |

Example `.env` file:

```env
DEEZER_ARL=your_arl_token_here
MUSIC_ROOT_PATH=C:\Users\YourName\Music
SYNC_CONCURRENCY=5
SYNC_CHECK_INTERVAL=24
```

### Getting Your Deezer ARL Token

The ARL (Authentification Request Language) token is required to authenticate with Deezer. To get it:

1. Open [deezer.com](https://www.deezer.com) in your browser
2. Log in to your account
3. Open Developer Tools (F12 or right-click → Inspect)
4. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
5. Navigate to **Cookies** → `https://www.deezer.com`
6. Find the cookie named `arl`
7. Copy its value and paste it into your `.env` file as `DEEZER_ARL`

**Note:** ARL tokens can expire. If you get authentication errors, get a new token and update your `.env` file. The CLI will prompt you for a new ARL if the current one is invalid.

## Folder Structure

Music is organized in a clean `Artist / Album` structure:

```
Music/
├── Tame Impala/
│   ├── Currents/
│   │   ├── 01 - Let It Happen.flac
│   │   ├── 02 - Nangs.flac
│   │   └── ...
│   ├── Lonerism/
│   │   ├── 01 - Be Above It.flac
│   │   └── ...
│   └── The Less I Know The Better/
│       └── 01 - The Less I Know The Better.flac
└── Various Artists/
    └── Compilation Album Name/
        └── ...
```

- Each artist gets their own folder
- Each release (album, EP, single) gets its own subfolder
- Tracks are numbered and named: `01 - Track Name.flac`
- Compilation albums are placed in a `Various Artists` folder
- Files are tagged with metadata (artist, album, track number, etc.)

## Scheduled Sync

Non-interactive sync mode designed for task schedulers (Windows Task Scheduler, cron, etc.). This script runs without prompting for user input and requires `DEEZER_ARL` to be set in your `.env` file.

```bash
# Run scheduled sync manually
bun run sync:scheduled

# With options
bun run sync:scheduled --full --bitrate 320 --concurrency 10

# With custom log file
bun run sync:scheduled --log logs/my-sync.log
```

| Option | Description |
|--------|-------------|
| `--full` | Force check all artists (ignore last check time) |
| `--bitrate` | `flac`, `320`, or `128` (default: flac) |
| `--concurrency <n>` | Number of parallel artist checks (default: 5) |
| `--since <hours>` | Only check artists not checked in last N hours (default: 24) |
| `--log <path>` | Custom log file path |

**What it does:**
- Scans your music folder for all artists
- Checks each artist on Deezer for new releases
- Downloads any missing releases automatically
- Logs all output to a file (default: `logs/scheduled-sync-YYYYMMDD.log`)

**Smart caching:** The first run scans your library. Future runs use a cache (valid 24 hours) to skip scanning, making it much faster.

**Skip recently checked artists:** Artists checked in the last 24 hours are automatically skipped (unless you use `--full`).

### Windows Task Scheduler

A batch script is provided for Windows Task Scheduler:

```bash
# Run the batch script (creates logs automatically)
scripts\scheduled-sync.bat
```

The batch script automatically:
- Changes to the project directory
- Creates a `logs` directory if needed
- Generates a dated log file (`logs/scheduled-sync-YYYYMMDD.log`)
- Runs the scheduled sync with logging

### Ignoring Artists

Skip artists you don't want to sync. The ignore list is stored in the sync state file and persists across runs.

```bash
# Add artists to ignore list
bun run ignore:add "Artist Name"
bun run ignore:add "Artist 1" "Artist 2" "Artist 3"

# Remove artists from ignore list
bun run ignore:remove "Artist Name"

# List ignored artists
bun run ignore:list

# Clear ignore list
bun run ignore:clear
```

Ignored artists are never checked during sync. Your ignore list is saved and persists across runs.

### Cache Management

Clear cache to force re-checking artists or rescanning your library:

```bash
# Clear check history (forces all artists to be checked again)
bun run cache:clear --check-history

# Clear library scan cache (forces library rescan)
bun run cache:clear --library

# Clear all cache (check history + library cache)
bun run cache:clear --all
```

**Note:** Cache clearing preserves your ignored artists list. Only check history and library cache are cleared.

### Tag Existing Files

Add RELEASETYPE metadata tags to existing FLAC/MP3 files in your library:

```bash
# Tag all files in default music directory
bun run tag:existing

# Tag files in a specific directory
bun run tag:existing --path "C:\Users\YourName\Music"

# Preview what would be tagged (dry run)
bun run tag:existing --dry-run
```

| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Music root path to tag (default: current directory) |
| `--dry-run` | Preview what would be tagged without making changes |

This command scans your music library and adds `RELEASETYPE` tags (album, ep, or single) to files based on the number of tracks in each release directory.

## Programmatic API

yhdl can be used as a library in your own projects:

```typescript
import { downloadArtist, syncLibrary } from "yhdl";

// Download an artist's discography
const result = await downloadArtist({
  artistName: "Tame Impala",
  bitrate: "flac",
  musicRootPath: "/path/to/music",
  deezerArl: "your_arl_token",
});

console.log(`Downloaded ${result.downloadedTracks} tracks`);

// Sync entire library
const syncResult = await syncLibrary({
  musicRootPath: "/path/to/music",
  bitrate: "flac",
  concurrency: 5,
  checkIntervalHours: 24,
  deezerArl: "your_arl_token",
});

console.log(`Found ${syncResult.summary.newReleases} new releases`);
```

See `src/api/index.ts` for all available exports.

## Development

```bash
# Run from source
bun run dev "Artist"
bun run dev download "Artist"
bun run dev sync

# Build to dist/
bun run build

# Run built version
bun run start "Artist"

# Run tests
bun test
bun test:watch
bun test:coverage

# Version management
bun run version:patch   # Bump patch version
bun run version:minor   # Bump minor version
bun run version:major   # Bump major version
bun run version:auto    # Auto-detect version bump from git commits
```

## License

MIT
