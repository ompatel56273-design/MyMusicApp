# MUSIC PLAYER — SCREEN ARCHITECTURE

## Document Purpose

This document defines the complete screen architecture for the Music Player App.

It establishes:

- Application navigation
- Screen hierarchy
- Screen responsibilities
- Navigation relationships
- Content structure
- User flows
- Responsive behavior
- Loading states
- Empty states
- Error states
- Playback integration
- Contextual actions
- Screen-level performance rules

This document works together with:

- `00_PROJECT_MASTER_SPEC.md`
- `01_PRODUCT_REQUIREMENTS.md`
- `02_SYSTEM_ARCHITECTURE.md`
- `03_AUDIO_ENGINE_ARCHITECTURE.md`
- `04_MUSIC_LIBRARY_ARCHITECTURE.md`
- `05_UI_UX_DESIGN_SYSTEM.md`

The UI must follow those documents as higher-level architectural rules.

---

# 1. SCREEN ARCHITECTURE PHILOSOPHY

The application should have a clear hierarchy.

The user must always understand:

1. Where they are.
2. What content they are viewing.
3. What is currently playing.
4. How to return.
5. How to access playback.
6. How to access contextual actions.

The application should avoid unnecessary navigation depth.

Preferred principle:

```text
Discover
   ↓
Browse
   ↓
Select
   ↓
Play
   ↓
Control
```

---

# 2. GLOBAL APPLICATION STRUCTURE

The application should conceptually follow:

```text
App Shell
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
│   ├── Favorites
│   ├── Recently Added
│   └── Recently Played
│
├── Audio Galaxy
│
├── Playlists
│   ├── All Playlists
│   └── Playlist Detail
│
├── Now Playing
│   ├── Lyrics
│   ├── Queue
│   ├── Audio Info
│   ├── Equalizer
│   └── Visualizer
│
└── Settings
    ├── Library
    ├── Playback
    ├── Audio
    ├── Appearance
    ├── Lyrics
    ├── Privacy
    ├── Storage
    └── About
```

---

# 3. APPLICATION SHELL

The Application Shell is the persistent structural layer around the application.

It is responsible for:

- Navigation
- Current route
- Mini Player
- Global overlays
- Notifications
- Application-level dialogs

Conceptual structure:

```text
┌─────────────────────────────────────────┐
│                 HEADER                  │
├──────────────┬──────────────────────────┤
│              │                          │
│ NAVIGATION   │       MAIN CONTENT       │
│              │                          │
│              │                          │
├──────────────┴──────────────────────────┤
│               MINI PLAYER               │
└─────────────────────────────────────────┘
```

The exact arrangement changes based on screen size.

---

# 4. PRIMARY NAVIGATION

Primary navigation should expose the most important areas.

Recommended:

```text
Home
Library
Galaxy
Playlists
Settings
```

The navigation system must clearly indicate the current location.

---

# 5. HOME SCREEN

## Purpose

Home is the user's starting point.

It should provide fast access to meaningful music without behaving like a streaming service.

---

## Content

Possible sections:

```text
Greeting / Context

Continue Listening

Recently Played

Recently Added

Favorites

Most Played

Recently Added Albums

Playlists
```

Sections should be data-driven.

If a section has no content, it should normally be omitted.

---

## Home Example

```text
┌───────────────────────────────────────┐
│ Good evening                          │
│                                       │
│ Continue Listening                    │
│ ┌──────┐ Song Title                   │
│ │ Art  │ Artist                       │
│ └──────┘                              │
│                                       │
│ Recently Added                        │
│ [Album] [Album] [Album] [Album]       │
│                                       │
│ Favorites                             │
│ [Song list...]                        │
└───────────────────────────────────────┘
```

---

# 6. LIBRARY HUB

## Purpose

The Library is the central music collection interface.

It should provide multiple organization methods.

Primary categories:

```text
Songs
Albums
Artists
Genres
Folders
Formats
Favorites
Recently Added
Recently Played
```

The user should be able to switch between categories without losing library context.

---

# 7. SONGS SCREEN

## Purpose

Display all indexed tracks.

---

## Core Content

Each row may contain:

```text
Artwork
Track Title
Artist
Album
Duration
Format
Favorite
Context Menu
```

---

## Sorting

Supported sorting may include:

- Title
- Artist
- Album
- Date Added
- Duration
- Year
- Play Count
- Recently Played

---

## Filtering

Possible filters:

- Format
- Artist
- Album
- Genre
- Year
- Folder
- Favorite

---

# 8. ALBUMS SCREEN

Albums should be displayed primarily as artwork-driven content.

Possible layout:

```text
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Artwork │  │ Artwork │  │ Artwork │
│ Album A │  │ Album B │  │ Album C │
│ Artist  │  │ Artist  │  │ Artist  │
└─────────┘  └─────────┘  └─────────┘
```

Users can:

- Open album
- Play album
- Shuffle album
- Queue album
- Add album to playlist
- Favorite album where supported

---

# 9. ALBUM DETAIL SCREEN

## Structure

```text
Large Artwork

Album Name
Artist
Year
Genre
Track Count

[Play] [Shuffle]

Track List

Album Information
```

The track list should maintain disc and track ordering where metadata provides it.

---

# 10. ARTIST SCREEN

## Structure

```text
Artist Name

Albums

Top / Frequently Played Tracks

All Tracks

Genres
```

Artist pages should aggregate the local library.

The application must not require an online artist database for basic functionality.

---

# 11. GENRE SCREEN

Genres should be derived from local metadata.

Possible structure:

```text
Genres
│
├── Rock
├── Pop
├── Electronic
├── Classical
├── Hip-Hop
└── Unknown
```

Genre names should reflect actual indexed metadata.

---

# 12. FOLDER BROWSER

The Folder Browser provides filesystem-oriented navigation.

Example:

```text
Music
├── Artist A
│   ├── Album 1
│   └── Album 2
│
├── Artist B
│   └── Album 1
│
└── Singles
```

Folder browsing must respect the application's platform storage permissions.

The application must not silently modify filesystem contents.

---

# 13. FORMAT EXPLORER

The Format Explorer provides a technical view of the user's music collection.

Example:

```text
Audio Formats

FLAC       142 tracks
MP3        983 tracks
AAC        214 tracks
WAV         42 tracks
OPUS        36 tracks
ALAC        19 tracks
```

Selecting a format displays matching tracks.

This screen is especially useful for users managing large or technically diverse collections.

---

# 14. FAVORITES SCREEN

Favorites should provide a direct collection of tracks the user explicitly marked.

Possible content:

```text
Favorites

[Track]
[Track]
[Track]
[Track]
```

Actions:

- Play
- Shuffle
- Queue
- Remove Favorite
- Add to Playlist

---

# 15. RECENTLY ADDED SCREEN

Displays recently indexed music.

Sorting should be based on library insertion or discovery time.

The screen should distinguish:

```text
Newly discovered
```

from:

```text
Recently played
```

These are different concepts.

---

# 16. RECENTLY PLAYED SCREEN

Displays listening history.

Possible information:

- Track
- Artist
- Last played time
- Play count

Playback history must be local unless the user explicitly enables synchronization in a future implementation.

---

# 17. PLAYLIST HUB

The Playlist Hub displays user-created playlists.

Example:

```text
Your Playlists

[Workout]
[Chill]
[Favorites]
[Driving]
[Custom Playlist]
```

Each playlist should display:

- Name
- Artwork collage or representative artwork
- Track count
- Optional duration

---

# 18. PLAYLIST DETAIL SCREEN

Structure:

```text
Playlist Artwork

Playlist Name
Track Count
Duration

[Play] [Shuffle]

Track List
```

Actions:

- Rename
- Delete
- Add songs
- Remove songs
- Reorder songs
- Play
- Shuffle
- Queue
- Export/share where supported

Deleting a playlist must not delete the underlying music files.

---

# 19. AUDIO GALAXY SCREEN

Audio Galaxy is a dedicated exploration environment.

The user enters a visual map of their music collection.

Possible navigation:

```text
Galaxy
   ↓
Genre
   ↓
Artist
   ↓
Album
   ↓
Track
```

The Galaxy should allow:

- Pan
- Zoom
- Select
- Search
- Focus
- Play
- Open related content

The Galaxy must remain optional.

Users who prefer conventional library navigation should never be forced to use it.

---

# 20. NOW PLAYING SCREEN

Now Playing is the primary playback screen.

Core structure:

```text
Back

Artwork

Song Title
Artist
Album

Progress
Current Time ───── Remaining Time

Previous
Play/Pause
Next

Shuffle
Repeat
Favorite
Queue
Lyrics
More
```

The exact visual arrangement is defined by the UI/UX design system and must remain responsive.

---

# 21. NOW PLAYING EXTENSIONS

Now Playing can expose secondary tools.

Possible tools:

```text
Lyrics
Queue
Equalizer
Visualizer
Audio Info
Sleep Timer
Playback Speed
```

These should not visually overwhelm the primary playback controls.

---

# 22. LYRICS SCREEN

Lyrics should be presented as a focused reading experience.

Possible states:

```text
Lyrics Available
Lyrics Loading
Lyrics Not Available
Lyrics Error
```

If synchronized lyrics are available:

- Highlight current line
- Auto-scroll
- Maintain readable contrast
- Allow manual scrolling

Do not pretend synchronized lyrics exist when only plain lyrics are available.

---

# 23. QUEUE SCREEN

Queue displays the upcoming playback sequence.

Structure:

```text
Now Playing

Next

Track A
Track B
Track C
Track D
```

Actions:

- Reorder
- Remove
- Play immediately
- Clear queue
- Save queue as playlist where supported

The queue is controlled by the authoritative playback system.

---

# 24. AUDIO INFORMATION SCREEN

The Audio Information screen exposes technical details.

Possible information:

```text
File Name
Format
Container
Codec
Bitrate
Sample Rate
Bit Depth
Channels
Duration
File Size
Location
ReplayGain
Metadata
```

The screen should distinguish:

```text
Metadata
```

from:

```text
Technical audio information
```

---

# 25. EQUALIZER SCREEN

The Equalizer screen should provide audio processing controls supported by the engine.

Possible sections:

```text
Preset

Preamp

Bands

Bass
Mid
Treble

Advanced DSP
```

Potential advanced features:

- Parametric EQ
- Limiter
- ReplayGain
- Balance
- Crossfade

The UI must only expose controls actually supported by the audio engine.

---

# 26. VISUALIZER SCREEN

The Visualizer provides optional real-time visual feedback.

Possible modes:

```text
Spectrum
Waveform
Circular
Bars
Particles
Minimal
```

The user should be able to disable visualizers completely.

---

# 27. SETTINGS SCREEN

Settings should be grouped logically.

Recommended structure:

```text
Settings

Playback
Audio
Library
Appearance
Lyrics
Notifications
Storage
Privacy
Advanced
About
```

Avoid putting every setting into one long undifferentiated list.

---

# 28. PLAYBACK SETTINGS

Possible settings:

- Resume playback
- Gapless playback
- Crossfade
- Shuffle behavior
- Repeat behavior
- Playback speed
- Sleep timer defaults
- Auto-play behavior

---

# 29. AUDIO SETTINGS

Possible settings:

- Equalizer
- Preamp
- ReplayGain
- Volume normalization
- Balance
- Output device
- Audio focus
- Bluetooth behavior

Only show platform-supported features.

---

# 30. LIBRARY SETTINGS

Possible settings:

```text
Music Locations

Scan Library

Automatic Scan

Scan on Startup

Include Subfolders

Ignored Folders

Metadata Handling

Artwork Handling
```

Scanning controls must never silently delete user files.

---

# 31. APPEARANCE SETTINGS

Possible settings:

```text
Theme
Accent
Dynamic Artwork Colors
Artwork Style
Visualizer
Animation
Reduced Motion
Compact Mode
```

The default appearance should represent the application's intended premium identity.

---

# 32. STORAGE SCREEN

Storage should communicate:

```text
Music Library Size
Artwork Cache
Audio Analysis Cache
Temporary Data
Database Size
Available Device Storage
```

Cache cleanup must not delete source music.

The user must understand what will be removed before confirming cleanup.

---

# 33. PRIVACY SCREEN

Privacy settings should explain:

- Local library behavior
- Data storage
- Network usage
- Diagnostics
- Optional online functionality

The application should clearly distinguish required platform services from optional network features.

---

# 34. ABOUT SCREEN

About should contain:

- Application name
- Version
- Build information
- License information
- Open-source acknowledgements where applicable
- Privacy information
- Credits

Avoid turning About into a promotional screen.

---

# 35. FIRST-RUN EXPERIENCE

The first launch should guide the user through the minimum setup required.

Suggested flow:

```text
Welcome
   ↓
Storage Permission
   ↓
Select Music Folder
   ↓
Initial Scan
   ↓
Library Ready
   ↓
Home
```

Do not force users through unnecessary tutorials.

---

# 36. INITIAL SCAN SCREEN

The initial scan should show actual progress.

Possible information:

```text
Building your library...

Files discovered: 4,281
Processed: 3,920
Remaining: 361

Artwork: 2,840
Metadata: 3,920

[Continue in Background]
[Cancel]
```

Numbers must come from real scan state.

No fake progress.

---

# 37. GLOBAL SEARCH FLOW

Search should be accessible from major library contexts.

Flow:

```text
Search
   ↓
Query
   ↓
Grouped Results
   ├── Songs
   ├── Albums
   ├── Artists
   ├── Playlists
   └── Folders
```

Selecting a result should take the user directly to the relevant screen.

---

# 38. TRACK CONTEXT FLOW

A track can be accessed from many locations.

Regardless of origin, the context menu should provide consistent actions.

```text
Track
 ↓
Context Menu
 ├── Play
 ├── Play Next
 ├── Add to Queue
 ├── Playlist
 ├── Favorite
 ├── Album
 ├── Artist
 ├── Audio Info
 └── File Location
```

---

# 39. PLAYBACK FLOW

Standard playback flow:

```text
Library
   ↓
Select Track
   ↓
Queue Manager
   ↓
Playback Manager
   ↓
Audio Engine
   ↓
Output Device
```

The screen should not directly control the decoder.

---

# 40. MINI PLAYER FLOW

When playback begins:

```text
Track Selected
      ↓
Playback Starts
      ↓
Mini Player Appears
      ↓
User Taps Mini Player
      ↓
Now Playing Opens
```

If playback stops completely and there is no active session, the Mini Player may disappear according to product rules.

---

# 41. DEEP LINKING

The architecture should allow navigation to specific content.

Examples:

```text
Album
Artist
Playlist
Track
Genre
Folder
```

Deep links must resolve through stable local identifiers rather than fragile display names.

---

# 42. BACK NAVIGATION

Back navigation must be predictable.

General rule:

```text
Current Detail
      ↓
Previous Screen
      ↓
Previous Section
      ↓
Root Screen
```

Now Playing may behave as a modal/expanded playback layer depending on platform.

---

# 43. RESPONSIVE SCREEN ARCHITECTURE

The same screen should adapt to available space.

Example:

### Compact

```text
Navigation
Content
Mini Player
```

### Large

```text
Navigation | Content | Optional Secondary Panel
                         |
                     Queue / Info
```

Do not simply stretch compact layouts across large screens.

---

# 44. LARGE-SCREEN MASTER DETAIL

On wide screens, selected content can be displayed alongside supporting information.

Example:

```text
┌──────────────┬────────────────────────────┐
│ Navigation   │ Album                      │
│              │                            │
│              │ Artwork     Track List     │
│              │                            │
└──────────────┴────────────────────────────┘
```

This should be used where it improves efficiency.

---

# 45. SCREEN STATE MODEL

Every data-driven screen should support at least:

```text
INITIAL
LOADING
CONTENT
EMPTY
ERROR
REFRESHING
```

Screens requiring background operations may also support:

```text
PROCESSING
PAUSED
CANCELLED
COMPLETED
```

---

# 46. SCREEN OWNERSHIP

Each screen should have clear responsibility.

For example:

```text
Home
→ Presentation of library highlights

Library
→ Music collection browsing

Now Playing
→ Playback interaction

Queue
→ Playback sequence management

Settings
→ Configuration

Galaxy
→ Visual music exploration
```

Do not duplicate business logic between screens.

---

# 47. SCREEN DATA FLOW

Screens should consume application/domain state.

Preferred:

```text
Database
   ↓
Repository
   ↓
Application State
   ↓
Screen
```

Not:

```text
Screen
   ↓
Filesystem
   ↓
Database
   ↓
Audio Engine
```

Screens must not directly access low-level infrastructure.

---

# 48. SCREEN PERFORMANCE RULES

Large screens must use:

- Pagination
- Virtualized lists where appropriate
- Lazy artwork loading
- Cached artwork
- Incremental rendering
- Background data processing

Never attempt to render thousands of tracks simultaneously if virtualization can avoid it.

---

# 49. SCREEN ERROR RECOVERY

Every screen should provide a recovery path where possible.

Examples:

```text
Library error
→ Retry scan / Refresh

Artwork error
→ Use placeholder

Lyrics error
→ Continue playback

Audio information error
→ Show available metadata

Galaxy generation error
→ Return to library
```

The application should remain usable even when secondary features fail.

---

# 50. GLOBAL OVERLAY PRIORITY

When multiple overlays are active, use a consistent hierarchy.

Conceptually:

```text
Application
   ↓
Page
   ↓
Mini Player
   ↓
Sheet
   ↓
Dialog
   ↓
Critical Alert
```

Only necessary overlays should appear.

Avoid overlay stacking that traps users.

---

# 51. SCREEN ACCESSIBILITY

Every screen must support:

- Screen reader semantics
- Keyboard navigation where applicable
- Visible focus
- Adequate contrast
- Reduced motion
- Accessible labels
- Logical reading order
- Adequate touch targets

Dynamic visualizations must have non-visual alternatives.

---

# 52. SCREEN SECURITY AND PRIVACY

Screens displaying filesystem information should avoid exposing unnecessary sensitive information.

For example:

- Show filenames where necessary.
- Do not expose unrelated directories.
- Do not send local file paths to remote services without explicit user action.
- Do not upload artwork or audio automatically.

---

# 53. SCREEN IMPLEMENTATION ORDER

Recommended implementation order:

```text
1. Application Shell
2. Navigation
3. Home
4. Library Hub
5. Songs
6. Albums
7. Album Detail
8. Artists
9. Artist Detail
10. Folders
11. Playlists
12. Now Playing
13. Queue
14. Search
15. Audio Information
16. Settings
17. Lyrics
18. Equalizer
19. Visualizer
20. Audio Galaxy
```

The exact development sequence can change if architectural dependencies require it.

---

# 54. SCREEN COMPLETION CRITERIA

A screen is not considered complete simply because it visually renders.

A completed screen must have:

- Correct data source
- Correct navigation
- Correct loading state
- Correct empty state
- Correct error state
- Correct accessibility
- Correct responsive behavior
- Correct playback integration where relevant
- Correct performance behavior
- No fake data
- No broken interactions

---

# 55. FINAL SCREEN ARCHITECTURE RULES

The following rules are mandatory:

1. Every screen must have one clear purpose.
2. Navigation must remain predictable.
3. Playback must remain globally accessible.
4. The Mini Player must provide persistent playback awareness.
5. Now Playing must be immersive but functional.
6. Library screens must be data-driven.
7. Empty states must be intentional.
8. Loading indicators must represent real operations.
9. Errors must provide recovery paths.
10. Large libraries must be handled efficiently.
11. Screens must not directly control low-level audio or filesystem systems.
12. Search must use indexed local data.
13. Audio Galaxy must remain optional.
14. Settings must be logically grouped.
15. Destructive actions require confirmation.
16. No screen may contain fake functionality.
17. No screen should depend unnecessarily on internet connectivity.
18. Responsive layouts must be designed rather than merely scaled.
19. Accessibility is part of the screen architecture.
20. Every screen must follow the global UI/UX design system.

---

# 56. FINAL APPLICATION MAP

```text
                         MUSIC PLAYER
                              │
                    ┌─────────┴─────────┐
                    │   APPLICATION     │
                    │       SHELL       │
                    └─────────┬─────────┘
                              │
       ┌──────────────┬───────┼────────┬──────────────┐
       ▼              ▼       ▼        ▼              ▼
     HOME          LIBRARY  GALAXY  PLAYLISTS      SETTINGS
                      │
       ┌──────────────┼────────────────────────┐
       ▼              ▼            ▼           ▼
     SONGS          ALBUMS       ARTISTS      GENRES
       │              │            │           │
       │              ▼            ▼           │
       │         ALBUM DETAIL  ARTIST DETAIL   │
       │                                          │
       └──────────────────┬───────────────────────┘
                          ▼
                     PLAYBACK
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
         MINI PLAYER             NOW PLAYING
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                ▼
                   LYRICS            QUEUE         AUDIO INFO
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                ▼
                 EQUALIZER       VISUALIZER       SLEEP TIMER
```

The complete screen architecture must preserve one central principle:

> **The interface should make the user's music collection easy to understand, explore, and control while keeping playback reliable and always accessible.**
