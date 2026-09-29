# 🎧 MyMusicApp — Personal Audio Operating System

> **A local-first, audio-first, ad-free, privacy-by-default music player and music management ecosystem.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-747%20Passed%20(103%20Suites)-green.svg?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Zero Dependencies](https://img.shields.io/badge/Runtime%20Dependencies-Zero%20Frameworks-success.svg?style=flat-square)](#technology-stack)
[![License](https://img.shields.io/badge/License-Proprietary-lightgrey.svg?style=flat-square)](#license)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Core Principles & Architectural Pillars](#-core-principles--architectural-pillars)
- [Key Features](#-key-features)
  - [1. Pro-Grade Web Audio Engine & DSP](#1-pro-grade-web-audio-engine--dsp)
  - [2. Advanced Playback & Listening Experience (F19)](#2-advanced-playback--listening-experience-f19)
  - [3. Library Intelligence, History & Statistics (F20)](#3-library-intelligence-history--statistics-f20)
  - [4. Zero-Dependency Pure Binary Metadata Engine](#4-zero-dependency-pure-binary-metadata-engine)
  - [5. Audio Galaxy (Cosmic Library Graph)](#5-audio-galaxy-cosmic-library-graph)
  - [6. High-Performance Library & Virtualization](#6-high-performance-library--virtualization)
  - [7. Smart Playlists & Rule Builder](#7-smart-playlists--rule-builder)
  - [8. Library Health, Deduplication & Album Merging](#8-library-health-deduplication--album-merging)
  - [9. Synchronized Lyrics & Stream Inspector](#9-synchronized-lyrics--stream-inspector)
  - [10. Futuristic Cinematic Design System](#10-futuristic-cinematic-design-system)
  - [11. Production Hardening & Reliability (F21)](#11-production-hardening--reliability-f21)
  - [12. Local Backup, Snapshot & Migration Engine (F27)](#12-local-backup-snapshot--migration-engine-f27)
- [System Architecture & Layering](#-system-architecture--layering)
- [Project Directory Structure](#-project-directory-structure)
- [Technology Stack](#-technology-stack)
- [Performance Benchmarks](#-performance-benchmarks)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development Server](#development-server)
  - [Production Build](#production-build)
  - [Running the Test Suite](#running-the-test-suite)
- [Roadmap & Documentation](#-roadmap--documentation)
- [License](#-license)

---

## 🌟 Overview

**MyMusicApp** is a web-native, desktop-grade audio player and library manager built from the ground up to respect user sovereignty, audio quality, and interface aesthetics.

Unlike cloud streaming platforms and electron-heavy desktop apps, MyMusicApp runs entirely inside modern web standards using Vanilla TypeScript and pure Web APIs (Web Audio API, IndexedDB, Web File System Access API, Canvas 2D). It features **zero cloud telemetry**, **zero algorithmic ads**, and **zero subscription lock-ins**.

---

## 🛡️ Core Principles & Architectural Pillars

| Principle | Description |
|---|---|
| 🔒 **Privacy-by-Default** | Zero external analytics, tracking pixels, or remote telemetry. All data stays strictly in local browser IndexedDB storage. |
| 📴 **100% Offline-First** | Fully functional without an internet connection. Reads directly from the local file system with persistent directory handles. |
| 🎚️ **Bit-Perfect Audio** | 32-bit float audio processing pipeline, customizable 10-band graphic EQ, crossfade mixing, and zero audio downsampling. |
| ⚡ **Extreme Performance** | Bounded DOM virtual scrolling capable of smoothly handling 50,000+ tracks at 60 FPS with microsecond search indexing. |
| 🎨 **Cinematic Aesthetics** | Handcrafted dark cosmic glassmorphism UI with fluid micro-interactions, responsive breakpoints, and custom typography. |

---

## 🚀 Key Features

### 1. Pro-Grade Web Audio Engine & DSP
- **32-Bit Float Processing Pipeline**: Built on native Web Audio API `AudioContext` with custom gain, biquad filter nodes, and dynamic limiter stages.
- **10-Band Graphic Equalizer**: Precision frequency bands (32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) with ±12dB gain range.
- **Preamplification & DSP Chain**: Preamp gain stage, Bass Boost, Treble Boost, Stereo Widener, and customizable EQ presets (*Flat, Rock, Electronic, Classical, Vocal Boost, Bass Heavy, Deep Space*).
- **Pitch & Speed Control**: Real-time playback speed adjustment (0.5x to 2.0x) without audio crackling or artifacting.

### 2. Advanced Playback & Listening Experience (F19)
- **True Gapless Playback Engine**: Zero-gap buffer preloading and sub-millisecond track scheduling for live recordings and concept albums.
- **Customizable Crossfading**: Seamless track transitions with linear, exponential, and constant-power equal-loudness audio curves (1s to 12s duration).
- **A/B Segment Looping**: Precise segment looping between Point A and Point B with sub-millisecond precision, keyboard toggles, and visual slider markers.
- **ReplayGain Loudness Normalization**: EBU R128 / ReplayGain volume normalization with Track and Album gain modes, customizable preamp gain, and automatic peak-limiting protection.
- **Smart Sleep Timer**: Fade-out sleep timer with customizable intervals (15m, 30m, 45m, 60m, End of Track) and smooth volume ramping.
- **Queue State Persistence**: Persistent playback queue and active track state across browser refreshes and application restarts.

### 3. Library Intelligence, History & Statistics (F20)
- **Real-Time Listening History**: Local playback session recording tracking played timestamps, listen durations, and completion flags.
- **Deduplicated Recently Played**: Fast, reliable recently played track query with newest-first ordering and safe missing-file handling.
- **Deterministic Most Played Rankings**:
  - **Top Songs**: Sorted by `playCount DESC -> lastPlayedAt DESC -> title ASC`.
  - **Top Artists**: Aggregated by `playCount DESC -> trackCount DESC -> artistName ASC`.
  - **Top Albums**: Aggregated by `playCount DESC -> trackCount DESC -> albumTitle ASC`.
- **Time-Based Analytics Dashboard**: Real-time listening stats filterable by *Today*, *Last 7 Days*, *Last 30 Days*, and *All Time*.
- **Comprehensive Library Overview**: Metrics for Total Songs, Artists, Albums, Unique Tracks Played, Average Session Duration, Favorite Count, and Total Listening Time.
- **Safe History Management**: One-click individual history removal and bulk clearing with reactive UI event broadcasting.
- **Storage & Audio Specs Breakdown**: Lossless vs. Lossy storage metrics and audio format distribution charts.

### 4. Zero-Dependency Pure Binary Metadata Engine
Custom binary parsers implemented with pure `ArrayBuffer` and `DataView` operations without any third-party npm dependencies:
- **ID3v1, ID3v2.2, ID3v2.3, ID3v2.4**: Full tag extraction including UTF-8, UTF-16, ISO-8859-1 encodings, unsynchronization decoding, extended headers, and APIC embedded artwork extraction.
- **FLAC & Vorbis Comments**: Native extraction of FLAC metadata blocks (STREAMINFO, VORBIS_COMMENT, PICTURE) and sample rate/bit-depth analysis.
- **MP4 / AAC (M4A)**: Pure atom tree walker parsing `moov`, `trak`, `mdia`, `minf`, `stbl`, `udta`, `ilst` (`©nam`, `©ART`, `©alb`, `covr`).
- **WAV / RIFF**: Chunk parser for `fmt `, `data`, and `LIST-INFO` metadata tags.
- **Codec & Stream Detector**: Automatic detection of MP3, FLAC, AAC/M4A, WAV, OGG, Opus, and WebM containers.

### 5. Audio Galaxy (Cosmic Library Graph)
- **Interactive Force-Directed Cosmic Graph**: Visualizes relationships between Tracks, Artists, Albums, Genres, and Playlists.
- **High-Performance Canvas Simulation**: Custom physics engine supporting 5,000+ nodes with spatial partitioning, node clustering, velocity damping, and collision avoidance.
- **Camera Navigation**: Smooth pan, pinch-to-zoom, orbital focus, and node-selection detail panels.
- **Dynamic Filtering**: Filter graph views by genre, artist cluster, or playback frequency in real-time.

### 6. High-Performance Library & Virtualization
- **Windowed Virtual Scroller**: Custom virtual scroller keeping DOM nodes bounded to $\le 40$ elements regardless of dataset size (benchmarked with 10,000+ tracks at $<0.35\text{ms}$ recalculation latency).
- **Multi-View Library System**:
  - **Songs View**: Column-sorted track list with duration, bitrate, artist, album, and favorite status.
  - **Albums View**: Grid layout with auto-extracted high-resolution cover artwork and year sorting.
  - **Artists View**: Artist discography explorer with dynamic catalog statistics.
  - **Genres View**: Genre clustering and track-distribution bars.
  - **Folders View**: Native directory tree explorer matching local disk hierarchy.
  - **Favorites View**: Quick-access collection for starred tracks.
- **Instant Search Engine**: Sub-millisecond multi-field fuzzy search (Title, Artist, Album, Genre, Year) with token normalization and relevance ranking.

### 7. Smart Playlists & Rule Builder
- **Dynamic Rule-Based Engine**: Create auto-updating playlists based on complex predicate rules:
  - Match criteria: *Play Count, Skip Count, Date Added, Last Played, Genre, Year, Duration, Bitrate, Rating*.
  - Logical combinations: `AND` / `OR` composite rule trees.
  - Preset Smart Playlists: *Recently Added, Most Played, Never Played, 90s Favorites, Hi-Res Audio, Workout Vibe*.
- **Standard Playlist Management**: Create, reorder, import, export (M3U/M3U8), duplicate, and batch-organize tracks with drag-and-drop support.

### 8. Library Health, Deduplication & Album Merging
- **Library Health Diagnostic Dashboard**: Scans and surfaces corrupted audio files, missing ID3 tags, missing artwork, low-bitrate tracks, and dead file references.
- **Intelligent Duplicate Detector**: Audio fingerprinting and tag comparison engine identifying exact duplicates and near-duplicate track versions.
- **Album Merger**: Safely unifies split albums caused by inconsistent artist tags or spelling variations while strictly preserving track IDs, favorite flags, and play counts.

### 9. Synchronized Lyrics & Stream Inspector
- **Synced `.lrc` & Plain Lyrics Engine**: Real-time line-by-line scrolling synchronized to playback timestamps ($<10\text{ms}$ accuracy).
- **Interactive Lyrics Editor**: Create, edit, time-tag, and export synchronized `.lrc` files directly within the UI.
- **Embedded Lyrics Reader**: Automatically extracts unsynchronized (`USLT`) and synchronized (`SYLT`) lyrics from ID3 frames.
- **Technical Audio Inspector**: Displays codec details, sample rate, bit depth, channel count, container format, file size, and bit-per-second throughput.

### 10. Futuristic Cinematic Design System
- **Pixel-Crafted Visual Identity**: Deep space `#060814` canvas, glowing neon accents (Cyan `#06b6d4`, Purple `#a855f7`, Pink `#ec4899`), subtle glassmorphic surfaces, and fluid micro-interactions.
- **Hero Carousel**: 5-slide dynamic showcase with auto-rotation (5000ms), keyboard accessibility, and borderless floating metadata over cosmic headphone artwork.
- **Responsive Layout Matrix**: Full responsiveness across 13 certified breakpoints across Mobile ($320\text{px}-480\text{px}$), Tablet ($768\text{px}-1199\text{px}$), and Desktop ($1200\text{px}-1920\text{px}$).
- **Keyboard Navigation & Accessibility**: Full WCAG AA compliance with keyboard shortcuts (Space for Play/Pause, Arrow keys for Seek/Volume, J/K for Track navigation, Tab navigation).

### 11. Production Hardening & Reliability (F21)
- **Defensive Binary Parsing**: Bounds-guarded binary parsing for FLAC, MP4, ID3, and WAV preventing `RangeError`s on truncated or corrupted media files.
- **Graceful Fault Tolerance**: Scanner-isolated parser execution ensuring corrupted files are skipped without halting whole-library scanning.
- **Authoritative Playback State Synchronization**: Deterministic state callback transitions ensuring playback, pause, and stop states stay synchronized across all UI components.
### 12. Local Backup, Snapshot & Migration Engine (F27)
- **Versioned `.mymusic` Backup Format**: Deterministic portable JSON snapshot format (`format: "mymusic"`, `version: 1`, timestamp, `appVersion`) containing complete metadata, playlists, smart rules, listening history, favorites, settings, EQ presets, and queue state.
- **Strict Pre-Import Schema Validation**: Robust validation engine verifying schema versioning, field types, required properties, and duplicate ID detection. Rejects corrupted or malformed files safely before database modification.
- **Interactive Import Preview**: Calculates pre-commit metrics (Tracks to Add/Update, Playlists to Merge, Missing Files, History items) and presents an interactive modal for explicit user confirmation.
- **Dual Migration Modes**:
  - **Restore Mode**: Transactionally clears current IndexedDB library tables and restores full backup state.
  - **Merge Mode**: Non-destructive integration. Matches tracks by ID or composite key (`Title` + `Artist` + `Album`), merges play counts (`Math.max`), preserves favorite markers, appends non-duplicate playlist tracks while maintaining order, and re-maps IDs to prevent collisions.
- **Audio File Reference Re-Linking**: Preserves file path and metadata attributes. Honesty flags track availability as `available` vs. `missing` without destroying library records.
- **Universal M3U / M3U8 Playlist Support**: Export static playlists to standard `.m3u8` format with `#EXTINF` metadata tags, and import external M3U playlists resolving tracks against the local library.
- **Privacy & Safety Guarantees**: 100% offline, local-first processing with zero cloud API dependency, zero telemetry, and reactive domain event notifications (`BACKUP_IMPORTED`, `LIBRARY_UPDATED`, `PLAYLIST_UPDATED`, `HISTORY_UPDATED`).

---

## 🏛️ System Architecture & Layering

The application follows a clean layered domain-driven architecture:

```mermaid
graph TD
    subgraph UI Layer
        Shell[App Shell & Header]
        Views[Home / Library / NowPlaying / Galaxy / Stats / Settings]
        Components[Virtual Scroller / Track Row / EQ Panel / Lyrics Viewer]
        Tokens[Design Tokens & Theme Manager]
    end

    subgraph Service Layer
        PlaybackMgr[Playback Manager]
        AudioEng[Audio Engine & DSP Pipeline]
        ScannerSvc[Library Scanner Service]
        MetadataSvc[Metadata Reader & Parsers]
        PlaylistSvc[Playlist & Smart Rules Service]
        GalaxySvc[Galaxy Graph Simulation Service]
        AnalyticsSvc[Library Analytics & Health Service]
        LyricsSvc[Lyrics Parser & Sync Service]
        StatsSvc[Stats & Listening History Service]
    end

    subgraph Core & Event Infrastructure
        EventBus[Typed Event Bus]
        Router[Single-Page App Router]
        Logger[Structured Logger]
        Platform[Platform & Capability Adapter]
    end

    subgraph Data & Storage Layer
        Database[IndexedDB Schema Engine]
        TrackRepo[Track Repository]
        AlbumRepo[Album Repository]
        ArtistRepo[Artist Repository]
        PlaylistRepo[Playlist Repository]
        HistoryRepo[History Repository]
        QueueRepo[Queue Repository]
        SettingsRepo[Settings Repository]
    end

    subgraph Local File System
        FSA[File System Access API]
        BlobStore[File Blob / ArrayBuffer Cache]
    end

    UI Layer --> Service Layer
    Service Layer --> Core & Event Infrastructure
    Service Layer --> Data & Storage Layer
    Data & Storage Layer --> Local File System
```

---

## 📁 Project Directory Structure

```text
MyMusicApp/
├── Docs/                              # Comprehensive architectural & design specifications
│   ├── 00_PROJECT_MASTER_SPEC.md
│   ├── 01_PRODUCT_REQUIREMENTS.md
│   ├── 02_SYSTEM_ARCHITECTURE.md
│   ├── 03_AUDIO_ENGINE_ARCHITECTURE.md
│   ├── 04_MUSIC_LIBRARY_ARCHITECTURE.md
│   ├── 05_UI_UX_DESIGN_SYSTEM.md
│   ├── 06_SCREEN_ARCHITECTURE.md
│   ├── 07_NOW_PLAYING_PLAYER_SPEC.md
│   ├── 08_AUDIO_GALAXY_SPEC.md
│   ├── 09_AUDIO_FORMAT_SUPPORT.md
│   ├── 10_FEATURE_SPECIFICATION.md
│   ├── 11_DATA_DATABASE_SCHEMA.md
│   ├── 12_PERFORMANCE_PRIVACY_SECURITY.md
│   ├── 13_DEVELOPMENT_RULES.md
│   └── 14_IMPLEMENTATION_ROADMAP.md
├── src/
│   ├── app/                           # App lifecycle, bootstrap, DI container
│   ├── assets/                        # High-resolution optimized artworks & visual assets
│   ├── core/                          # EventBus, Logger, Errors, Platform Adapters
│   ├── data/                          # IndexedDB adapters, repositories, migrations
│   ├── domain/                        # Pure domain models, entities, value objects
│   ├── services/                      # Business logic & background processing
│   │   ├── analytics/                 # Library analytics & diagnostics
│   │   ├── artwork/                   # Cover art extractor & cache
│   │   ├── audio/                     # AudioEngine, DSP pipeline, EQ presets
│   │   ├── dashboard/                 # Customizable home dashboard widgets
│   │   ├── duplicate/                 # Audio fingerprinting & duplicate detector
│   │   ├── galaxy/                    # Audio Galaxy graph simulation engine
│   │   ├── library/                   # Library cataloging, health & album merger
│   │   ├── lyrics/                    # LRC parser & sync engine
│   │   ├── metadata/                  # ID3, FLAC, MP4, WAV binary parsers
│   │   ├── playback/                  # PlaybackManager, queue, shuffle/repeat, sleep timer
│   │   ├── playlist/                  # Static & Smart playlist evaluation
│   │   ├── scanner/                   # Fast folder traversal & indexer
│   │   ├── search/                    # In-memory search indexer & ranker
│   │   ├── stats/                     # Play count, history & listening statistics
│   │   └── visualizer/                # Real-time frequency & waveform analyzer
│   ├── ui/                            # Presentation layer
│   │   ├── components/                # Virtual scroller, dialogs, sliders, rows
│   │   ├── icons/                     # Zero-overhead SVG icon registry
│   │   ├── keyboard/                  # Shortcut manager & hotkey dispatch
│   │   ├── navigation/                # View router & navigation state
│   │   ├── primitives/                # Base UI elements & buttons
│   │   ├── shell/                     # Sidebar, mini-player, queue panel
│   │   ├── theme/                     # Dynamic CSS token manager
│   │   ├── tokens/                    # Color, typography, motion tokens
│   │   └── views/                     # Home, Library, Galaxy, NowPlaying, Stats, Settings
│   ├── main.ts                        # Application entry point
│   └── vite-env.d.ts                  # Vite TypeScript declarations
├── test/                              # Automated test suites (747 tests, 103 suites)
│   ├── app/                           # Lifecycle & DI tests
│   ├── core/                          # Error handling & platform tests
│   ├── data/                          # IndexedDB repository tests
│   ├── domain/                        # Entity invariant tests
│   ├── helpers/                       # Mock DOM & Web Audio test fixtures
│   ├── services/                      # Audio, metadata, scanner, galaxy, stats tests
│   └── ui/                            # View rendering, accessibility, benchmark tests
├── package.json                       # Project configuration & scripts
├── tsconfig.json                      # Strict TypeScript compiler options
└── vite.config.ts                     # Vite build & test configuration
```

---

## 💻 Technology Stack

| Layer | Technologies & Tools |
|---|---|
| **Language** | [TypeScript 5.7+](https://www.typescriptlang.org/) (Strict mode, zero `any` policy for core domains) |
| **Bundler / Dev Server** | [Vite 6.2+](https://vitejs.dev/) |
| **UI Framework** | Pure Vanilla TypeScript & Web Components Architecture (Zero external framework bloat) |
| **Styling** | Vanilla CSS3 with Custom Properties (CSS Variables), Glassmorphism, and GPU-accelerated transitions |
| **Audio Processing** | Native [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) (`AudioContext`, `BiquadFilterNode`, `GainNode`, `AnalyserNode`) |
| **Persistence** | Native [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via custom high-speed transactional repositories |
| **File Access** | [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) & HTML5 Drag-and-Drop / File Input fallback |
| **Icons** | Zero-overhead lightweight SVG Icon Registry with Lucide icon definitions |
| **Testing** | [Vitest 3.0+](https://vitest.dev/) with `fake-indexeddb` and custom Web Audio mocks |

---

## ⚡ Performance Benchmarks

| Metric | Target | Measured Result | Status |
|---|---|---|---|
| **Virtual Scroller Latency** | $< 1.0\text{ ms}$ / scroll | $\mathbf{0.30\text{ ms}}$ (10,000 synthetic tracks) | 🟢 Passed |
| **Virtual Scroller DOM Nodes** | $\le 40$ active nodes | $\mathbf{19\text{ nodes}}$ bounded | 🟢 Passed |
| **Full Library Scan (2,500 files)** | $< 3,000\text{ ms}$ | $\mathbf{1,866\text{ ms}}$ ($0.74\text{ ms}$ / file) | 🟢 Passed |
| **Incremental Unchanged Scan** | $< 1,500\text{ ms}$ | $\mathbf{1,077\text{ ms}}$ (High-speed bypass) | 🟢 Passed |
| **Audio Galaxy (5,362 nodes)** | $< 1,500\text{ ms}$ | $\mathbf{1,120\text{ ms}}$ spatial graph layout | 🟢 Passed |
| **Instant Search Lookup** | $< 5.0\text{ ms}$ | $\mathbf{1.2\text{ ms}}$ (5,000 tracks multi-term) | 🟢 Passed |
| **Memory Footprint** | Bounded & Leak-Free | $0\text{ leaked listener closures}$ across route changes | 🟢 Passed |

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Package Manager**: `npm` (included with Node.js)
- **Modern Web Browser**: Chrome, Edge, Brave, Opera (or any browser supporting Web Audio API & IndexedDB)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ompatel56273-design/MyMusicApp.git
   cd "MyMusicApp"
   ```

2. Install development dependencies:
   ```bash
   npm install
   ```

### Development Server

Start the local development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### Production Build

Compile and bundle the production assets:
```bash
npm run build
```
Preview the production build locally:
```bash
npm run preview
```

### Running the Test Suite

Run the full automated test suite (103 test files, 747 tests):
```bash
npm run test
```

Run tests in watch mode during development:
```bash
npm run test:watch
```

Run TypeScript static typecheck without emitting files:
```bash
npm run typecheck
```

---

## 📚 Roadmap & Documentation

For detailed architectural diagrams, domain models, format specifications, and implementation roadmaps, explore the `Docs/` directory:

- [System Architecture (Docs/02_SYSTEM_ARCHITECTURE.md)](file:///c:/Users/ompat/OneDrive/Desktop/Music%20Player%20App/Docs/02_SYSTEM_ARCHITECTURE.md)
- [Audio Engine Architecture (Docs/03_AUDIO_ENGINE_ARCHITECTURE.md)](file:///c:/Users/ompat/OneDrive/Desktop/Music%20Player%20App/Docs/03_AUDIO_ENGINE_ARCHITECTURE.md)
- [Audio Galaxy Specification (Docs/08_AUDIO_GALAXY_SPEC.md)](file:///c:/Users/ompat/OneDrive/Desktop/Music%20Player%20App/Docs/08_AUDIO_GALAXY_SPEC.md)
- [Audio Format & Parser Specs (Docs/09_AUDIO_FORMAT_SUPPORT.md)](file:///c:/Users/ompat/OneDrive/Desktop/Music%20Player%20App/Docs/09_AUDIO_FORMAT_SUPPORT.md)
- [Database Schema & Migrations (Docs/11_DATA_DATABASE_SCHEMA.md)](file:///c:/Users/ompat/OneDrive/Desktop/Music%20Player%20App/Docs/11_DATA_DATABASE_SCHEMA.md)
- [Implementation Roadmap (Docs/14_IMPLEMENTATION_ROADMAP.md)](file:///c:/Users/ompat/OneDrive/Desktop/Music%20Player%20App/Docs/14_IMPLEMENTATION_ROADMAP.md)

---

## 📄 License

This project is proprietary and confidential. All rights reserved.
