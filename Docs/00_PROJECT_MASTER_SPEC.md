# 🎵 MUSIC PLAYER — PROJECT MASTER SPECIFICATION

**Document:** `00_PROJECT_MASTER_SPEC.md`
**Version:** 1.0
**Status:** Master Project Definition
**Project Type:** Premium Local-First Music Player
**Primary Principle:** Ad-Free, User-Owned, Audio-First Experience

---

# 1. PROJECT OVERVIEW

This project is a premium music player application designed to give users complete control over their locally stored audio files.

The application should support a broad range of audio formats and provide a modern, highly distinctive interface inspired by the richness of professional music players such as Muso, while **not copying Muso's interface, branding, assets, or exact interaction design**.

The goal is to create an original product with its own visual identity and interaction language.

The application should feel less like a traditional "MP3 Player" and more like a:

> **Personal Audio Operating System**

The user's music collection is the center of the entire application.

---

# 2. CORE PRODUCT VISION

The application must be built around five major principles:

1. **Audio First**
2. **Local First**
3. **Ad Free**
4. **Premium Original Design**
5. **Complete User Control**

The application should make a large personal music library feel organized, intelligent, visual, and enjoyable to explore.

---

# 3. PRODUCT STATEMENT

### Short Product Statement

> A premium, completely ad-free music player that transforms a user's entire local audio collection into an immersive and interactive audio experience.

### Extended Product Statement

The application should allow users to:

- Discover their local music.
- Organize audio files.
- Play many supported audio formats.
- Browse songs, albums, artists, genres, folders, and playlists.
- Control playback.
- Inspect detailed audio information.
- View lyrics.
- Use an equalizer.
- Use audio visualization.
- Manage queues and playlists.
- Explore their collection visually.
- Customize their listening experience.

All of this should happen through a clean, premium, original interface.

---

# 4. DESIGN PHILOSOPHY

The design must NOT feel like a generic Android/iOS music player.

Avoid creating a simple interface consisting of:

```text
Hamburger Menu
Song List
Album Art
Play Button
Basic Settings
```

Instead, create a cohesive visual system.

The design should communicate:

- Premium
- Modern
- Futuristic
- Immersive
- Minimal
- Technical
- Musical
- Intelligent
- Responsive
- Elegant

The interface must remain usable despite its visual sophistication.

---

# 5. ORIGINALITY REQUIREMENT

The application may take inspiration from existing music players in terms of:

- Feature categories
- Music library organization
- Playback concepts
- Audio controls
- General usability patterns

However, the implementation must be original.

DO NOT:

- Copy Muso's screen layouts.
- Copy Muso's exact navigation.
- Copy proprietary visual assets.
- Copy logos.
- Copy branding.
- Reproduce another application's exact interface.
- Recreate another application's design pixel-for-pixel.

The final product must have its own:

- Design language
- Navigation system
- Component system
- Animations
- Player layout
- Visualizer style
- Library presentation
- Signature interaction

---

# 6. SIGNATURE PRODUCT CONCEPT

The application should have a unique feature called:

# AUDIO GALAXY

Audio Galaxy is an interactive visual representation of the user's music collection.

Conceptually:

```text
                    GENRE
                      │
             ┌────────┴────────┐
             │                 │
          ARTIST A          ARTIST B
             │                 │
        ┌────┴────┐       ┌────┴────┐
      ALBUM A   ALBUM B  ALBUM C   ALBUM D
        │          │         │        │
      TRACKS     TRACKS    TRACKS   TRACKS
```

The application may represent this relationship visually as a spatial music universe.

Users should eventually be able to:

- Zoom.
- Pan.
- Select artists.
- Open albums.
- Open songs.
- Filter by genre.
- Filter by year.
- Filter by audio format.
- Navigate between related content.

Audio Galaxy should become one of the defining features of the product.

---

# 7. PRIMARY APPLICATION AREAS

The application should contain the following major areas.

```text
APP
│
├── Home
│
├── Library
│   ├── Songs
│   ├── Albums
│   ├── Artists
│   ├── Genres
│   ├── Folders
│   ├── Formats
│   └── Favorites
│
├── Audio Galaxy
│
├── Playlists
│
├── Now Playing
│
├── Lyrics
│
├── Visualizer
│
├── Equalizer
│
├── Queue
│
└── Settings
```

The exact navigation implementation may evolve during development, but these capabilities must remain accessible.

---

# 8. HOME EXPERIENCE

The Home screen should not simply be a song list.

It should intelligently present the user's music.

Potential sections:

```text
Good Morning / Good Afternoon / Good Evening

Continue Listening

Recently Played

Recently Added

Most Played

Favorites

Recently Added Albums

Quick Playlists

Audio Galaxy Entry

Formats / Collection Insights
```

The Home screen should adapt according to the user's actual library.

Do not fabricate content when the library is empty.

---

# 9. MUSIC LIBRARY

The Library is the core organizational area.

It should support:

- Songs
- Albums
- Artists
- Genres
- Folders
- Favorites
- Playlists
- Audio formats

The library must be driven by the actual local audio collection.

The UI should never depend on manually hardcoded songs.

---

# 10. AUDIO FORMAT PHILOSOPHY

The application should be designed around broad audio-format support.

Potential supported formats include:

- MP3
- FLAC
- WAV
- AAC
- M4A
- OGG
- OPUS
- AIFF
- WMA
- ALAC
- APE
- and other formats supported by the selected platform/audio backend.

IMPORTANT:

"Support all formats" must not mean blindly claiming compatibility.

The application must have a capability-detection strategy.

If a format is unsupported by the current platform/backend:

```text
Unsupported / unavailable
        ↓
Clear user message
        ↓
No crash
        ↓
Continue using the rest of the library
```

---

# 11. AUDIO ENGINE PRINCIPLE

The audio engine must be separated from the user interface.

The conceptual architecture is:

```text
UI
 ↓
Playback Service
 ↓
Playback Manager
 ↓
Audio Engine
 ↓
Decoder
 ↓
PCM Audio
 ↓
DSP
 ↓
Audio Output
```

The UI must not directly manipulate decoder internals.

This separation is mandatory for maintainability.

---

# 12. PLAYBACK FEATURES

The playback system should support:

- Play
- Pause
- Stop
- Next
- Previous
- Seek
- Queue
- Shuffle
- Repeat
- Resume playback
- Playback speed
- Sleep timer
- Gapless playback where supported
- Crossfade where supported
- Volume control
- Output device handling where supported

Playback should continue correctly when navigating between application screens.

---

# 13. NOW PLAYING EXPERIENCE

The Now Playing screen is one of the most important screens.

It should have multiple presentation modes.

### Mode 1 — Minimal

Focus on:

- Artwork
- Song title
- Artist
- Progress
- Basic controls

### Mode 2 — Immersive

Focus on:

- Large artwork
- Dynamic ambient background
- Animated transitions
- Visual effects
- Music-reactive elements

### Mode 3 — Pro Audio

Focus on:

- Codec
- Format
- Bitrate
- Sample rate
- Bit depth
- Channels
- Waveform
- Audio analysis
- Playback controls

The user should be able to move between modes naturally.

---

# 14. DYNAMIC ARTWORK SYSTEM

Album artwork should influence the visual environment.

Conceptual pipeline:

```text
Album Artwork
      ↓
Color Extraction
      ↓
Dominant / Accent Colors
      ↓
Dynamic Theme
      ↓
Player Environment
```

The extracted colors may influence:

- Background glow
- Progress indicator
- Visualizer
- Accent elements
- Ambient lighting
- Artwork surroundings

The dynamic theme must remain readable and accessible.

Never allow artwork colors to destroy text contrast.

---

# 15. VISUALIZER

The visualizer should not be limited to ordinary equalizer bars.

Potential visualization modes:

- Waveform
- Spectrum
- Liquid
- Orbit
- Pulse
- Particle/Nebula
- Tunnel
- Artwork Sync
- Minimal

Visualizer rendering must not interfere with audio playback.

The visualizer should consume analysis data rather than directly modifying the audio pipeline.

---

# 16. LYRICS

Lyrics should be treated as a separate feature module.

Potential sources:

1. Embedded lyrics
2. Local lyric files
3. Optional online lyrics provider

Lyrics should support:

- Plain lyrics
- Timed/synchronized lyrics
- Current-line highlighting
- Smooth scrolling
- Manual scrolling
- Auto-follow

Online lyrics must remain optional.

Normal offline playback must not depend on an internet connection.

---

# 17. EQUALIZER / DSP

The application should have a modular DSP architecture.

Potential modules:

```text
DSP
│
├── Equalizer
├── Preamp
├── Bass Boost
├── Balance
├── ReplayGain / Normalization
├── Crossfade
├── Effects
└── Limiter / Safety
```

Each DSP feature should be independently controllable.

DSP processing must remain separate from UI code.

---

# 18. AUDIO INFORMATION

Every track should have an Audio Information view.

Example:

```text
TRACK INFORMATION

Title
Artist
Album
Genre
Year

FORMAT
FLAC

CODEC
FLAC

BIT DEPTH
24-bit

SAMPLE RATE
96 kHz

BITRATE
Variable / calculated

CHANNELS
Stereo

DURATION
04:21

FILE SIZE
87.4 MB

FILE PATH
/ Music / Album / Track.flac
```

Information must come from actual file metadata and/or decoder information.

Do not fabricate technical information.

---

# 19. AUDIO FORMAT EXPLORER

The application should provide a format-based library view.

Example:

```text
AUDIO FORMAT UNIVERSE

LOSSLESS
FLAC
142 tracks

WAV
51 tracks

ALAC
28 tracks

LOSSY
MP3
842 tracks

AAC
123 tracks

OGG
42 tracks

OPUS
19 tracks
```

Counts must be generated dynamically from the user's library.

---

# 20. SEARCH

Search should operate across the music database.

Search targets:

- Songs
- Artists
- Albums
- Genres
- Playlists
- Folders
- Formats

Search should support useful combinations where practical.

Example:

```text
FLAC 2025
```

can potentially mean:

```text
Format = FLAC
Year = 2025
```

rather than simply searching for the literal text.

---

# 21. PLAYLIST SYSTEM

Support:

- Manual playlists
- Favorites
- Recently played
- Most played
- Smart playlists
- Queue-based playlists

Potential smart playlist rules:

```text
Genre = Rock
Format = FLAC
Year > 2020
Rating >= X
Recently Played
Most Played
Never Played
```

Smart playlist behavior must be generated from actual database data.

---

# 22. QUEUE SYSTEM

The queue must be independent of the current screen.

Example:

```text
CURRENT
Track A

UP NEXT
Track B
Track C
Track D
Track E
```

Users should be able to:

- Reorder tracks
- Remove tracks
- Add tracks
- Clear queue
- Save queue as playlist
- Play next
- Add to end

---

# 23. AD-FREE REQUIREMENT

The application is explicitly:

# 100% AD-FREE

Do not introduce:

- Banner advertisements
- Interstitial advertisements
- Reward advertisements
- Popup advertisements
- Sponsored cards
- Advertising SDKs
- Advertising networks
- Promotional interruptions

The product should never be designed around advertising revenue.

---

# 24. PRIVACY PRINCIPLE

The application should be local-first.

The user's music collection should remain on the user's device unless the user explicitly chooses an external feature that requires network access.

Avoid unnecessary:

- Tracking
- Analytics
- Advertising identifiers
- Background network activity
- Uploading music files
- Cloud synchronization requirements

Privacy should be considered during architecture design, not added at the end.

---

# 25. OFFLINE-FIRST PRINCIPLE

Core functionality should work without internet.

Offline functionality should include:

- Library browsing
- Music playback
- Search
- Playlists
- Favorites
- Queue
- Audio information
- Equalizer where platform allows
- Visualizer
- Local lyrics
- Folder browsing

Optional network-dependent features must fail gracefully when offline.

---

# 26. PERFORMANCE PRINCIPLES

The application must remain responsive even with large libraries.

Consider users with:

```text
1,000 tracks
10,000 tracks
50,000 tracks
100,000+ tracks
```

The application should avoid:

- Full-library rescans on every screen load
- Repeated metadata parsing
- Repeated artwork extraction
- Blocking the UI thread
- Loading every album image into memory simultaneously
- Unnecessary database queries
- Excessive animations on low-end hardware

Use:

- Incremental scanning
- Caching
- Pagination/lazy loading
- Background processing
- Database indexing
- Image caching
- Efficient state management

---

# 27. ERROR HANDLING

Errors must be graceful.

Examples:

### Corrupted file

```text
Unable to play this file.

The audio file may be corrupted or unsupported.
```

The application should continue playing the next available track if appropriate.

### Missing file

```text
File no longer exists.

Remove it from the library?
```

### Unsupported format

```text
This format is not supported by the current audio engine.
```

Never allow a single bad file to crash the application.

---

# 28. DESIGN SYSTEM PRINCIPLES

The UI should use a consistent design system.

Define:

- Typography
- Colors
- Spacing
- Corner radius
- Shadows
- Blur
- Elevation
- Icons
- Buttons
- Cards
- Sheets
- Dialogs
- Navigation
- Motion

Do not individually style every screen without shared design tokens.

---

# 29. MOTION DESIGN

Animations should feel connected to music.

Use motion for:

- Screen transitions
- Artwork changes
- Player expansion
- Queue changes
- Progress
- Visualizer
- Lyrics
- Album selection
- Galaxy navigation

Avoid excessive animation.

Motion should improve understanding rather than become decoration.

---

# 30. ACCESSIBILITY

The visual design must remain usable.

Consider:

- Text contrast
- Touch target size
- Dynamic font scaling
- Reduced motion
- Screen reader compatibility
- Color-independent information
- Clear focus states

Dynamic artwork colors must never make essential controls unreadable.

---

# 31. ARCHITECTURAL SEPARATION

Maintain strict separation:

```text
PRESENTATION
     ↓
APPLICATION
     ↓
DOMAIN
     ↓
DATA / AUDIO INFRASTRUCTURE
```

UI code should not contain:

- Decoder implementation
- Database SQL/business logic
- File scanning implementation
- DSP implementation
- Metadata parsing internals

Likewise, the audio engine should not depend on UI components.

---

# 32. EXTENSIBILITY

The architecture must allow future features without rewriting the entire application.

Potential future capabilities:

- External DAC support
- Advanced audio analysis
- Additional codecs
- Advanced metadata editing
- ReplayGain scanning
- Audio fingerprinting
- More visualizer modes
- Custom themes
- Backup/restore
- Import/export playlists
- External controller support
- Desktop companion
- Android Auto / CarPlay where supported
- Cast/output integrations where supported

These features should be considered during architecture design but should not be implemented prematurely.

---

# 33. DEVELOPMENT RULE

Do not implement everything at once.

Development should proceed in layers:

```text
Foundation
   ↓
File Discovery
   ↓
Database
   ↓
Metadata
   ↓
Audio Engine
   ↓
Playback
   ↓
Library
   ↓
Player
   ↓
Playlists
   ↓
Advanced Audio
   ↓
Visualizer
   ↓
Audio Galaxy
   ↓
Polish
```

Each layer should be stable before dependent layers become complex.

---

# 34. QUALITY STANDARD

The application should feel production-grade.

Avoid:

- Temporary hacks
- Hardcoded music data
- Fake functionality
- Placeholder architecture presented as finished
- Unnecessary dependencies
- Duplicate business logic
- Tight coupling
- Memory-heavy implementations
- UI-only implementations of core features

When a feature cannot yet be implemented completely, clearly mark it as:

```text
PLANNED
```

rather than pretending it is functional.

---

# 35. SOURCE OF TRUTH

This document defines the project's high-level product vision.

More specialized documentation files will define individual systems.

Priority should generally be:

```text
PROJECT MASTER SPEC
        ↓
SYSTEM ARCHITECTURE
        ↓
FEATURE SPECIFICATION
        ↓
SYSTEM-SPECIFIC DOCUMENT
        ↓
IMPLEMENTATION
```

If two documents conflict, do not silently choose one.

Identify the conflict and resolve it before making architectural changes.

---

# 36. CHANGE MANAGEMENT

Do not make major architectural changes without documenting them.

Any significant change should record:

```text
CHANGE
WHY
IMPACT
ALTERNATIVES CONSIDERED
DECISION
```

The goal is to prevent architecture drift.

---

# 37. ANTI IMPLEMENTATION PRINCIPLES

Anti must understand the following before implementation:

### DO

- Read the project documentation before coding.
- Preserve architectural separation.
- Build reusable components.
- Keep audio playback independent from UI.
- Keep database operations independent from UI.
- Use real user data.
- Handle large libraries efficiently.
- Handle unsupported/corrupt files gracefully.
- Keep the app ad-free.
- Keep core functionality local-first.
- Build the visual identity consistently.
- Document significant architectural decisions.

### DO NOT

- Copy another music player's UI.
- Add advertisements.
- Add unnecessary online dependencies.
- Hardcode fake music data.
- Couple the decoder directly to UI components.
- Scan the entire library on every screen load.
- Load all artwork into memory simultaneously.
- Make one giant component responsible for the entire application.
- Introduce random dependencies without justification.
- Rewrite stable systems without a reason.
- Implement fake features just to make a screen appear complete.

---

# 38. DEFINITION OF SUCCESS

The project is successful when the user can install the application and immediately feel:

> "This is my own music environment."

The application should provide:

```text
                    MUSIC PLAYER
                         │
        ┌────────────────┼────────────────┐
        │                │                │
      CONTROL          DISCOVER         EXPERIENCE
        │                │                │
    Playback          Library          Visualizer
    Queue             Search           Lyrics
    EQ                Galaxy           Dynamic UI
    Formats           Playlists        Animations
        │                │                │
        └────────────────┼────────────────┘
                         │
                    USER'S MUSIC
```

The application is not primarily about showing buttons.

It is about creating a high-quality environment around the user's audio collection.

---

# 39. FINAL PRODUCT IDENTITY

### Product Category

Premium Local Music Player

### Core Differentiator

Interactive audio collection + immersive player + complete local control.

### Signature Feature

**Audio Galaxy**

### Business Model Principle

**Ad-Free**

### Data Principle

**Local-First**

### Design Principle

**Original Premium Interface**

### Technical Principle

**Modular Audio Architecture**

### User Principle

**The user's music comes first.**

---

# 40. FINAL INSTRUCTION TO IMPLEMENTATION AGENT

Before implementing any feature, understand the overall product architecture.

Do not treat this project as a collection of unrelated screens.

Every feature must fit into the larger system.

The final application should feel like **one unified product**, not a collection of independently generated UI pages.

The visual design, audio engine, database, library, playback system, visualizer, lyrics, playlists, and Audio Galaxy must ultimately work together as one coherent experience.

**Build the foundation correctly first.**

**Do not sacrifice architecture for speed.**

**Do not sacrifice usability for visual effects.**

**Do not sacrifice performance for unnecessary features.**

**Do not sacrifice originality by copying another application.**

---

# END OF MASTER SPECIFICATION
