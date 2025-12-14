# yhdl

Download artist discographies with smart folder organization.

## Features

- **One command** - Download an artist's complete discography
- **Smart organization** - `Artist / Album Name - Type` folder structure
- **Auto-detection** - Labels releases as Album, EP, or Single
- **Deduplication** - Skips already-downloaded albums
- **FLAC support** - Downloads highest available quality
- **Retry logic** - Handles network issues gracefully

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

**Note:** The `.env` file is gitignored and will never be committed to the repository.

## Folder Structure

```
Music/
├── Tame Impala/
│   ├── Currents - Album/
│   │   ├── 01 - Let It Happen.flac
│   │   └── ...
│   ├── Lonerism - Album/
│   └── The Less I Know The Better - Single/
└── Various Artists/
    └── Compilation - Album/
```

## Development

```bash
bun run dev "Artist"    # Run from source
bun run build           # Build to dist/
bun run start "Artist"  # Run built version
```

## License

MIT
