# 14 — IMPLEMENTATION ROADMAP

## 1. Document Purpose

This document defines the implementation roadmap for the Music Player App.

The roadmap converts the previous project specifications into a practical development sequence.

The goal is to build the application incrementally without:

- Breaking the architecture
- Creating duplicated systems
- Blocking playback
- Introducing fake functionality
- Creating unnecessary technical debt
- Sacrificing privacy
- Sacrificing performance
- Building visual features before the core system is stable

The implementation should progress from the foundation toward advanced experiences.

---

# 2. Implementation Philosophy

The application must be built from the inside outward.

The recommended progression is:

```text
Foundation
    ↓
Data
    ↓
Filesystem
    ↓
Audio Engine
    ↓
Core Playback
    ↓
Library
    ↓
Navigation
    ↓
Player Experience
    ↓
Organization
    ↓
Search
    ↓
Audio Intelligence
    ↓
Visual Experience
    ↓
Audio Galaxy
    ↓
Polish
```

Do not reverse this order simply because a visual feature is easier to demonstrate.

---

# 3. Master Development Phases

The project is divided into the following phases:

```text
PHASE 0   Project Foundation
PHASE 1   Application Architecture
PHASE 2   Local Database
PHASE 3   Filesystem & Library Scanner
PHASE 4   Metadata & Artwork
PHASE 5   Audio Engine
PHASE 6   Core Playback
PHASE 7   Library UI
PHASE 8   Now Playing Experience
PHASE 9   Queue / Playlists / Favorites
PHASE 10  Search & Discovery
PHASE 11  Lyrics & Audio Information
PHASE 12  EQ / DSP / Playback Controls
PHASE 13  Visualizer
PHASE 14  Audio Galaxy
PHASE 15  Performance / Privacy / Security Hardening
PHASE 16  Accessibility & Responsive Polish
PHASE 17  Testing & Release Preparation
```

---

# 4. Phase 0 — Project Foundation

## Objective

Create a clean project foundation before implementing application functionality.

### Tasks

- Initialize the application.
- Establish the source directory structure.
- Establish naming conventions.
- Establish configuration structure.
- Establish environment handling.
- Establish dependency management.
- Establish linting/formatting rules where appropriate.
- Establish test infrastructure.
- Establish development/build configuration.
- Establish platform abstraction boundaries.

### Deliverable

A clean application shell that can compile/run without containing unfinished fake functionality.

### Completion Gate

```text
Project starts successfully
        +
Architecture directories exist
        +
Basic test environment works
        +
No unnecessary dependencies
```

---

# 5. Phase 1 — Application Architecture

## Objective

Implement the architectural boundaries defined in the system architecture specification.

### Required layers

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Data / Infrastructure
```

And the specialized:

```text
Audio Subsystem
```

### Tasks

- Establish application services.
- Establish domain models.
- Establish repository interfaces.
- Establish infrastructure adapters.
- Establish application state management.
- Establish event communication.
- Establish dependency direction.
- Establish error boundaries.

### Completion Gate

No major UI component should need to directly access:

- Database
- Filesystem
- Audio decoder
- Low-level platform API

---

# 6. Phase 2 — Local Database

## Objective

Create the authoritative local data layer.

Implement the schema defined in:

`11_DATA_DATABASE_SCHEMA.md`

### Core entities

```text
Track
AudioFile
Artist
Album
Genre
Folder
ScanRoot
AudioFormat
Artwork
Playlist
PlaylistItem
Favorite
PlaybackHistory
PlaybackPosition
QueueItem
PlaybackSession
Lyrics
ScanSession
```

### Tasks

- Database initialization.
- Schema creation.
- Version management.
- Migrations.
- Repository layer.
- Indexes.
- Transactions.
- Pagination.
- Error handling.
- Database reset/recovery strategy.

### Completion Gate

The database must:

- Create successfully.
- Persist data.
- Query data efficiently.
- Handle transactions.
- Support migration.
- Recover safely from expected failures.

---

# 7. Phase 3 — Filesystem & Library Scanner

## Objective

Build the system that discovers music files and synchronizes them with the database.

### Pipeline

```text
Selected Music Root
        ↓
Filesystem Scanner
        ↓
File Detection
        ↓
Format Detection
        ↓
Metadata Extraction
        ↓
Normalization
        ↓
Database
```

### Tasks

- Scan selected folders.
- Detect supported extensions.
- Identify unsupported files.
- Detect changed files.
- Detect removed files.
- Detect moved files where possible.
- Handle duplicates.
- Handle inaccessible files.
- Support cancellation.
- Report progress.
- Support incremental scanning.

### Important rule

Scanning must never block normal playback.

### Completion Gate

The user can select a music folder and see real music files appear in the local library.

---

# 8. Phase 4 — Metadata & Artwork

## Objective

Turn discovered files into rich library records.

### Metadata

Support normalized information such as:

- Title
- Artist
- Album
- Album artist
- Genre
- Year
- Track number
- Disc number
- Composer
- Compilation status
- Duration
- Bitrate
- Sample rate
- Bit depth
- Channels
- Codec
- Container

### Artwork

Implement:

```text
Embedded artwork
        ↓
Artwork extraction
        ↓
Artwork normalization
        ↓
Artwork cache
        ↓
UI
```

### Completion Gate

Tracks with valid metadata appear correctly across library views.

Tracks without metadata remain usable.

Artwork failure must not prevent playback.

---

# 9. Phase 5 — Audio Engine

## Objective

Build the authoritative audio subsystem.

### Pipeline

```text
Audio File
    ↓
File Reader
    ↓
Format / Codec Detection
    ↓
Decoder
    ↓
PCM / Internal Audio
    ↓
DSP
    ↓
Buffer
    ↓
Audio Output
```

### Required concepts

- Decoder abstraction
- Playback state
- Buffering
- Seeking
- Volume
- Balance
- Playback speed
- Output device handling
- Error recovery
- Format capability detection

### Critical rule

The audio engine must not depend on UI components.

---

# 10. Phase 6 — Core Playback

## Objective

Make the application a reliable music player before building advanced features.

### Implement

- Play
- Pause
- Resume
- Stop
- Previous
- Next
- Seek
- Queue
- Shuffle
- Repeat
- Track completion
- Auto-advance
- Playback position
- Resume behavior
- Playback history
- Background playback where supported
- System media controls where supported

### First Major Milestone

At the end of this phase, the application should already be a functional local music player.

---

# 11. Playback Stability Gate

Do not move into advanced UI work until core playback is stable.

Verify:

```text
Play
Pause
Resume
Seek
Next
Previous
Queue
Shuffle
Repeat
Track transition
Long playback
Error recovery
```

The exact testing strategy is defined separately in future testing documentation if expanded.

---

# 12. Phase 7 — Library UI

## Objective

Build the core music browsing experience.

### Screens

Implement the foundation for:

```text
Home
Library
Songs
Albums
Artists
Genres
Folders
Favorites
Recently Added
Recently Played
```

### Requirements

- Real database data
- Pagination
- Lazy loading
- Artwork loading
- Empty states
- Loading states
- Error states
- Sorting
- Filtering
- Multi-selection where appropriate

### Completion Gate

A user can browse the entire local music collection without manually navigating the filesystem.

---

# 13. Phase 8 — Now Playing Experience

## Objective

Create the primary immersive playback experience.

### Implement

- Large artwork
- Track information
- Progress
- Seek
- Playback controls
- Shuffle
- Repeat
- Favorite
- Queue access
- Lyrics access
- Audio information
- Visualizer entry
- Dynamic artwork atmosphere
- Playback speed
- Sleep timer
- Volume/balance controls where appropriate

### Mini Player

Implement a persistent Mini Player that provides:

- Current track
- Artwork
- Playback state
- Play/pause
- Navigation into Now Playing

### Completion Gate

Now Playing becomes the central playback experience without becoming responsible for the audio engine itself.

---

# 14. Phase 9 — Queue, Playlists & Favorites

## Objective

Build music organization features.

### Queue

Implement:

- Add to queue
- Play next
- Remove
- Reorder
- Clear
- Save queue behavior where appropriate

### Playlists

Implement:

- Create
- Rename
- Delete
- Add tracks
- Remove tracks
- Reorder tracks
- Play playlist
- Shuffle playlist

### Favorites

Implement:

- Add favorite
- Remove favorite
- Favorite filtering
- Favorite synchronization across screens

### Completion Gate

All organization features must use the same domain/application logic.

---

# 15. Phase 10 — Search & Discovery

## Objective

Create a fast unified search system.

### Search across

```text
Tracks
Albums
Artists
Genres
Playlists
Folders
```

### Requirements

- Fast response
- Normalized matching
- Partial matching
- Relevant sorting
- Empty state
- No-results state
- Large-library support
- Keyboard support where appropriate

### Search architecture

```text
Search UI
    ↓
Search Service
    ↓
Search Index / Database
    ↓
Normalized Results
```

---

# 16. Phase 11 — Lyrics & Audio Information

## Lyrics

Support:

- Local lyrics
- Embedded lyrics where supported
- Synchronized lyrics where supported
- Unsynchronized lyrics
- Lyrics unavailable state

Online lyrics, if ever added, must remain optional.

## Audio Information

Display actual technical properties:

- Format
- Codec
- Container
- Bitrate
- Sample rate
- Bit depth
- Channels
- Duration
- File size
- File path where appropriate

Do not invent unsupported technical information.

---

# 17. Phase 12 — Equalizer / DSP / Playback Controls

## Objective

Add advanced audio controls after stable playback exists.

### DSP features

Potentially include:

- Equalizer
- Preamp
- Gain
- Balance
- ReplayGain
- Limiter
- Crossfade
- Gapless playback
- Playback speed

### Architecture

```text
Playback Manager
      ↓
Audio Engine
      ↓
DSP Pipeline
      ↓
Output
```

The UI only changes parameters.

It does not implement DSP.

---

# 18. DSP Safety Gate

Before enabling advanced DSP features:

Verify that:

- Playback remains stable.
- Seeking remains correct.
- Track transitions remain correct.
- DSP state updates safely.
- CPU usage remains reasonable.
- Audio does not clip unexpectedly.
- Disabling DSP restores expected behavior.
- Errors remain isolated.

---

# 19. Phase 13 — Visualizer

## Objective

Introduce visual audio experiences without affecting playback reliability.

### Visualizer modes may include:

- Waveform
- Spectrum
- Bars
- Circular spectrum
- Particles
- Pulse
- Album-reactive visualizer
- Minimal visualizer

The exact visual modes should follow the design system.

### Architecture

```text
Audio Engine
      ↓
Audio Analysis
      ↓
Visualizer Data
      ↓
Visualizer Renderer
```

Never decode the audio a second time merely for visualization.

---

# 20. Visualizer Performance Gate

Verify:

- Smooth rendering
- Reduced-motion behavior
- Resource limits
- Automatic reduction under load
- No audio interruption
- Proper pause when hidden
- Correct behavior with different tracks

If visualizer performance is poor, reduce visual complexity before changing the audio system.

---

# 21. Phase 14 — Audio Galaxy

## Objective

Implement the signature feature of the application.

Audio Galaxy should visualize the user's real music collection as a connected universe.

### Data

Use real:

- Tracks
- Albums
- Artists
- Genres
- Playlists
- Folders

### Initial implementation

Start with a stable hierarchy:

```text
Artist
   ↓
Album
   ↓
Track
```

Then expand relationships through:

```text
Genre
Playlist
Folder
```

### Interaction

Implement:

- Zoom
- Pan
- Select
- Focus
- Search
- Play
- Open details
- Return to library
- Reset camera

---

# 22. Audio Galaxy Performance Gate

Before adding advanced physics or effects:

Verify:

- Large-library behavior
- Stable rendering
- Search
- Node selection
- Track playback
- Memory usage
- Reduced motion
- Failure isolation

Use level-of-detail rendering for very large collections.

---

# 23. Phase 15 — Performance / Privacy / Security Hardening

## Objective

Perform dedicated engineering hardening after the major functionality exists.

### Performance

Inspect:

- Startup
- Library loading
- Search
- Scanning
- Artwork
- Database queries
- Playback
- Visualizer
- Galaxy
- Memory usage

### Privacy

Verify:

- No unexpected network access
- No hidden telemetry
- No unnecessary permissions
- No automatic uploads
- No forced account

### Security

Verify:

- File validation
- Path validation
- Metadata handling
- Database integrity
- Migration safety
- Secret handling
- Failure isolation

---

# 24. Performance Optimization Rule

Do not optimize everything simultaneously.

Use:

```text
Measure
 ↓
Identify bottleneck
 ↓
Optimize bottleneck
 ↓
Measure again
```

Do not make architecture changes based solely on assumptions.

---

# 25. Phase 16 — Accessibility & Responsive Polish

## Objective

Ensure the application works well across different users, displays, and interaction methods.

### Verify

- Keyboard navigation
- Focus states
- Screen reader labels
- Contrast
- Text scaling
- Touch targets
- Reduced motion
- Responsive layouts
- Empty states
- Error states
- Loading states

Accessibility should be validated across the major screens.

---

# 26. Responsive Layout Pass

Review:

```text
Home
Library
Songs
Albums
Artists
Playlists
Search
Now Playing
Queue
Lyrics
Settings
Audio Galaxy
```

at different window sizes.

Do not allow responsive layouts to introduce separate business logic.

---

# 27. Phase 17 — Testing & Release Preparation

## Objective

Prepare the application for a reliable release.

### Test categories

```text
Unit
Integration
Database
Filesystem
Audio
Playback
UI
Accessibility
Performance
Security
Error Recovery
```

### Verify critical user journeys

```text
Install
 ↓
Open
 ↓
Grant permissions
 ↓
Select music
 ↓
Scan
 ↓
Browse
 ↓
Search
 ↓
Play
 ↓
Pause
 ↓
Seek
 ↓
Queue
 ↓
Playlist
 ↓
Favorite
 ↓
Close
 ↓
Reopen
 ↓
Resume
```

---

# 28. Release Readiness Gate

The application should not be considered release-ready until:

- Core playback works reliably.
- Library scanning works.
- Database persistence works.
- Search works.
- Playlists work.
- Favorites work.
- Queue works.
- Now Playing works.
- Errors are handled.
- Large libraries remain usable.
- Privacy expectations are met.
- No critical security issues remain.
- No fake production functionality remains.
- Original source files are protected.

---

# 29. Development Order Within Each Feature

Every feature should generally follow:

```text
1. Data model
2. Domain behavior
3. Application service
4. Repository/infrastructure
5. State management
6. UI
7. Loading state
8. Empty state
9. Error state
10. Accessibility
11. Performance review
12. Testing
```

This prevents building UI before the actual feature architecture exists.

---

# 30. Recommended Implementation Milestones

## Milestone A — Technical Foundation

Includes:

- Project setup
- Architecture
- Database
- Repository system
- Configuration
- Error handling

Result:

```text
Stable technical foundation
```

---

## Milestone B — Local Library

Includes:

- Folder selection
- Scanner
- Format detection
- Metadata
- Artwork
- Database synchronization

Result:

```text
Real local music library
```

---

## Milestone C — Functional Player

Includes:

- Audio engine
- Playback
- Queue
- Seek
- Next/previous
- Shuffle/repeat
- Playback history

Result:

```text
Reliable music player
```

---

## Milestone D — Premium Player Experience

Includes:

- Home
- Library
- Mini Player
- Now Playing
- Dynamic artwork
- Queue UI
- Favorites

Result:

```text
Complete primary music experience
```

---

## Milestone E — Organization & Discovery

Includes:

- Playlists
- Search
- Folders
- Formats
- Audio information
- Recently played
- Recently added

Result:

```text
Powerful music collection management
```

---

## Milestone F — Advanced Audio

Includes:

- Lyrics
- Equalizer
- DSP
- ReplayGain
- Crossfade
- Gapless
- Playback speed
- Sleep timer

Result:

```text
Advanced local audio player
```

---

## Milestone G — Visual Experience

Includes:

- Visualizer
- Dynamic artwork effects
- Advanced Now Playing atmosphere

Result:

```text
Immersive audio experience
```

---

## Milestone H — Audio Galaxy

Includes:

- Graph model
- Galaxy renderer
- Navigation
- Search
- Focus
- Playback integration
- Performance optimization

Result:

```text
Signature music-universe experience
```

---

## Milestone I — Production Hardening

Includes:

- Performance
- Privacy
- Security
- Accessibility
- Error recovery
- Regression testing
- Release validation

Result:

```text
Release-ready application
```

---

# 31. Dependency Map

Major dependencies should follow this sequence:

```text
Project Foundation
       ↓
Architecture
       ↓
Database
       ↓
Filesystem Scanner
       ↓
Metadata / Artwork
       ↓
Audio Engine
       ↓
Playback
       ↓
Library UI
       ↓
Now Playing
       ↓
Queue / Playlists / Favorites
       ↓
Search
       ↓
Lyrics / Audio Info
       ↓
DSP / EQ
       ↓
Visualizer
       ↓
Audio Galaxy
       ↓
Hardening
       ↓
Release
```

---

# 32. Features That Must Not Block Core Development

The following features should not delay a usable local player:

- Audio Galaxy
- Advanced visualizers
- Online lyrics
- Cloud services
- Advanced statistics
- Future recommendation systems
- Social functionality
- Optional integrations

The core application must remain useful without them.

---

# 33. MVP Definition

The minimum viable product should contain:

```text
Local music scanning
+
Metadata indexing
+
Library browsing
+
Audio playback
+
Play/pause
+
Seek
+
Previous/next
+
Queue
+
Shuffle/repeat
+
Favorites
+
Basic playlists
+
Search
+
Now Playing
+
Basic audio information
+
Offline operation
```

The MVP must already follow:

- Privacy rules
- Security rules
- Architecture rules
- Performance rules
- Accessibility rules

---

# 34. Post-MVP Features

After MVP stability, implement:

```text
Lyrics
Audio Information expansion
Equalizer
ReplayGain
Crossfade
Gapless
Playback speed
Sleep timer
Visualizer
Audio Galaxy
Advanced Home
Advanced statistics
```

Do not implement all advanced features simultaneously.

---

# 35. Future Feature Expansion

Potential future features include:

- Metadata editor
- Smart playlists
- Advanced collection statistics
- Import/export
- Cloud backup
- Optional online metadata
- Optional online lyrics
- Advanced audio analysis
- More visualizer modes
- Custom themes
- User-defined Galaxy filters

These are future extensions and must not compromise the current architecture.

---

# 36. Feature Flags

Large or experimental features may be introduced behind feature flags during development.

Possible examples:

```text
ENABLE_VISUALIZER
ENABLE_AUDIO_GALAXY
ENABLE_ONLINE_LYRICS
ENABLE_ADVANCED_DSP
```

Feature flags should not become permanent uncontrolled complexity.

Remove temporary development flags when they are no longer needed.

---

# 37. Database Migration Order

When a new feature requires database changes:

```text
Feature Requirement
        ↓
Schema Change
        ↓
Migration
        ↓
Repository Update
        ↓
Domain Update
        ↓
Application Service
        ↓
UI
```

Do not build UI fields that have no reliable persistence strategy when persistence is required.

---

# 38. Audio Engine Change Order

Changes to the audio engine require extra caution.

Preferred process:

```text
Understand current engine
        ↓
Identify exact change
        ↓
Preserve playback contract
        ↓
Implement change
        ↓
Test playback
        ↓
Test seeking
        ↓
Test transitions
        ↓
Test errors
```

Avoid unrelated audio-engine refactoring during feature development.

---

# 39. UI Implementation Order

For each major screen:

```text
Structure
 ↓
Real data
 ↓
Interaction
 ↓
Loading
 ↓
Empty
 ↓
Error
 ↓
Accessibility
 ↓
Responsive layout
 ↓
Motion
 ↓
Performance polish
```

Do not start with animation before the screen actually works.

---

# 40. Design Implementation Rule

The design system defined in:

`05_UI_UX_DESIGN_SYSTEM.md`

is the source of truth for visual implementation.

Do not create unrelated styles for individual screens without a clear reason.

Use consistent:

- Typography
- Spacing
- Radius
- Surface hierarchy
- Buttons
- Icons
- Artwork treatments
- Motion
- Color behavior

---

# 41. No Screen-by-Screen Redesign Drift

As more screens are implemented, the application must remain visually coherent.

For example:

```text
Home
Library
Search
Now Playing
Settings
Galaxy
```

should feel like the same application.

Do not let every screen develop a separate visual language.

---

# 42. Original Design Protection

The implementation must preserve the project's unique identity.

Conceptual inspiration from other music applications is allowed.

Direct copying is not.

Do not reproduce another product's:

- Exact navigation
- Exact layout
- Branding
- Assets
- Icons
- Animations
- Text
- Pixel-level design

The final application must remain visually original.

---

# 43. Performance Checkpoints

Performance should be reviewed at:

```text
After database implementation
After scanner implementation
After playback implementation
After library UI
After Now Playing
After search
After DSP
After visualizer
After Audio Galaxy
Before release
```

This prevents performance problems from accumulating until the end.

---

# 44. Privacy Checkpoints

Privacy should be reviewed at:

```text
Initial architecture
Filesystem implementation
Database implementation
External service integration
Telemetry implementation if ever added
Release preparation
```

Any new network capability requires a separate privacy review.

---

# 45. Security Checkpoints

Security should be reviewed at:

```text
Filesystem scanner
Metadata parser
Database
External integrations
Authentication if ever added
Import/export
Release
```

Treat all external data as untrusted.

---

# 46. Regression Protection

After major changes, verify the core flow:

```text
Open App
 ↓
Library loads
 ↓
Select Track
 ↓
Play
 ↓
Pause
 ↓
Seek
 ↓
Next
 ↓
Queue
 ↓
Close/Reopen
```

A regression in this flow is considered high priority.

---

# 47. Implementation Reporting

After completing a development task, Anti should report:

### What changed

List the implemented changes.

### Why

Explain the reason for the change.

### Files/modules affected

List important affected areas.

### Verification

Describe what was actually verified.

### Known limitations

Clearly identify anything not implemented.

### Risks

Mention any remaining technical concern.

Do not claim something was tested if it was not actually tested.

---

# 48. No False Completion Claims

Anti must distinguish between:

```text
Implemented
Tested
Partially tested
Not tested
Known limitation
```

Do not report:

```text
Everything works perfectly
```

without evidence.

---

# 49. Stop Conditions

Anti should stop and reassess when:

- A change requires breaking a core architecture rule.
- A feature requires unsafe access to user files.
- Playback becomes unstable.
- Memory usage becomes uncontrolled.
- A database migration could destroy data.
- A dependency introduces an unacceptable security risk.
- A requested feature conflicts with the project's privacy model.
- A new implementation requires unexplained duplication.

Do not continue blindly.

---

# 50. Recovery From Failed Implementation

If an implementation causes a regression:

```text
Identify regression
        ↓
Determine affected subsystem
        ↓
Restore stable behavior
        ↓
Identify root cause
        ↓
Implement smaller correction
        ↓
Verify again
```

Do not stack additional patches on top of an unstable implementation without understanding the cause.

---

# 51. Final Implementation Sequence

The complete recommended sequence is:

```text
01. Project Foundation
02. Architecture
03. Database
04. Repository Layer
05. Filesystem Permissions
06. Music Scanner
07. Format Detection
08. Metadata Parser
09. Artwork System
10. Audio Engine
11. Playback Manager
12. Queue
13. Playback History
14. Library Screens
15. Mini Player
16. Now Playing
17. Favorites
18. Playlists
19. Search
20. Folder Browser
21. Format Explorer
22. Audio Information
23. Lyrics
24. Equalizer / DSP
25. ReplayGain
26. Crossfade / Gapless
27. Playback Speed
28. Sleep Timer
29. Visualizer
30. Audio Galaxy
31. Performance Hardening
32. Privacy Hardening
33. Security Hardening
34. Accessibility
35. Responsive Polish
36. Regression Testing
37. Release Validation
```

---

# 52. Final Release Gate

Before release, Anti should verify the following categories.

## Core

```text
Application starts
Database initializes
Library loads
Playback works
```

## Library

```text
Scanning works
Metadata works
Artwork works
Search works
Folders work
Formats are reported correctly
```

## Playback

```text
Play
Pause
Seek
Next
Previous
Queue
Shuffle
Repeat
History
Resume
```

## Organization

```text
Favorites
Playlists
Recently Added
Recently Played
```

## Advanced Audio

```text
Lyrics
Equalizer
DSP
ReplayGain
Crossfade
Gapless
Playback speed
Sleep timer
```

## Visual

```text
Dynamic artwork
Visualizer
Audio Galaxy
```

## Engineering

```text
Performance
Privacy
Security
Accessibility
Error recovery
Database integrity
```

---

# 53. Release Must Not Contain

The production application must not contain:

- Fake data
- Fake functionality
- Placeholder buttons presented as finished features
- Debug-only UI
- Accidental development credentials
- Secrets
- Unnecessary telemetry
- Advertising SDKs
- Unnecessary network dependencies
- Unhandled critical errors
- Unprotected destructive operations
- Silent source-file modification

---

# 54. Final Product Definition

The implementation is successful when the application provides:

```text
A premium
        +
original
        +
ad-free
        +
local-first
        +
privacy-focused
        +
high-performance
        +
accessible
        +
stable
        +
feature-rich
        +
personal
music experience
```

The user should be able to install the application, point it toward their music collection, and immediately begin building a personal music universe without requiring an online account.

---

# 55. Final Architecture Reminder

The complete system should converge toward:

```text
                         USER
                          │
                          ▼
                 ┌─────────────────┐
                 │   APPLICATION   │
                 │      UI         │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │   APPLICATION   │
                 │    SERVICES     │
                 └───────┬─────────┘
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
        LIBRARY      PLAYBACK      SEARCH
             │           │           │
             ▼           ▼           ▼
        DATABASE    AUDIO ENGINE   INDEX
             │           │
             ▼           ▼
       FILESYSTEM     AUDIO OUTPUT
             │
             ▼
       MUSIC COLLECTION

             Additional Systems
             ──────────────────
             Artwork
             Lyrics
             Playlists
             Favorites
             History
             DSP
             Visualizer
             Audio Galaxy
             Cache
             Statistics
```

All systems must communicate through clear boundaries.

---

# 56. Final Development Principle

The Music Player App should not be developed as a collection of disconnected screens.

It should be developed as one coherent audio system.

```text
Real Music Files
       ↓
Reliable Library
       ↓
Reliable Audio Engine
       ↓
Reliable Playback
       ↓
Beautiful User Experience
       ↓
Powerful Organization
       ↓
Immersive Visualization
       ↓
Audio Galaxy
```

Every layer must strengthen the layer below it.

The application should remain useful even if advanced layers are disabled.

---

# 57. FINAL ANTI DIRECTIVE

Anti must use this roadmap together with all previous project documents.

The implementation order may be adjusted when technical constraints require it, but the following principles must remain unchanged:

```text
1. Audio reliability comes first.

2. User-owned data must be protected.

3. The application is local-first.

4. The application is ad-free.

5. Privacy is the default.

6. The UI must not own low-level systems.

7. There must be one authoritative playback engine.

8. Heavy work must not block the UI.

9. Visual features must never compromise playback.

10. Large libraries must remain usable.

11. Real data must drive the application.

12. No fake functionality.

13. No silent source-file modification.

14. Security must be designed into the system.

15. Accessibility must be part of implementation.

16. Performance must be measured rather than assumed.

17. Features must be implemented incrementally.

18. Existing working functionality must be protected.

19. The visual design must remain original.

20. The final application must feel like one coherent premium music product.
```

---

# 58. Documentation Package Completion

The original core project specification package is now complete.

````text
00_PROJECT_MASTER_SPEC.md
01_PRODUCT_REQUIREMENTS.md
02_SYSTEM_ARCHITECTURE.md
03_AUDIO_ENGINE_ARCHITECTURE.md
04_MUSIC_LIBRARY_ARCHITECTURE.md
05_UI_UX_DESIGN_SYSTEM.md# 14 — IMPLEMENTATION ROADMAP

## 1. Document Purpose

This document defines the implementation roadmap for the Music Player App.

The roadmap converts the previous project specifications into a practical development sequence.

The goal is to build the application incrementally without:

* Breaking the architecture
* Creating duplicated systems
* Blocking playback
* Introducing fake functionality
* Creating unnecessary technical debt
* Sacrificing privacy
* Sacrificing performance
* Building visual features before the core system is stable

The implementation should progress from the foundation toward advanced experiences.

---

# 2. Implementation Philosophy

The application must be built from the inside outward.

The recommended progression is:

```text
Foundation
    ↓
Data
    ↓
Filesystem
    ↓
Audio Engine
    ↓
Core Playback
    ↓
Library
    ↓
Navigation
    ↓
Player Experience
    ↓
Organization
    ↓
Search
    ↓
Audio Intelligence
    ↓
Visual Experience
    ↓
Audio Galaxy
    ↓
Polish
````

Do not reverse this order simply because a visual feature is easier to demonstrate.

---

# 3. Master Development Phases

The project is divided into the following phases:

```text
PHASE 0   Project Foundation
PHASE 1   Application Architecture
PHASE 2   Local Database
PHASE 3   Filesystem & Library Scanner
PHASE 4   Metadata & Artwork
PHASE 5   Audio Engine
PHASE 6   Core Playback
PHASE 7   Library UI
PHASE 8   Now Playing Experience
PHASE 9   Queue / Playlists / Favorites
PHASE 10  Search & Discovery
PHASE 11  Lyrics & Audio Information
PHASE 12  EQ / DSP / Playback Controls
PHASE 13  Visualizer
PHASE 14  Audio Galaxy
PHASE 15  Performance / Privacy / Security Hardening
PHASE 16  Accessibility & Responsive Polish
PHASE 17  Testing & Release Preparation
```

---

# 4. Phase 0 — Project Foundation

## Objective

Create a clean project foundation before implementing application functionality.

### Tasks

- Initialize the application.
- Establish the source directory structure.
- Establish naming conventions.
- Establish configuration structure.
- Establish environment handling.
- Establish dependency management.
- Establish linting/formatting rules where appropriate.
- Establish test infrastructure.
- Establish development/build configuration.
- Establish platform abstraction boundaries.

### Deliverable

A clean application shell that can compile/run without containing unfinished fake functionality.

### Completion Gate

```text
Project starts successfully
        +
Architecture directories exist
        +
Basic test environment works
        +
No unnecessary dependencies
```

---

# 5. Phase 1 — Application Architecture

## Objective

Implement the architectural boundaries defined in the system architecture specification.

### Required layers

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Data / Infrastructure
```

And the specialized:

```text
Audio Subsystem
```

### Tasks

- Establish application services.
- Establish domain models.
- Establish repository interfaces.
- Establish infrastructure adapters.
- Establish application state management.
- Establish event communication.
- Establish dependency direction.
- Establish error boundaries.

### Completion Gate

No major UI component should need to directly access:

- Database
- Filesystem
- Audio decoder
- Low-level platform API

---

# 6. Phase 2 — Local Database

## Objective

Create the authoritative local data layer.

Implement the schema defined in:

`11_DATA_DATABASE_SCHEMA.md`

### Core entities

```text
Track
AudioFile
Artist
Album
Genre
Folder
ScanRoot
AudioFormat
Artwork
Playlist
PlaylistItem
Favorite
PlaybackHistory
PlaybackPosition
QueueItem
PlaybackSession
Lyrics
ScanSession
```

### Tasks

- Database initialization.
- Schema creation.
- Version management.
- Migrations.
- Repository layer.
- Indexes.
- Transactions.
- Pagination.
- Error handling.
- Database reset/recovery strategy.

### Completion Gate

The database must:

- Create successfully.
- Persist data.
- Query data efficiently.
- Handle transactions.
- Support migration.
- Recover safely from expected failures.

---

# 7. Phase 3 — Filesystem & Library Scanner

## Objective

Build the system that discovers music files and synchronizes them with the database.

### Pipeline

```text
Selected Music Root
        ↓
Filesystem Scanner
        ↓
File Detection
        ↓
Format Detection
        ↓
Metadata Extraction
        ↓
Normalization
        ↓
Database
```

### Tasks

- Scan selected folders.
- Detect supported extensions.
- Identify unsupported files.
- Detect changed files.
- Detect removed files.
- Detect moved files where possible.
- Handle duplicates.
- Handle inaccessible files.
- Support cancellation.
- Report progress.
- Support incremental scanning.

### Important rule

Scanning must never block normal playback.

### Completion Gate

The user can select a music folder and see real music files appear in the local library.

---

# 8. Phase 4 — Metadata & Artwork

## Objective

Turn discovered files into rich library records.

### Metadata

Support normalized information such as:

- Title
- Artist
- Album
- Album artist
- Genre
- Year
- Track number
- Disc number
- Composer
- Compilation status
- Duration
- Bitrate
- Sample rate
- Bit depth
- Channels
- Codec
- Container

### Artwork

Implement:

```text
Embedded artwork
        ↓
Artwork extraction
        ↓
Artwork normalization
        ↓
Artwork cache
        ↓
UI
```

### Completion Gate

Tracks with valid metadata appear correctly across library views.

Tracks without metadata remain usable.

Artwork failure must not prevent playback.

---

# 9. Phase 5 — Audio Engine

## Objective

Build the authoritative audio subsystem.

### Pipeline

```text
Audio File
    ↓
File Reader
    ↓
Format / Codec Detection
    ↓
Decoder
    ↓
PCM / Internal Audio
    ↓
DSP
    ↓
Buffer
    ↓
Audio Output
```

### Required concepts

- Decoder abstraction
- Playback state
- Buffering
- Seeking
- Volume
- Balance
- Playback speed
- Output device handling
- Error recovery
- Format capability detection

### Critical rule

The audio engine must not depend on UI components.

---

# 10. Phase 6 — Core Playback

## Objective

Make the application a reliable music player before building advanced features.

### Implement

- Play
- Pause
- Resume
- Stop
- Previous
- Next
- Seek
- Queue
- Shuffle
- Repeat
- Track completion
- Auto-advance
- Playback position
- Resume behavior
- Playback history
- Background playback where supported
- System media controls where supported

### First Major Milestone

At the end of this phase, the application should already be a functional local music player.

---

# 11. Playback Stability Gate

Do not move into advanced UI work until core playback is stable.

Verify:

```text
Play
Pause
Resume
Seek
Next
Previous
Queue
Shuffle
Repeat
Track transition
Long playback
Error recovery
```

The exact testing strategy is defined separately in future testing documentation if expanded.

---

# 12. Phase 7 — Library UI

## Objective

Build the core music browsing experience.

### Screens

Implement the foundation for:

```text
Home
Library
Songs
Albums
Artists
Genres
Folders
Favorites
Recently Added
Recently Played
```

### Requirements

- Real database data
- Pagination
- Lazy loading
- Artwork loading
- Empty states
- Loading states
- Error states
- Sorting
- Filtering
- Multi-selection where appropriate

### Completion Gate

A user can browse the entire local music collection without manually navigating the filesystem.

---

# 13. Phase 8 — Now Playing Experience

## Objective

Create the primary immersive playback experience.

### Implement

- Large artwork
- Track information
- Progress
- Seek
- Playback controls
- Shuffle
- Repeat
- Favorite
- Queue access
- Lyrics access
- Audio information
- Visualizer entry
- Dynamic artwork atmosphere
- Playback speed
- Sleep timer
- Volume/balance controls where appropriate

### Mini Player

Implement a persistent Mini Player that provides:

- Current track
- Artwork
- Playback state
- Play/pause
- Navigation into Now Playing

### Completion Gate

Now Playing becomes the central playback experience without becoming responsible for the audio engine itself.

---

# 14. Phase 9 — Queue, Playlists & Favorites

## Objective

Build music organization features.

### Queue

Implement:

- Add to queue
- Play next
- Remove
- Reorder
- Clear
- Save queue behavior where appropriate

### Playlists

Implement:

- Create
- Rename
- Delete
- Add tracks
- Remove tracks
- Reorder tracks
- Play playlist
- Shuffle playlist

### Favorites

Implement:

- Add favorite
- Remove favorite
- Favorite filtering
- Favorite synchronization across screens

### Completion Gate

All organization features must use the same domain/application logic.

---

# 15. Phase 10 — Search & Discovery

## Objective

Create a fast unified search system.

### Search across

```text
Tracks
Albums
Artists
Genres
Playlists
Folders
```

### Requirements

- Fast response
- Normalized matching
- Partial matching
- Relevant sorting
- Empty state
- No-results state
- Large-library support
- Keyboard support where appropriate

### Search architecture

```text
Search UI
    ↓
Search Service
    ↓
Search Index / Database
    ↓
Normalized Results
```

---

# 16. Phase 11 — Lyrics & Audio Information

## Lyrics

Support:

- Local lyrics
- Embedded lyrics where supported
- Synchronized lyrics where supported
- Unsynchronized lyrics
- Lyrics unavailable state

Online lyrics, if ever added, must remain optional.

## Audio Information

Display actual technical properties:

- Format
- Codec
- Container
- Bitrate
- Sample rate
- Bit depth
- Channels
- Duration
- File size
- File path where appropriate

Do not invent unsupported technical information.

---

# 17. Phase 12 — Equalizer / DSP / Playback Controls

## Objective

Add advanced audio controls after stable playback exists.

### DSP features

Potentially include:

- Equalizer
- Preamp
- Gain
- Balance
- ReplayGain
- Limiter
- Crossfade
- Gapless playback
- Playback speed

### Architecture

```text
Playback Manager
      ↓
Audio Engine
      ↓
DSP Pipeline
      ↓
Output
```

The UI only changes parameters.

It does not implement DSP.

---

# 18. DSP Safety Gate

Before enabling advanced DSP features:

Verify that:

- Playback remains stable.
- Seeking remains correct.
- Track transitions remain correct.
- DSP state updates safely.
- CPU usage remains reasonable.
- Audio does not clip unexpectedly.
- Disabling DSP restores expected behavior.
- Errors remain isolated.

---

# 19. Phase 13 — Visualizer

## Objective

Introduce visual audio experiences without affecting playback reliability.

### Visualizer modes may include:

- Waveform
- Spectrum
- Bars
- Circular spectrum
- Particles
- Pulse
- Album-reactive visualizer
- Minimal visualizer

The exact visual modes should follow the design system.

### Architecture

```text
Audio Engine
      ↓
Audio Analysis
      ↓
Visualizer Data
      ↓
Visualizer Renderer
```

Never decode the audio a second time merely for visualization.

---

# 20. Visualizer Performance Gate

Verify:

- Smooth rendering
- Reduced-motion behavior
- Resource limits
- Automatic reduction under load
- No audio interruption
- Proper pause when hidden
- Correct behavior with different tracks

If visualizer performance is poor, reduce visual complexity before changing the audio system.

---

# 21. Phase 14 — Audio Galaxy

## Objective

Implement the signature feature of the application.

Audio Galaxy should visualize the user's real music collection as a connected universe.

### Data

Use real:

- Tracks
- Albums
- Artists
- Genres
- Playlists
- Folders

### Initial implementation

Start with a stable hierarchy:

```text
Artist
   ↓
Album
   ↓
Track
```

Then expand relationships through:

```text
Genre
Playlist
Folder
```

### Interaction

Implement:

- Zoom
- Pan
- Select
- Focus
- Search
- Play
- Open details
- Return to library
- Reset camera

---

# 22. Audio Galaxy Performance Gate

Before adding advanced physics or effects:

Verify:

- Large-library behavior
- Stable rendering
- Search
- Node selection
- Track playback
- Memory usage
- Reduced motion
- Failure isolation

Use level-of-detail rendering for very large collections.

---

# 23. Phase 15 — Performance / Privacy / Security Hardening

## Objective

Perform dedicated engineering hardening after the major functionality exists.

### Performance

Inspect:

- Startup
- Library loading
- Search
- Scanning
- Artwork
- Database queries
- Playback
- Visualizer
- Galaxy
- Memory usage

### Privacy

Verify:

- No unexpected network access
- No hidden telemetry
- No unnecessary permissions
- No automatic uploads
- No forced account

### Security

Verify:

- File validation
- Path validation
- Metadata handling
- Database integrity
- Migration safety
- Secret handling
- Failure isolation

---

# 24. Performance Optimization Rule

Do not optimize everything simultaneously.

Use:

```text
Measure
 ↓
Identify bottleneck
 ↓
Optimize bottleneck
 ↓
Measure again
```

Do not make architecture changes based solely on assumptions.

---

# 25. Phase 16 — Accessibility & Responsive Polish

## Objective

Ensure the application works well across different users, displays, and interaction methods.

### Verify

- Keyboard navigation
- Focus states
- Screen reader labels
- Contrast
- Text scaling
- Touch targets
- Reduced motion
- Responsive layouts
- Empty states
- Error states
- Loading states

Accessibility should be validated across the major screens.

---

# 26. Responsive Layout Pass

Review:

```text
Home
Library
Songs
Albums
Artists
Playlists
Search
Now Playing
Queue
Lyrics
Settings
Audio Galaxy
```

at different window sizes.

Do not allow responsive layouts to introduce separate business logic.

---

# 27. Phase 17 — Testing & Release Preparation

## Objective

Prepare the application for a reliable release.

### Test categories

```text
Unit
Integration
Database
Filesystem
Audio
Playback
UI
Accessibility
Performance
Security
Error Recovery
```

### Verify critical user journeys

```text
Install
 ↓
Open
 ↓
Grant permissions
 ↓
Select music
 ↓
Scan
 ↓
Browse
 ↓
Search
 ↓
Play
 ↓
Pause
 ↓
Seek
 ↓
Queue
 ↓
Playlist
 ↓
Favorite
 ↓
Close
 ↓
Reopen
 ↓
Resume
```

---

# 28. Release Readiness Gate

The application should not be considered release-ready until:

- Core playback works reliably.
- Library scanning works.
- Database persistence works.
- Search works.
- Playlists work.
- Favorites work.
- Queue works.
- Now Playing works.
- Errors are handled.
- Large libraries remain usable.
- Privacy expectations are met.
- No critical security issues remain.
- No fake production functionality remains.
- Original source files are protected.

---

# 29. Development Order Within Each Feature

Every feature should generally follow:

```text
1. Data model
2. Domain behavior
3. Application service
4. Repository/infrastructure
5. State management
6. UI
7. Loading state
8. Empty state
9. Error state
10. Accessibility
11. Performance review
12. Testing
```

This prevents building UI before the actual feature architecture exists.

---

# 30. Recommended Implementation Milestones

## Milestone A — Technical Foundation

Includes:

- Project setup
- Architecture
- Database
- Repository system
- Configuration
- Error handling

Result:

```text
Stable technical foundation
```

---

## Milestone B — Local Library

Includes:

- Folder selection
- Scanner
- Format detection
- Metadata
- Artwork
- Database synchronization

Result:

```text
Real local music library
```

---

## Milestone C — Functional Player

Includes:

- Audio engine
- Playback
- Queue
- Seek
- Next/previous
- Shuffle/repeat
- Playback history

Result:

```text
Reliable music player
```

---

## Milestone D — Premium Player Experience

Includes:

- Home
- Library
- Mini Player
- Now Playing
- Dynamic artwork
- Queue UI
- Favorites

Result:

```text
Complete primary music experience
```

---

## Milestone E — Organization & Discovery

Includes:

- Playlists
- Search
- Folders
- Formats
- Audio information
- Recently played
- Recently added

Result:

```text
Powerful music collection management
```

---

## Milestone F — Advanced Audio

Includes:

- Lyrics
- Equalizer
- DSP
- ReplayGain
- Crossfade
- Gapless
- Playback speed
- Sleep timer

Result:

```text
Advanced local audio player
```

---

## Milestone G — Visual Experience

Includes:

- Visualizer
- Dynamic artwork effects
- Advanced Now Playing atmosphere

Result:

```text
Immersive audio experience
```

---

## Milestone H — Audio Galaxy

Includes:

- Graph model
- Galaxy renderer
- Navigation
- Search
- Focus
- Playback integration
- Performance optimization

Result:

```text
Signature music-universe experience
```

---

## Milestone I — Production Hardening

Includes:

- Performance
- Privacy
- Security
- Accessibility
- Error recovery
- Regression testing
- Release validation

Result:

```text
Release-ready application
```

---

# 31. Dependency Map

Major dependencies should follow this sequence:

```text
Project Foundation
       ↓
Architecture
       ↓
Database
       ↓
Filesystem Scanner
       ↓
Metadata / Artwork
       ↓
Audio Engine
       ↓
Playback
       ↓
Library UI
       ↓
Now Playing
       ↓
Queue / Playlists / Favorites
       ↓
Search
       ↓
Lyrics / Audio Info
       ↓
DSP / EQ
       ↓
Visualizer
       ↓
Audio Galaxy
       ↓
Hardening
       ↓
Release
```

---

# 32. Features That Must Not Block Core Development

The following features should not delay a usable local player:

- Audio Galaxy
- Advanced visualizers
- Online lyrics
- Cloud services
- Advanced statistics
- Future recommendation systems
- Social functionality
- Optional integrations

The core application must remain useful without them.

---

# 33. MVP Definition

The minimum viable product should contain:

```text
Local music scanning
+
Metadata indexing
+
Library browsing
+
Audio playback
+
Play/pause
+
Seek
+
Previous/next
+
Queue
+
Shuffle/repeat
+
Favorites
+
Basic playlists
+
Search
+
Now Playing
+
Basic audio information
+
Offline operation
```

The MVP must already follow:

- Privacy rules
- Security rules
- Architecture rules
- Performance rules
- Accessibility rules

---

# 34. Post-MVP Features

After MVP stability, implement:

```text
Lyrics
Audio Information expansion
Equalizer
ReplayGain
Crossfade
Gapless
Playback speed
Sleep timer
Visualizer
Audio Galaxy
Advanced Home
Advanced statistics
```

Do not implement all advanced features simultaneously.

---

# 35. Future Feature Expansion

Potential future features include:

- Metadata editor
- Smart playlists
- Advanced collection statistics
- Import/export
- Cloud backup
- Optional online metadata
- Optional online lyrics
- Advanced audio analysis
- More visualizer modes
- Custom themes
- User-defined Galaxy filters

These are future extensions and must not compromise the current architecture.

---

# 36. Feature Flags

Large or experimental features may be introduced behind feature flags during development.

Possible examples:

```text
ENABLE_VISUALIZER
ENABLE_AUDIO_GALAXY
ENABLE_ONLINE_LYRICS
ENABLE_ADVANCED_DSP
```

Feature flags should not become permanent uncontrolled complexity.

Remove temporary development flags when they are no longer needed.

---

# 37. Database Migration Order

When a new feature requires database changes:

```text
Feature Requirement
        ↓
Schema Change
        ↓
Migration
        ↓
Repository Update
        ↓
Domain Update
        ↓
Application Service
        ↓
UI
```

Do not build UI fields that have no reliable persistence strategy when persistence is required.

---

# 38. Audio Engine Change Order

Changes to the audio engine require extra caution.

Preferred process:

```text
Understand current engine
        ↓
Identify exact change
        ↓
Preserve playback contract
        ↓
Implement change
        ↓
Test playback
        ↓
Test seeking
        ↓
Test transitions
        ↓
Test errors
```

Avoid unrelated audio-engine refactoring during feature development.

---

# 39. UI Implementation Order

For each major screen:

```text
Structure
 ↓
Real data
 ↓
Interaction
 ↓
Loading
 ↓
Empty
 ↓
Error
 ↓
Accessibility
 ↓
Responsive layout
 ↓
Motion
 ↓
Performance polish
```

Do not start with animation before the screen actually works.

---

# 40. Design Implementation Rule

The design system defined in:

`05_UI_UX_DESIGN_SYSTEM.md`

is the source of truth for visual implementation.

Do not create unrelated styles for individual screens without a clear reason.

Use consistent:

- Typography
- Spacing
- Radius
- Surface hierarchy
- Buttons
- Icons
- Artwork treatments
- Motion
- Color behavior

---

# 41. No Screen-by-Screen Redesign Drift

As more screens are implemented, the application must remain visually coherent.

For example:

```text
Home
Library
Search
Now Playing
Settings
Galaxy
```

should feel like the same application.

Do not let every screen develop a separate visual language.

---

# 42. Original Design Protection

The implementation must preserve the project's unique identity.

Conceptual inspiration from other music applications is allowed.

Direct copying is not.

Do not reproduce another product's:

- Exact navigation
- Exact layout
- Branding
- Assets
- Icons
- Animations
- Text
- Pixel-level design

The final application must remain visually original.

---

# 43. Performance Checkpoints

Performance should be reviewed at:

```text
After database implementation
After scanner implementation
After playback implementation
After library UI
After Now Playing
After search
After DSP
After visualizer
After Audio Galaxy
Before release
```

This prevents performance problems from accumulating until the end.

---

# 44. Privacy Checkpoints

Privacy should be reviewed at:

```text
Initial architecture
Filesystem implementation
Database implementation
External service integration
Telemetry implementation if ever added
Release preparation
```

Any new network capability requires a separate privacy review.

---

# 45. Security Checkpoints

Security should be reviewed at:

```text
Filesystem scanner
Metadata parser
Database
External integrations
Authentication if ever added
Import/export
Release
```

Treat all external data as untrusted.

---

# 46. Regression Protection

After major changes, verify the core flow:

```text
Open App
 ↓
Library loads
 ↓
Select Track
 ↓
Play
 ↓
Pause
 ↓
Seek
 ↓
Next
 ↓
Queue
 ↓
Close/Reopen
```

A regression in this flow is considered high priority.

---

# 47. Implementation Reporting

After completing a development task, Anti should report:

### What changed

List the implemented changes.

### Why

Explain the reason for the change.

### Files/modules affected

List important affected areas.

### Verification

Describe what was actually verified.

### Known limitations

Clearly identify anything not implemented.

### Risks

Mention any remaining technical concern.

Do not claim something was tested if it was not actually tested.

---

# 48. No False Completion Claims

Anti must distinguish between:

```text
Implemented
Tested
Partially tested
Not tested
Known limitation
```

Do not report:

```text
Everything works perfectly
```

without evidence.

---

# 49. Stop Conditions

Anti should stop and reassess when:

- A change requires breaking a core architecture rule.
- A feature requires unsafe access to user files.
- Playback becomes unstable.
- Memory usage becomes uncontrolled.
- A database migration could destroy data.
- A dependency introduces an unacceptable security risk.
- A requested feature conflicts with the project's privacy model.
- A new implementation requires unexplained duplication.

Do not continue blindly.

---

# 50. Recovery From Failed Implementation

If an implementation causes a regression:

```text
Identify regression
        ↓
Determine affected subsystem
        ↓
Restore stable behavior
        ↓
Identify root cause
        ↓
Implement smaller correction
        ↓
Verify again
```

Do not stack additional patches on top of an unstable implementation without understanding the cause.

---

# 51. Final Implementation Sequence

The complete recommended sequence is:

```text
01. Project Foundation
02. Architecture
03. Database
04. Repository Layer
05. Filesystem Permissions
06. Music Scanner
07. Format Detection
08. Metadata Parser
09. Artwork System
10. Audio Engine
11. Playback Manager
12. Queue
13. Playback History
14. Library Screens
15. Mini Player
16. Now Playing
17. Favorites
18. Playlists
19. Search
20. Folder Browser
21. Format Explorer
22. Audio Information
23. Lyrics
24. Equalizer / DSP
25. ReplayGain
26. Crossfade / Gapless
27. Playback Speed
28. Sleep Timer
29. Visualizer
30. Audio Galaxy
31. Performance Hardening
32. Privacy Hardening
33. Security Hardening
34. Accessibility
35. Responsive Polish
36. Regression Testing
37. Release Validation
```

---

# 52. Final Release Gate

Before release, Anti should verify the following categories.

## Core

```text
Application starts
Database initializes
Library loads
Playback works
```

## Library

```text
Scanning works
Metadata works
Artwork works
Search works
Folders work
Formats are reported correctly
```

## Playback

```text
Play
Pause
Seek
Next
Previous
Queue
Shuffle
Repeat
History
Resume
```

## Organization

```text
Favorites
Playlists
Recently Added
Recently Played
```

## Advanced Audio

```text
Lyrics
Equalizer
DSP
ReplayGain
Crossfade
Gapless
Playback speed
Sleep timer
```

## Visual

```text
Dynamic artwork
Visualizer
Audio Galaxy
```

## Engineering

```text
Performance
Privacy
Security
Accessibility
Error recovery
Database integrity
```

---

# 53. Release Must Not Contain

The production application must not contain:

- Fake data
- Fake functionality
- Placeholder buttons presented as finished features
- Debug-only UI
- Accidental development credentials
- Secrets
- Unnecessary telemetry
- Advertising SDKs
- Unnecessary network dependencies
- Unhandled critical errors
- Unprotected destructive operations
- Silent source-file modification

---

# 54. Final Product Definition

The implementation is successful when the application provides:

```text
A premium
        +
original
        +
ad-free
        +
local-first
        +
privacy-focused
        +
high-performance
        +
accessible
        +
stable
        +
feature-rich
        +
personal
music experience
```

The user should be able to install the application, point it toward their music collection, and immediately begin building a personal music universe without requiring an online account.

---

# 55. Final Architecture Reminder

The complete system should converge toward:

```text
                         USER
                          │
                          ▼
                 ┌─────────────────┐
                 │   APPLICATION   │
                 │      UI         │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │   APPLICATION   │
                 │    SERVICES     │
                 └───────┬─────────┘
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
        LIBRARY      PLAYBACK      SEARCH
             │           │           │
             ▼           ▼           ▼
        DATABASE    AUDIO ENGINE   INDEX
             │           │
             ▼           ▼
       FILESYSTEM     AUDIO OUTPUT
             │
             ▼
       MUSIC COLLECTION

             Additional Systems
             ──────────────────
             Artwork
             Lyrics
             Playlists
             Favorites
             History
             DSP
             Visualizer
             Audio Galaxy
             Cache
             Statistics
```

All systems must communicate through clear boundaries.

---

# 56. Final Development Principle

The Music Player App should not be developed as a collection of disconnected screens.

It should be developed as one coherent audio system.

```text
Real Music Files
       ↓
Reliable Library
       ↓
Reliable Audio Engine
       ↓
Reliable Playback
       ↓
Beautiful User Experience
       ↓
Powerful Organization
       ↓
Immersive Visualization
       ↓
Audio Galaxy
```

Every layer must strengthen the layer below it.

The application should remain useful even if advanced layers are disabled.

---

# 57. FINAL ANTI DIRECTIVE

Anti must use this roadmap together with all previous project documents.

The implementation order may be adjusted when technical constraints require it, but the following principles must remain unchanged:

```text
1. Audio reliability comes first.

2. User-owned data must be protected.

3. The application is local-first.

4. The application is ad-free.

5. Privacy is the default.

6. The UI must not own low-level systems.

7. There must be one authoritative playback engine.

8. Heavy work must not block the UI.

9. Visual features must never compromise playback.

10. Large libraries must remain usable.

11. Real data must drive the application.

12. No fake functionality.

13. No silent source-file modification.

14. Security must be designed into the system.

15. Accessibility must be part of implementation.

16. Performance must be measured rather than assumed.

17. Features must be implemented incrementally.

18. Existing working functionality must be protected.

19. The visual design must remain original.

20. The final application must feel like one coherent premium music product.
```

---

# 58. Documentation Package Completion

The original core project specification package is now complete.

```text
00_PROJECT_MASTER_SPEC.md
01_PRODUCT_REQUIREMENTS.md
02_SYSTEM_ARCHITECTURE.md
03_AUDIO_ENGINE_ARCHITECTURE.md
04_MUSIC_LIBRARY_ARCHITECTURE.md
05_UI_UX_DESIGN_SYSTEM.md
06_SCREEN_ARCHITECTURE.md
07_NOW_PLAYING_PLAYER_SPEC.md
08_AUDIO_GALAXY_SPEC.md
09_AUDIO_FORMAT_SUPPORT.md
10_FEATURE_SPECIFICATION.md
11_DATA_DATABASE_SCHEMA.md
12_PERFORMANCE_PRIVACY_SECURITY.md
13_DEVELOPMENT_RULES.md
14_IMPLEMENTATION_ROADMAP.md
```

These documents together define the product vision, requirements, architecture, audio system, library, design system, screens, player, Audio Galaxy, formats, features, database, performance, privacy, security, development rules, and implementation roadmap.

**Anti should treat these documents as the primary project specification and implementation reference.**

06_SCREEN_ARCHITECTURE.md
07_NOW_PLAYING_PLAYER_SPEC.md
08_AUDIO_GALAXY_SPEC.md
09_AUDIO_FORMAT_SUPPORT.md
10_FEATURE_SPECIFICATION.md
11_DATA_DATABASE_SCHEMA.md
12_PERFORMANCE_PRIVACY_SECURITY.md
13_DEVELOPMENT_RULES.md
14_IMPLEMENTATION_ROADMAP.md

```

These documents together define the product vision, requirements, architecture, audio system, library, design system, screens, player, Audio Galaxy, formats, features, database, performance, privacy, security, development rules, and implementation roadmap.

**Anti should treat these documents as the primary project specification and implementation reference.**
```
