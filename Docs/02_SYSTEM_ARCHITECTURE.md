# 🎵 MUSIC PLAYER — SYSTEM ARCHITECTURE

**Document:** `02_SYSTEM_ARCHITECTURE.md`
**Version:** 1.0
**Status:** Technical Architecture Specification
**Parent Documents:**

- `00_PROJECT_MASTER_SPEC.md`
- `01_PRODUCT_REQUIREMENTS.md`

---

# 1. PURPOSE

This document defines the technical architecture of the Music Player application.

The goal is to establish a clean, modular, scalable architecture that supports:

- Local audio playback
- Multiple audio formats
- Large music libraries
- Metadata management
- Playlists
- Queue management
- Lyrics
- Equalizer/DSP
- Visualizers
- Audio Galaxy
- Dynamic artwork
- Offline operation
- High performance
- Privacy
- Future extensibility

The architecture must prevent the application from becoming a tightly coupled collection of UI components.

---

# 2. ARCHITECTURAL PHILOSOPHY

The application should follow a layered architecture.

Conceptually:

```text
┌───────────────────────────────────────────────┐
│                 PRESENTATION                  │
│       Screens / Components / UI / Motion      │
└───────────────────────┬───────────────────────┘
                        │
                        ↓
┌───────────────────────────────────────────────┐
│                 APPLICATION                   │
│     Use Cases / Services / State / Commands   │
└───────────────────────┬───────────────────────┘
                        │
                        ↓
┌───────────────────────────────────────────────┐
│                    DOMAIN                     │
│  Track / Album / Artist / Queue / Playlist    │
└───────────────────────┬───────────────────────┘
                        │
                        ↓
┌───────────────────────────────────────────────┐
│               INFRASTRUCTURE                  │
│ Database / Filesystem / Decoder / Audio I/O   │
└───────────────────────────────────────────────┘
```

The exact programming framework may differ depending on the target platform, but these responsibilities should remain separated.

---

# 3. HIGH-LEVEL ARCHITECTURE

```text
                         MUSIC PLAYER
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ↓                                       ↓
   PRESENTATION LAYER                      BACKGROUND SERVICES
          │                                       │
    ┌─────┼─────┐                         ┌───────┼────────┐
    │     │     │                         │       │        │
  Home  Library Player                  Scanner Metadata Artwork
    │     │     │                         │       │        │
    └─────┼─────┘                         └───────┼────────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              ↓
                       APPLICATION CORE
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ↓                     ↓                     ↓
   Library Engine        Playback Manager      Collection Engine
        │                     │                     │
        ↓                     ↓                     ↓
   Repository Layer      Audio Engine          Database Layer
                              │
                   ┌──────────┼──────────┐
                   ↓          ↓          ↓
                Decoder      DSP       Output
```

---

# 4. ARCHITECTURAL LAYERS

The system consists of five primary layers:

```text
1. Presentation
2. Application
3. Domain
4. Data
5. Infrastructure
```

The audio subsystem is treated as a specialized infrastructure subsystem.

---

# 5. PRESENTATION LAYER

The Presentation Layer is responsible only for displaying and collecting user interaction.

Examples:

```text
Home
Library
Songs
Albums
Artists
Genres
Folders
Player
Queue
Lyrics
Equalizer
Visualizer
Audio Galaxy
Settings
```

Presentation code may:

- Render state.
- Trigger application commands.
- Display errors.
- Display loading states.
- Display animations.
- Collect user input.

Presentation code must NOT:

- Decode audio.
- Parse media files directly.
- Perform database queries directly.
- Scan storage directly.
- Implement DSP.
- Own the playback engine.

---

# 6. APPLICATION LAYER

The Application Layer coordinates user actions.

Examples:

```text
PlayTrack
PausePlayback
SkipNext
AddToQueue
CreatePlaylist
AddToFavorites
ScanLibrary
SearchLibrary
OpenAlbum
LoadLyrics
ApplyEqualizer
```

Conceptually:

```text
User Action
     ↓
Application Command
     ↓
Use Case
     ↓
Domain / Service
     ↓
Repository / Engine
```

This layer should contain application-level orchestration rather than low-level implementation.

---

# 7. DOMAIN LAYER

The Domain Layer defines the core concepts of the product.

Important domain entities:

```text
Track
Artist
Album
Genre
Playlist
PlaylistItem
QueueItem
Lyrics
Artwork
PlaybackState
AudioFormat
AudioMetadata
PlaybackHistory
Favorite
```

Domain models should not depend on UI components.

---

# 8. DOMAIN RELATIONSHIPS

A simplified relationship model:

```text
Artist
  │
  ├──── Album
  │       │
  │       └──── Track
  │
  └──── Track

Genre
  │
  └──── Track

Playlist
  │
  └──── PlaylistItem
              │
              └──── Track
```

A Track may belong to:

- One album.
- One or more artists.
- Zero or more genres.
- Zero or more playlists.
- Favorite state.
- Playback history.

---

# 9. DATA LAYER

The Data Layer provides persistent application data.

Primary responsibilities:

- Database access
- Repository implementation
- File metadata persistence
- Playback history
- Favorites
- Playlist storage
- Settings
- Cached information

Conceptually:

```text
Application Layer
       ↓
Repository Interface
       ↓
Repository Implementation
       ↓
Database / Filesystem
```

The application should not scatter raw database operations throughout UI components.

---

# 10. INFRASTRUCTURE LAYER

Infrastructure provides platform-specific functionality.

Examples:

```text
Filesystem
Database
Audio Decoder
Audio Output
Bluetooth
Media Session
Notifications
Permissions
Device Storage
```

Infrastructure implementations should be replaceable where practical.

---

# 11. AUDIO SUBSYSTEM

Audio is a specialized subsystem.

```text
                AUDIO SUBSYSTEM
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
     Decoder          DSP           Output
        │              │              │
        └──────────────┼──────────────┘
                       ↓
                 Playback Engine
```

The UI should communicate with the Playback Manager rather than directly with these components.

---

# 12. AUDIO DATA FLOW

Normal playback:

```text
Audio File
    ↓
File Access
    ↓
Format Detection
    ↓
Decoder
    ↓
PCM / Audio Frames
    ↓
DSP Pipeline
    ↓
Audio Output
    ↓
Speaker / Headphones / Bluetooth / External Device
```

The player UI observes playback state separately.

---

# 13. PLAYBACK CONTROL FLOW

Example:

```text
User taps PLAY
      ↓
Player UI
      ↓
PlayTrack Use Case
      ↓
Playback Manager
      ↓
Audio Engine
      ↓
Decoder
      ↓
DSP
      ↓
Output
```

The UI does not directly start the decoder.

---

# 14. PLAYBACK STATE

Playback state should be centralized.

Conceptual state:

```text
PlaybackState
│
├── Current Track
├── Is Playing
├── Position
├── Duration
├── Buffered Position
├── Volume
├── Shuffle Mode
├── Repeat Mode
├── Playback Speed
├── Queue
└── Error State
```

There must be one authoritative source of truth for playback state.

Avoid having separate conflicting playback states inside:

- Home
- Mini Player
- Full Player
- Queue
- Notification
- Lock Screen

All should observe the same playback state.

---

# 15. SINGLE PLAYBACK OWNER

There must be one primary Playback Manager.

```text
                    Playback Manager
                           │
       ┌───────────────────┼───────────────────┐
       ↓                   ↓                   ↓
    Mini Player         Full Player         Notification
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ↓
                     Same State
```

Do not create separate audio players for different screens.

---

# 16. MUSIC LIBRARY ARCHITECTURE

The library system should be:

```text
Filesystem
    ↓
Scanner
    ↓
Format Detector
    ↓
Metadata Parser
    ↓
Artwork Extractor
    ↓
Normalizer
    ↓
Database
    ↓
Repositories
    ↓
Library UI
```

The scanner should run independently from the UI rendering system.

---

# 17. SCANNER ARCHITECTURE

The scanner should be incremental.

```text
Scanner
  │
  ├── Discover Files
  │
  ├── Compare Existing Records
  │
  ├── Detect New Files
  │
  ├── Detect Modified Files
  │
  ├── Detect Removed Files
  │
  ├── Parse Metadata
  │
  ├── Extract Artwork
  │
  └── Update Database
```

Scanning should be resumable/recoverable where practical.

---

# 18. DATABASE ARCHITECTURE

The database should be the primary source for library queries.

Example:

```text
Songs Screen
     ↓
Track Repository
     ↓
Database Query
     ↓
Paged Results
     ↓
UI
```

Do not scan the filesystem for every Songs screen request.

---

# 19. ARTWORK ARCHITECTURE

Artwork should use a cache.

```text
Track
 ↓
Artwork ID
 ↓
Artwork Cache
 ↓
UI
```

Artwork extraction:

```text
Audio File
    ↓
Embedded Artwork
    ↓
Image Processing
    ↓
Cache
    ↓
Database Reference
```

If artwork is unavailable:

```text
Fallback Artwork
```

---

# 20. METADATA ARCHITECTURE

Metadata processing should be isolated.

```text
Audio File
    ↓
Metadata Parser
    ↓
Raw Metadata
    ↓
Metadata Normalizer
    ↓
Domain Metadata
    ↓
Database
```

Normalization may handle:

- Missing artist
- Empty album
- Inconsistent casing
- Multiple artists
- Track numbers
- Disc numbers
- Genre formatting

Do not destroy original metadata unless explicitly requested by the user.

---

# 21. REPOSITORY ARCHITECTURE

Repositories should abstract data access.

Examples:

```text
TrackRepository
AlbumRepository
ArtistRepository
PlaylistRepository
LyricsRepository
HistoryRepository
SettingsRepository
ArtworkRepository
```

Conceptually:

```text
UI
 ↓
Use Case
 ↓
Repository Interface
 ↓
Repository Implementation
 ↓
Database
```

This makes the application easier to test and change.

---

# 22. SEARCH ARCHITECTURE

Search should operate against indexed local data.

```text
Search Input
     ↓
Search Service
     ↓
Query Parser
     ↓
Search Repository
     ↓
Database
     ↓
Ranked Results
```

Search should support:

- Exact matching
- Partial matching
- Artist
- Album
- Song
- Genre
- Playlist
- Format

Advanced query parsing may be added later.

---

# 23. QUEUE ARCHITECTURE

Queue belongs to the playback subsystem.

```text
Queue Manager
│
├── Current Track
├── Next Tracks
├── Previous History
├── Shuffle
├── Repeat
└── Queue Operations
```

Queue operations:

```text
Add
Remove
Move
Clear
Play Next
Play Now
Save as Playlist
```

The queue must not be duplicated across screens.

---

# 24. PLAYLIST ARCHITECTURE

Playlist management belongs to the application/domain layer.

```text
Playlist Manager
      │
      ├── Create
      ├── Rename
      ├── Delete
      ├── Add Track
      ├── Remove Track
      └── Reorder
```

Persistence belongs to the repository/database layer.

---

# 25. FAVORITES ARCHITECTURE

Favorite state should be part of persistent library state.

```text
User Action
    ↓
Toggle Favorite
    ↓
Favorite Use Case
    ↓
Track Repository
    ↓
Database
    ↓
Reactive State Update
    ↓
All UI Views
```

Every screen should receive the same favorite state.

---

# 26. PLAYBACK HISTORY

Playback history should be managed centrally.

```text
Playback Manager
      ↓
Playback Event
      ↓
History Service
      ↓
History Repository
      ↓
Database
```

Possible events:

```text
Started
Played Threshold
Completed
Skipped
Paused
Resumed
```

Do not record excessive database writes for every playback position update.

---

# 27. LYRICS ARCHITECTURE

```text
Track
  ↓
Lyrics Service
  ↓
Lyrics Providers
  │
  ├── Embedded
  ├── Local
  └── Optional Online
  ↓
Lyrics Model
  ↓
Lyrics Renderer
```

Lyrics acquisition must not be tightly coupled to the playback engine.

---

# 28. VISUALIZER ARCHITECTURE

Visualizer should receive analysis data.

```text
Audio Stream
     │
     ├──────────────→ Playback Output
     │
     ↓
Audio Analyzer
     ↓
Analysis Frames
     ↓
Visualizer Engine
     ↓
Renderer
```

Visualizer must not modify the audio stream unless an explicitly designed DSP feature does so.

---

# 29. AUDIO ANALYZER

The analyzer may produce:

```text
Waveform
RMS
Peak
Frequency Spectrum
Beat Information
Energy
```

The exact analysis techniques depend on platform and performance requirements.

Analysis frequency should be controlled to prevent unnecessary CPU/GPU usage.

---

# 30. DSP ARCHITECTURE

DSP should be a pipeline.

```text
Decoded PCM
    ↓
Volume
    ↓
Preamp
    ↓
Equalizer
    ↓
Bass / Effects
    ↓
Normalization
    ↓
Limiter
    ↓
Output
```

Each processor should have clearly defined input/output behavior.

DSP should not depend on UI components.

---

# 31. AUDIO GALAXY ARCHITECTURE

Audio Galaxy should consume structured library relationships.

```text
Database
    ↓
Graph Builder
    ↓
Graph Model
    ↓
Galaxy State
    ↓
Galaxy Renderer
```

The Galaxy UI should not query the raw filesystem directly.

---

# 32. DYNAMIC THEME ARCHITECTURE

```text
Album Artwork
      ↓
Color Analyzer
      ↓
Theme Generator
      ↓
Theme State
      ↓
Player UI
```

The generated theme must be constrained by the design system.

Do not allow arbitrary artwork colors to break UI accessibility.

---

# 33. GLOBAL STATE

Only truly global state should be global.

Examples:

```text
Playback State
Current User Settings
Theme State
Application Lifecycle
```

Avoid putting every piece of application data into one giant global store.

Feature-specific state should remain feature-specific.

---

# 34. FEATURE STATE

Examples:

```text
Library State
Search State
Playlist State
Lyrics State
Galaxy State
Visualizer State
```

Each feature should own the state relevant to itself unless another subsystem is the authoritative source.

---

# 35. EVENT-DRIVEN COMMUNICATION

Subsystems should communicate through clearly defined events where appropriate.

Example:

```text
TRACK_CHANGED
      ↓
 ┌────┼────┬────┐
 ↓    ↓    ↓    ↓
UI  Lyrics Theme History
```

Another example:

```text
LIBRARY_UPDATED
      ↓
 ┌────┼────┐
 ↓    ↓    ↓
Home Search Galaxy
```

Events must not become an uncontrolled global message system.

---

# 36. BACKGROUND TASK ARCHITECTURE

Potential background tasks:

```text
Library Scan
Metadata Parsing
Artwork Extraction
Database Maintenance
Audio Analysis
```

Background tasks must:

- Be cancellable where appropriate.
- Report progress.
- Handle errors.
- Avoid blocking the UI.
- Avoid interfering with audio playback.

Audio playback should generally have higher runtime priority than nonessential background processing.

---

# 37. TASK PRIORITY

Conceptual priority:

```text
HIGH
│
├── Audio Playback
├── User Playback Controls
└── Critical Application State

MEDIUM
│
├── Library Queries
├── Search
└── UI Data Loading

LOW
│
├── Artwork Processing
├── Library Maintenance
├── Advanced Analysis
└── Nonessential Background Tasks
```

---

# 38. CACHING ARCHITECTURE

Caching should be used for expensive reusable data.

Potential caches:

```text
Artwork Cache
Metadata Cache
Search Cache
Waveform Cache
Visualizer Cache
```

Every cache must have:

- Clear ownership
- Size/eviction strategy
- Invalidity rules
- Recovery behavior

Never allow caches to grow indefinitely.

---

# 39. ERROR BOUNDARIES

Each major subsystem should have its own error boundary.

```text
Scanner Error
    ↓
Scanner Recovery
```

```text
Decoder Error
    ↓
Playback Recovery
```

```text
Artwork Error
    ↓
Fallback Artwork
```

```text
Lyrics Error
    ↓
Lyrics Unavailable
```

A localized failure should remain localized whenever possible.

---

# 40. LOGGING ARCHITECTURE

Logging should be structured.

Potential categories:

```text
APP
AUDIO
PLAYBACK
SCANNER
DATABASE
METADATA
ARTWORK
LYRICS
VISUALIZER
GALAXY
PERMISSIONS
ERROR
```

Avoid excessive production logging.

Sensitive user information should not be unnecessarily written to logs.

---

# 41. OBSERVABILITY

The application should be diagnosable.

Useful measurements include:

```text
Startup Time
Library Scan Time
Database Query Time
Track Load Time
Decoder Initialization Time
Playback Errors
Memory Usage
Background Task Duration
```

Diagnostics must not significantly interfere with playback.

---

# 42. PERFORMANCE ISOLATION

Heavy tasks must not unnecessarily compete with playback.

For example:

```text
Library Scan
       ↓
Background Worker

Audio Playback
       ↓
Dedicated / Priority Audio Path
```

The scanner must not cause audible playback glitches.

---

# 43. DATABASE PERFORMANCE

The database should use appropriate indexes for common operations.

Likely indexed fields:

```text
Track Title
Artist
Album
Genre
Format
File Path
Favorite State
Playback Time
```

Exact indexing depends on the chosen database technology and measured query patterns.

Do not create unnecessary indexes blindly.

---

# 44. UI PERFORMANCE

Large lists should use efficient rendering.

Avoid rendering thousands of complex elements simultaneously.

Use:

- Virtualization
- Pagination
- Lazy loading
- Image caching
- Incremental rendering

where supported.

---

# 45. MEMORY MANAGEMENT

Potential high-memory objects:

```text
Large Artwork
PCM Buffers
Waveform Data
Spectrum Data
Audio Decoder Buffers
Large Library Collections
```

Rules:

- Do not retain unnecessary audio buffers.
- Do not load the entire music library into memory.
- Do not decode every artwork image simultaneously.
- Do not retain visualizer history indefinitely.
- Release resources when features become inactive.

---

# 46. LIFECYCLE MANAGEMENT

The application must correctly handle:

```text
App Started
App Backgrounded
App Foregrounded
Audio Started
Audio Paused
Audio Stopped
Device Output Changed
App Terminated
```

Playback state should survive lifecycle transitions where platform behavior permits.

---

# 47. RESOURCE OWNERSHIP

Every resource must have a clear owner.

Examples:

```text
Audio Decoder → Audio Engine
Database → Database Manager
Artwork Cache → Artwork Manager
Playback State → Playback Manager
Visualizer Renderer → Visualizer Module
```

Avoid multiple modules owning the same resource without explicit coordination.

---

# 48. CONCURRENCY

Potential concurrent operations include:

```text
Playback
Library Scan
Artwork Extraction
Search
Database Queries
Lyrics Loading
Visualizer Analysis
```

The architecture must prevent race conditions.

Examples:

- A deleted track should not suddenly reappear because an older scan completed later.
- Two scans should not corrupt the database.
- A track change should not apply an old artwork/theme result.
- Queue changes should be serialized correctly.

---

# 49. SOURCE-OF-TRUTH RULE

For every major piece of state, identify one authoritative source.

Examples:

```text
Playback → Playback Manager
Library → Database
Queue → Queue Manager
Settings → Settings Repository
Theme → Theme Manager
```

Other components observe or derive state.

Do not maintain conflicting copies.

---

# 50. DEPENDENCY DIRECTION

Dependencies should generally flow inward:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Infrastructure
```

Infrastructure should not directly control presentation.

Example of prohibited coupling:

```text
Decoder
  ↓
PlayerScreen
```

Preferred:

```text
Decoder
  ↓
Audio Engine
  ↓
Playback Manager
  ↓
Application State
  ↓
PlayerScreen
```

---

# 51. TESTABILITY

Each major subsystem should be testable independently.

Examples:

```text
Scanner Tests
Metadata Tests
Database Tests
Playback Tests
Queue Tests
Playlist Tests
Search Tests
Lyrics Tests
DSP Tests
Visualizer Tests
Galaxy Tests
```

UI tests should not be the only form of testing.

---

# 52. MOCKABLE SERVICES

External/platform dependencies should have abstractions where practical.

Examples:

```text
FileSystem
AudioDecoder
AudioOutput
LyricsProvider
Database
MediaSession
```

This allows tests to run without requiring actual hardware or thousands of real audio files.

---

# 53. PLATFORM ABSTRACTION

If the application eventually targets multiple platforms, platform-specific code should be isolated.

Conceptually:

```text
Shared Application Logic
        │
        ├── Platform A Adapter
        ├── Platform B Adapter
        └── Platform C Adapter
```

Do not spread platform-specific calls throughout the entire codebase.

---

# 54. SECURITY BOUNDARIES

Treat external media files as untrusted input.

Metadata can be malformed.

Files can be:

- Corrupted
- Unexpectedly large
- Incomplete
- Unsupported
- Maliciously constructed

Parsing and decoding must fail safely.

---

# 55. PRIVACY BOUNDARY

The default data flow should remain:

```text
DEVICE
  ↓
LOCAL FILES
  ↓
LOCAL DATABASE
  ↓
LOCAL PLAYBACK
```

Network access should be isolated to explicitly optional features.

---

# 56. NETWORK ARCHITECTURE

If online features are added:

```text
Application
     ↓
Network Service
     ↓
Specific Provider
```

Do not allow arbitrary screens to perform network requests directly.

Online services should be replaceable.

---

# 57. OFFLINE FALLBACK

Example:

```text
Lyrics Request
      ↓
Network Available?
   ┌──┴──┐
 YES     NO
  ↓       ↓
Online   Local
Provider Lyrics
```

If neither exists:

```text
Lyrics unavailable
```

The rest of the application continues normally.

---

# 58. DESIGN SYSTEM ARCHITECTURE

UI components should be built on reusable primitives.

```text
Design Tokens
      ↓
Primitive Components
      ↓
Composite Components
      ↓
Feature Components
      ↓
Screens
```

Examples:

```text
Button
IconButton
Card
Sheet
Slider
Tabs
ListItem
Artwork
MiniPlayer
```

Then:

```text
SongRow
AlbumCard
ArtistCard
PlaylistCard
```

Then:

```text
LibraryScreen
HomeScreen
PlayerScreen
```

---

# 59. COMPONENT RESPONSIBILITY

A component should have one clear responsibility.

Avoid giant components such as:

```text
MusicPlayerEverythingComponent
```

Instead use:

```text
PlayerArtwork
PlayerControls
PlayerProgress
PlayerMetadata
PlayerQueueButton
PlayerLyricsButton
```

The exact component breakdown can evolve.

---

# 60. ANIMATION ARCHITECTURE

Animations should be controlled through the UI/motion system.

The audio engine should not directly manipulate UI animation properties.

Instead:

```text
Audio Analysis
      ↓
Analysis State
      ↓
Visualizer / Motion System
      ↓
UI
```

---

# 61. AUDIO GALAXY PERFORMANCE

Audio Galaxy may contain many nodes.

Therefore:

- Avoid rendering every node at maximum detail.
- Use level-of-detail strategies.
- Use spatial filtering.
- Load relationships progressively.
- Avoid creating thousands of heavy UI objects simultaneously.

The Galaxy must not negatively affect normal music playback.

---

# 62. FEATURE FLAGS

Optional advanced features may use feature flags during development.

Example:

```text
ENABLE_AUDIO_GALAXY
ENABLE_ADVANCED_VISUALIZER
ENABLE_ONLINE_LYRICS
ENABLE_EXPERIMENTAL_DSP
```

Feature flags must not remain as permanent hidden complexity without documentation.

---

# 63. CONFIGURATION

Application configuration should be centralized.

Examples:

```text
Supported formats
Cache limits
Scan settings
Visualizer settings
Playback defaults
Feature flags
Debug options
```

Do not scatter configuration constants throughout the codebase.

---

# 64. INITIALIZATION ORDER

Preferred startup sequence:

```text
Application Start
       ↓
Initialize Core Services
       ↓
Initialize Database
       ↓
Load Settings
       ↓
Initialize Playback Infrastructure
       ↓
Load Cached Library State
       ↓
Display UI
       ↓
Background Library Refresh
```

Do not block startup unnecessarily on expensive library scanning.

---

# 65. SHUTDOWN

On application shutdown where applicable:

```text
Save Critical State
       ↓
Persist Playback Position
       ↓
Flush Important Database Operations
       ↓
Release Audio Resources
       ↓
Release Other Resources
```

Avoid long blocking shutdown operations.

---

# 66. RECOVERY

After unexpected termination:

```text
Application Restart
      ↓
Load Database
      ↓
Validate State
      ↓
Recover Queue / Playback State
      ↓
Continue Normally
```

Corrupted temporary state should be discarded safely.

---

# 67. MIGRATION STRATEGY

Database schema changes must use migrations.

Do not simply delete the user's database when the schema changes.

Example:

```text
Database v1
    ↓
Migration
    ↓
Database v2
```

User data should be preserved wherever possible.

---

# 68. BACKWARD COMPATIBILITY

When changing a model or database structure:

- Preserve existing user data.
- Provide migration.
- Handle missing fields.
- Avoid breaking old playlists.
- Avoid silently deleting metadata.

---

# 69. MODULARITY RULE

Every major subsystem should be independently understandable.

At minimum:

```text
Audio Engine
Library Engine
Database
Playback Manager
Queue Manager
Playlist Manager
Lyrics Manager
Visualizer Engine
Audio Galaxy Engine
Theme Engine
```

Each should have a clearly defined API/interface.

---

# 70. IMPLEMENTATION ORDER

Recommended architectural implementation sequence:

```text
PHASE 1
Project Foundation

PHASE 2
Filesystem + Permissions

PHASE 3
Audio Scanner

PHASE 4
Metadata System

PHASE 5
Database

PHASE 6
Audio Decoder / Engine

PHASE 7
Playback Manager

PHASE 8
Library UI

PHASE 9
Now Playing

PHASE 10
Queue + Playlists

PHASE 11
Favorites + History

PHASE 12
Search

PHASE 13
Audio Information

PHASE 14
Lyrics

PHASE 15
DSP / Equalizer

PHASE 16
Visualizer

PHASE 17
Dynamic Artwork / Theme

PHASE 18
Audio Galaxy

PHASE 19
Performance Optimization

PHASE 20
Production Hardening
```

Do not skip foundational phases merely to make advanced UI visible sooner.

---

# 71. ARCHITECTURAL ANTI-PATTERNS

Avoid:

### Giant Application Class

One class controls everything.

### Giant Player Component

UI + decoder + database + queue + DSP all inside one component.

### Direct Database UI Access

Screens directly executing database operations.

### Direct Filesystem UI Access

Screens directly scanning folders.

### Multiple Playback Engines

Each screen creates its own audio player.

### Global Everything

Every state value stored in one massive global object.

### Uncontrolled Events

Every module listens to every event.

### Hidden Side Effects

Calling a simple UI method unexpectedly starts scanning or playback.

---

# 72. GOLDEN ARCHITECTURAL RULES

### Rule 1

**UI does not own audio playback.**

### Rule 2

**UI does not own the database.**

### Rule 3

**UI does not scan files.**

### Rule 4

**Playback has one authoritative owner.**

### Rule 5

**Library data has one authoritative persistent source.**

### Rule 6

**Heavy operations run outside the UI path.**

### Rule 7

**A failure in one feature should not crash unrelated features.**

### Rule 8

**Core playback must remain reliable even when visual features fail.**

### Rule 9

**Do not sacrifice architecture for a quick visual demo.**

### Rule 10

**Do not add dependencies without understanding their purpose and impact.**

---

# 73. ARCHITECTURE DECISION RULE

Before adding a new feature, answer:

```text
1. Which layer owns this feature?

2. Which module is responsible?

3. What data does it require?

4. What existing service should it use?

5. What state does it create?

6. What is its source of truth?

7. Does it introduce a new dependency?

8. Does it affect playback performance?

9. Does it affect privacy?

10. How will it be tested?
```

If these questions cannot be answered clearly, the feature should not immediately be implemented.

---

# 74. DEFINITION OF ARCHITECTURAL COMPLETION

The architecture is considered healthy when:

- UI can be redesigned without rewriting the audio engine.
- Audio decoder can be changed without rewriting the library UI.
- Database implementation can change without rewriting screens.
- Visualizer can be disabled without affecting playback.
- Lyrics can fail without affecting playback.
- Audio Galaxy can be disabled without affecting normal library navigation.
- Scanner can run in the background without freezing the UI.
- Large libraries remain queryable without loading everything into memory.

---

# 75. FINAL ARCHITECTURE

The intended architecture is:

```text
                         ┌───────────────────────┐
                         │      PRESENTATION     │
                         │                       │
                         │ Home / Library / UI   │
                         │ Player / Galaxy / EQ  │
                         └───────────┬───────────┘
                                     │
                                     ↓
                         ┌───────────────────────┐
                         │     APPLICATION       │
                         │                       │
                         │ Use Cases / Services  │
                         │ Commands / State      │
                         └───────────┬───────────┘
                                     │
                                     ↓
                         ┌───────────────────────┐
                         │        DOMAIN         │
                         │                       │
                         │ Track / Album / Queue │
                         │ Playlist / Artist     │
                         └───────────┬───────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ↓                                       ↓
       ┌──────────────────────┐              ┌──────────────────────┐
       │     DATA LAYER       │              │   AUDIO SUBSYSTEM    │
       │                      │              │                      │
       │ Database             │              │ Decoder              │
       │ Repositories         │              │ DSP                  │
       │ Cache                │              │ Analyzer             │
       │ Persistence          │              │ Output               │
       └──────────┬───────────┘              └──────────┬───────────┘
                  │                                     │
                  └──────────────────┬──────────────────┘
                                     ↓
                         ┌───────────────────────┐
                         │   PLATFORM / DEVICE  │
                         │                       │
                         │ Filesystem            │
                         │ Storage               │
                         │ Audio Hardware        │
                         │ Bluetooth             │
                         │ Media Session         │
                         └───────────────────────┘
```

This architecture is the technical foundation for the entire Music Player project.

All future feature-specific documentation should remain compatible with these boundaries unless an explicit architectural decision changes them.

---

# END OF SYSTEM ARCHITECTURE
