# yhdl

Download artist discographies with smart folder organization.

## Features

- **One command** - Download an artist's complete discography
- **Smart organization** - `Artist / Album Name` folder structure
- **Auto-detection** - Identifies releases as Album, EP, or Single (for internal use)
- **Deduplication** - Skips already-downloaded albums
- **FLAC support** - Downloads highest available quality
- **Retry logic** - Handles network issues gracefully
- **Scheduled sync** - Automatically check your entire library for new releases
- **Smart caching** - Fast subsequent runs using cached library scan
- **Ignore list** - Skip artists you don't want to sync

## Quick Start

Requires [Bun](https://bun.sh):

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Run
bun run dev "Artist Name"
```

Before first run, create a `.env` file in the project root (see Configuration section below).

## Usage

```bash
bun run dev "Tame Impala"              # Download discography
bun run dev "Tame Impala" -b 320       # MP3 320kbps
bun run dev "Tame Impala" --dry-run    # Preview only
```

| Option | Description |
|--------|-------------|
| `-b, --bitrate` | `flac`, `320`, or `128` (default: flac) |
| `--dry-run` | Preview without downloading |

## Configuration

Configuration is stored in a `.env` file in the project root. Create this file by copying `.env.example`:

```bash
cp .env.example .env
```

Then edit `.env` with your settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEZER_ARL` | Your Deezer ARL token (found in browser cookies at deezer.com → Developer Tools → Application → Cookies → `arl`) | Required |
| `MUSIC_ROOT_PATH` | Where downloaded music will be saved | `~/Music` (or `%USERPROFILE%\Music` on Windows) |

Example `.env` file:

```env
DEEZER_ARL=your_arl_token_here
MUSIC_ROOT_PATH=C:\Users\YourName\Music
```

## Folder Structure

```
Music/
├── Tame Impala/
│   ├── Currents/
│   │   ├── 01 - Let It Happen.flac
│   │   └── ...
│   ├── Lonerism/
│   └── The Less I Know The Better/
└── Various Artists/
    └── Compilation/
```

## Scheduled Sync

Automatically sync your entire music library to find and download missing releases.

```bash
# Run scheduled sync manually
bun run sync:scheduled

# With options
bun run sync:scheduled --full --bitrate 320
```

**What it does:**
- Scans your music folder for all artists (shows progress bar)
- Checks each artist on Deezer for new releases
- Downloads any missing releases automatically
- Saves logs to `logs/scheduled-sync-YYYYMMDD.log`

**Smart caching:** The first run scans your library. Future runs use a cache (valid 24 hours) to skip scanning, making it much faster.

**Skip recently checked artists:** Artists checked in the last 24 hours are automatically skipped (unless you use `--full`).

### Ignoring Artists

Skip artists you don't want to sync:

```bash
# Add artists to ignore list
bun run ignore:add "Artist Name"
bun run ignore:add "Artist 1" "Artist 2" "Artist 3"

# Remove artists from ignore list
bun run ignore:remove "Artist Name"

# List ignored artists
bun run ignore:list

# Clear cache (for testing)
bun run ignore:clear --all
```

Ignored artists are never checked during sync. Your ignore list is saved and persists across runs.

## Development

```bash
bun run dev "Artist"    # Run from source
bun run build           # Build to dist/
bun run start "Artist"  # Run built version
```

## License

MIT
