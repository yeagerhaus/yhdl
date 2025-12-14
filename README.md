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

On first run, you'll be prompted for your Deezer ARL token (found in browser cookies at deezer.com → Developer Tools → Application → Cookies → `arl`).

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

Config files are stored in `~/.config/yhdl/`:

| File | Purpose |
|------|---------|
| `config.json` | Music root path (default: `~/Music`) |
| `.arl` | Deezer auth token |

Edit `config.json` to change your download location:

```json
{
  "musicRootPath": "/path/to/your/music"
}
```

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
