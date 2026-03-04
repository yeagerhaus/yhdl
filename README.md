# yhdl

Download artist discographies from Deezer with smart folder organization and automatic library synchronization. Requires Deezer subscription

**Features:** Full discography downloads · FLAC/MP3 320/MP3 128 · Album/EP/Single detection · Library sync · Skip existing · Plex integration

## Quick Start

Requires [Bun](https://bun.sh) ≥ 1.0.0.

```bash
bun install
bun run dev "Artist Name"
```

Create a `.env` file with at minimum `DEEZER_ARL=<your_token>` before first run.

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `bun run dev <artist>` | — | Download artist discography (shorthand) |
| `bun run dev download <artist>` | `d` | Download artist discography |
| `bun run dev track <track> [artist]` | `t` | Download a single track |
| `bun run dev sync` | `s` | Sync library (check all artists for new releases) |
| `bun run dev status` | `st` | Show sync status |
| `bun run dev errors` | `e` | View recent sync errors |
| `bun run sync` | — | Standalone sync (same as `dev sync`) |
| `bun run sync:scheduled` | — | Non-interactive sync for task schedulers |
| `bun run tag:existing [artist]` | — | Tag existing files with RELEASETYPE |
| `bun run cache:clear --all` | — | Clear check history and library cache |
| `bun run ignore:add "Artist"` | — | Add artist to sync ignore list |
| `bun run ignore:remove "Artist"` | — | Remove artist from sync ignore list |
| `bun run ignore:list` | — | List ignored artists |

### Common Options

**download / track:** `-b, --bitrate <flac|320|128>` (default: flac) · `--dry-run`

**sync:** `--full` · `--artist <name>` · `--dry-run` · `-c, --concurrency <n>` (default: 5) · `--since <hours>` (default: 24) · `-b, --bitrate`

**status:** `--json`

**errors:** `--limit <n>` (default: 20) · `--since <hours>` (default: 24) · `--json`

## Configuration

Create `.env` in the project root:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEZER_ARL` | Deezer ARL cookie (required) | — |
| `MUSIC_ROOT_PATH` | Where music is saved | `~/Music` |
| `SYNC_STATE_PATH` | Sync state file path | `.yhdl/sync-state.json` |
| `ERROR_LOG_PATH` | Error log path | `.yhdl/sync-errors.json` |
| `SYNC_CONCURRENCY` | Parallel artist checks | `5` |
| `SYNC_CHECK_INTERVAL` | Hours between checks | `24` |
| `PLEX_WEBHOOK_URL` | Plex refresh webhook | Optional |
| `PLEX_WEBHOOK_TOKEN` | Plex API token | Optional |

**Getting your ARL:** Log in to [deezer.com](https://www.deezer.com) → DevTools → Application → Cookies → copy the `arl` value.

## Folder Structure

```
Music/
├── Tame Impala/
│   ├── Currents/
│   │   └── 01 - Let It Happen.flac
│   └── The Less I Know The Better [Single]/
│       └── 01 - The Less I Know The Better.flac
└── Various Artists/
    └── Compilation Name/
```

Track format: `01 - Track Name.flac` · Compilations → `Various Artists/` · Files tagged with title, artist, album, track number, ISRC, RELEASETYPE.

## Development

```bash
bun run dev "Artist"   # Run from source
bun run build          # Build to dist/
bun test               # Run tests
bun run version:patch  # Bump version
```

For programmatic usage, see `src/api/index.ts`.

## License

MIT
