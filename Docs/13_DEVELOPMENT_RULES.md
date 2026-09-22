# 13 — DEVELOPMENT RULES

## 1. Document Purpose

This document defines the mandatory development rules for the Music Player App.

These rules exist to ensure that implementation remains:

- Stable
- Maintainable
- Modular
- Performant
- Privacy-focused
- Secure
- Accessible
- Original
- Consistent with the project architecture
- Safe for large music libraries
- Reliable for continuous audio playback

These rules apply to all implementation work unless a higher-priority project specification explicitly overrides them.

---

# 2. Primary Development Principle

The application is an **audio-first, local-first music system**.

Every implementation decision should protect this priority:

```text
Audio reliability
        ↓
User interaction
        ↓
Data integrity
        ↓
Library functionality
        ↓
Background processing
        ↓
Visual effects
        ↓
Non-essential features
```

Never reverse this priority for cosmetic reasons.

---

# 3. Follow the Existing Architecture

Before implementing a feature, determine which architectural layer owns it.

The primary architecture is:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Data / Infrastructure
     ↓
Platform Services
```

The audio subsystem operates as a specialized subsystem with its own boundaries.

Do not bypass these boundaries simply because a direct implementation appears faster.

---

# 4. UI Must Not Own Business Logic

UI components should primarily handle:

- Display
- User interaction
- Navigation
- Visual state
- Accessibility
- User feedback

UI components should not directly own:

- Database logic
- Filesystem scanning
- Audio decoding
- DSP processing
- Search algorithms
- Playlist persistence
- Library indexing
- Audio Galaxy data generation

Instead:

```text
UI
 ↓
Application Service
 ↓
Domain Logic
 ↓
Repository / Engine / Infrastructure
```

---

# 5. UI Must Not Directly Control the Audio Engine

The UI must not become the authoritative playback controller.

The playback architecture must have one authoritative audio engine.

The UI communicates through playback/application interfaces.

Example:

```text
Play Button
   ↓
Playback Application Service
   ↓
Playback Manager
   ↓
Audio Engine
```

Do not create separate playback implementations inside individual screens.

---

# 6. One Authoritative Playback State

There must be one authoritative source for:

- Current track
- Playback state
- Current position
- Duration
- Queue
- Shuffle state
- Repeat state
- Volume
- Playback speed
- Current output state

Different screens must consume the same state.

For example:

```text
Now Playing
Mini Player
Lock Screen Controls
Queue
Notification
```

must not maintain separate independent playback states.

---

# 7. Do Not Duplicate Business Logic

Business rules should have one authoritative implementation.

Do not independently implement:

- Favorite logic in multiple screens
- Queue logic in multiple components
- Playlist rules in multiple places
- Search normalization in multiple systems
- Metadata normalization in multiple services
- Playback history rules in multiple screens

Use shared domain/application services.

---

# 8. Database Boundary

The database is the authoritative source for indexed library information.

UI components must not directly execute arbitrary database queries.

Preferred flow:

```text
UI
 ↓
Application Service
 ↓
Repository
 ↓
Database
```

This provides:

- Consistency
- Testability
- Security
- Easier migrations
- Easier optimization

---

# 9. Filesystem Boundary

Filesystem access must remain inside appropriate infrastructure services.

UI should never directly scan directories.

Preferred architecture:

```text
UI
 ↓
Scan Service
 ↓
Filesystem Adapter
 ↓
Scanner
 ↓
Metadata / Artwork Processing
 ↓
Repository
 ↓
Database
```

---

# 10. Original Music Files Are Protected

Normal application operations must never silently modify original music files.

Default operations are:

```text
READ
ANALYZE
INDEX
CACHE
PLAY
```

Not:

```text
MODIFY
OVERWRITE
DELETE
```

Any future destructive feature requires explicit user confirmation.

---

# 11. Do Not Add Fake Functionality

Never create buttons that appear functional but do nothing.

Do not implement:

- Fake scanning progress
- Fake audio information
- Fake equalizer values
- Fake lyrics
- Fake Audio Galaxy relationships
- Fake format support
- Fake performance statistics
- Fake library counts

If functionality is not implemented, clearly represent its unavailable state.

---

# 12. No Hardcoded Fake Data in Production

Hardcoded demo content must not appear as real user data.

Examples of prohibited behavior:

```text
"128 Songs"
"24 Albums"
"12 Artists"
```

when those values are not actually calculated from the user's library.

Demo data may exist only in:

- Development environments
- Automated tests
- Explicit demo mode

It must never be confused with real user data.

---

# 13. Real Data Must Drive the UI

The application UI should be generated from real application state.

Examples:

```text
Song count
→ Database

Album artwork
→ Artwork service/cache

Favorite status
→ Favorite repository

Queue
→ Playback manager

Audio Galaxy
→ Real library relationships

Format information
→ Actual file analysis
```

---

# 14. Performance Before Cosmetic Complexity

When deciding between:

```text
Beautiful but expensive
```

and:

```text
Beautiful and efficient
```

implement the second.

Avoid adding visual complexity that produces:

- Excessive CPU usage
- Excessive GPU usage
- Memory pressure
- Frame drops
- Audio interruptions
- Slow navigation

---

# 15. Playback Must Never Depend on Visual Features

The following features are optional layers:

- Visualizer
- Audio Galaxy animation
- Dynamic artwork effects
- Particles
- Background animation
- Advanced blur
- Decorative transitions

They must not be required for playback.

If these systems fail:

```text
Playback continues.
```

---

# 16. Real-Time Audio Rule

Never put unpredictable operations inside the real-time audio path.

Avoid:

- Database calls
- Filesystem access
- Network access
- Large allocations
- Long locks
- Complex logging
- UI updates
- Expensive metadata processing

Real-time audio code must remain deterministic and resource-aware.

---

# 17. Heavy Work Must Leave the UI Thread

The following operations should not block the UI:

- Library scanning
- Metadata parsing
- Artwork extraction
- Search indexing
- Audio analysis
- Large database operations
- Audio Galaxy preparation
- Cache rebuilding
- Large imports

Use background workers, asynchronous tasks, or platform-appropriate scheduling.

---

# 18. Cancellation Is Required

Long-running operations should support cancellation where practical.

Examples:

```text
Scanning
Artwork processing
Search indexing
Galaxy generation
Cache rebuild
Large import
```

When cancelled:

- Stop unnecessary work.
- Release resources.
- Preserve already-valid data.
- Leave the database consistent.
- Update the UI with the correct state.

---

# 19. Avoid Uncontrolled Concurrency

Do not create unlimited workers.

Avoid patterns where every file starts its own unrestricted processing task.

Instead:

```text
Task Queue
    ↓
Controlled Workers
    ↓
Resource-Aware Processing
```

Concurrency must account for:

- CPU
- Memory
- Disk
- Database
- Battery

---

# 20. Use Event-Driven Architecture

Prefer events over continuous polling.

Examples:

```text
Track changed
Playback state changed
Scan completed
File discovered
Favorite changed
Playlist changed
Device connected
Device disconnected
```

Avoid unnecessary loops such as:

```text
Check every 100 ms
Check every 500 ms
Check every second
```

unless technically required.

---

# 21. State Must Be Explicit

Important application states should be represented explicitly.

For example:

```text
Loading
Ready
Playing
Paused
Scanning
Processing
Error
Empty
Unavailable
Unsupported
Cancelled
```

Avoid relying on ambiguous combinations of booleans when a clear state model is more appropriate.

---

# 22. Error Handling Rule

Every subsystem must define what happens when it fails.

Do not use:

```text
try
    something
catch
    ignore
```

without a deliberate reason.

Errors should be:

- Classified
- Logged appropriately
- Presented when relevant
- Recoverable where possible
- Isolated from unrelated systems

---

# 23. Failure Isolation

A failure in one subsystem must not unnecessarily destroy the entire application.

Examples:

```text
Artwork failure
→ Track remains playable

Lyrics failure
→ Playback continues

Visualizer failure
→ Now Playing remains usable

Galaxy failure
→ Library remains usable

One corrupt audio file
→ Other tracks remain usable
```

---

# 24. Do Not Hide Errors

Errors should not be silently swallowed when they affect user functionality.

Instead provide useful states such as:

```text
Unable to read this file.
This format is not currently supported.
Artwork could not be extracted.
The file is no longer available.
```

Messages should be understandable and actionable.

---

# 25. User-Friendly Error Messages

Do not expose raw technical exceptions directly to users.

Avoid:

```text
NullPointerException
DecoderError: 0x0000FF12
SQLITE_BUSY
```

Instead provide meaningful user-facing explanations.

Technical details belong in diagnostics.

---

# 26. Logging Rules

Logs should be structured and useful.

Recommended categories:

```text
APP
PLAYBACK
AUDIO
DATABASE
SCANNER
METADATA
ARTWORK
SEARCH
PLAYLIST
GALAXY
VISUALIZER
SECURITY
PERFORMANCE
```

Use appropriate severity levels.

Do not flood logs with repeated messages during normal operation.

---

# 27. Never Log Secrets

Never log:

- Passwords
- Tokens
- API keys
- Authentication credentials
- Private network credentials
- Sensitive personal information

Do not print secrets for debugging.

---

# 28. Protect User Privacy

The application must remain privacy-first.

Do not introduce:

- Hidden tracking
- Unnecessary analytics
- Automatic cloud synchronization
- Unnecessary network calls
- Advertising identifiers
- Unnecessary user accounts

Core music functionality must remain local.

---

# 29. No Advertising

The application is explicitly ad-free.

Do not add:

- Banner advertisements
- Interstitial advertisements
- Sponsored cards
- Promotional popups
- Advertising SDKs
- Tracking-based advertising

The UI should never reserve space for advertising.

---

# 30. No Forced Account

The core application should not require an account.

A user should be able to:

```text
Install
 ↓
Grant local permissions
 ↓
Select music
 ↓
Scan
 ↓
Play
```

without creating an online account.

---

# 31. Network Is Optional

The core application must work without internet access.

Never make local playback dependent on:

- Online metadata
- Online lyrics
- Cloud authentication
- Remote API availability

Future online features must be isolated and optional.

---

# 32. Permissions Must Be Minimal

Request only permissions necessary for actual functionality.

Do not request broad permissions merely because they may be useful later.

Permission requests should occur at the appropriate moment and should explain why access is required.

---

# 33. Secure File Handling

All imported files must be treated as untrusted input.

Validate:

- File paths
- File types
- File sizes
- Metadata
- Artwork
- Directory traversal
- Special filesystem objects

Never assume that a filename or metadata field is safe.

---

# 34. Metadata Is Data, Not Code

Metadata must never automatically become executable content.

Safely handle:

- Titles
- Artist names
- Album names
- Comments
- Lyrics
- Genre
- Composer
- Embedded artwork
- Custom tags

Special characters and unexpected content must be handled safely.

---

# 35. Database Rules

Database operations must:

- Use repositories
- Use transactions when required
- Respect schema versions
- Handle errors
- Avoid unnecessary queries
- Use appropriate indexes
- Support migrations
- Preserve consistency

Do not bypass repository boundaries simply for convenience.

---

# 36. Database Migration Rules

Every schema change must have a migration strategy.

Before modifying the schema:

1. Identify the current version.
2. Define the new version.
3. Define migration steps.
4. Preserve user data.
5. Handle migration failure.
6. Validate the resulting schema.

Never silently reset the user's database because a migration failed.

---

# 37. Search Architecture Rule

Search should use a centralized search implementation.

Do not create independent search algorithms for:

- Songs
- Albums
- Artists
- Playlists
- Folders
- Galaxy

Search normalization should be consistent.

---

# 38. Playlist Rules

Playlist operations must go through the playlist domain/application layer.

Playlist UI should not directly manipulate database rows.

Operations include:

- Create
- Rename
- Delete
- Add track
- Remove track
- Reorder
- Play
- Shuffle
- Duplicate handling

All must follow one consistent implementation.

---

# 39. Favorite Rules

Favorite state must have one source of truth.

A track's favorite status must remain synchronized across:

- Library
- Now Playing
- Search
- Album pages
- Artist pages
- Playlists
- Audio Galaxy

Do not duplicate favorite state independently inside components.

---

# 40. Queue Rules

The queue belongs to the playback system.

Screens may display or modify the queue through application-level commands.

The queue must not be independently recreated by each screen.

---

# 41. Playback History Rules

History should be updated according to defined playback rules rather than every UI interaction.

For example:

```text
Opening a track
≠
Successfully listening to a track
```

The exact history threshold should be defined by the playback domain.

History updates should not cause unnecessary database writes.

---

# 42. Audio Format Rules

Never display a format as supported merely because its file extension is recognized.

Correct flow:

```text
Extension
 ↓
Container detection
 ↓
Codec detection
 ↓
Backend capability
 ↓
Actual support state
```

The application must report limitations honestly.

---

# 43. No Fake Format Support

If a format is unsupported:

```text
Unsupported
```

must remain an honest state.

Do not rename files, change extensions, or pretend that a file can be played.

---

# 44. Audio Quality Rules

Do not make claims such as:

```text
Studio Quality
Perfect Audio
Lossless Playback
Bit-Perfect
```

unless the actual pipeline supports the claim.

Audio information must reflect real detected properties.

---

# 45. Equalizer Rules

The equalizer must operate through the audio processing layer.

UI controls must not implement DSP logic themselves.

The UI should send parameter changes to the DSP system.

DSP must remain stable during playback.

---

# 46. Visualizer Rules

Visualizers should consume prepared audio analysis data.

They must not independently decode the audio file.

Preferred flow:

```text
Audio Engine
      ↓
Analysis Data
      ↓
Visualizer
```

not:

```text
Visualizer
      ↓
Decode Audio Again
```

---

# 47. Audio Galaxy Rules

Audio Galaxy must represent real relationships.

Never create random visual connections merely to make the graph appear interesting.

Relationships must originate from real data such as:

- Artist
- Album
- Genre
- Playlist
- Folder
- Track

Future relationships must also be based on actual data or clearly labeled derived analysis.

---

# 48. Audio Galaxy Must Remain Optional

The user must be able to use the entire music player without opening Audio Galaxy.

Galaxy must not become a mandatory startup process.

It should load when needed.

---

# 49. Artwork Rules

Artwork should be treated as an independent resource.

If artwork is unavailable:

```text
Track remains playable.
```

Use appropriate fallback artwork or placeholders.

Do not block playback because artwork failed.

---

# 50. UI Design Rules

The design must remain:

- Original
- Premium
- Cinematic
- Music-focused
- Ad-free
- Accessible
- Responsive

The design may be conceptually inspired by modern premium music players, including Muso-like qualities, but must **not copy Muso's exact UI, branding, assets, or pixel-level layout**.

---

# 51. Originality Rule

Do not reproduce another application's:

- Logo
- Brand identity
- Exact layout
- Exact component arrangement
- Exact artwork
- Exact icons
- Exact navigation structure
- Exact animations
- Exact visual assets

Use inspiration only at the conceptual level.

The Music Player App must have its own visual identity.

---

# 52. Audio Galaxy as Signature Design

Audio Galaxy should remain one of the application's defining experiences.

However:

```text
Unique ≠ complicated
```

The Galaxy should prioritize:

- Meaningful relationships
- Clear navigation
- Visual hierarchy
- Smooth exploration
- Real music data
- Performance

Avoid unnecessary graphical complexity.

---

# 53. Responsive Design Rules

The application must adapt to:

- Desktop
- Laptop
- Tablet
- Mobile-sized layouts where applicable
- Different screen resolutions
- Different window sizes

Do not assume one fixed viewport.

---

# 54. Accessibility Rules

All interactive controls must be accessible.

Consider:

- Keyboard navigation
- Focus states
- Screen readers
- Contrast
- Text scaling
- Reduced motion
- Touch target sizes
- Clear labels
- Semantic structure

Accessibility must be considered during implementation, not added at the end.

---

# 55. Reduced Motion

When reduced-motion preferences are enabled:

- Reduce decorative animation.
- Reduce graph movement.
- Reduce particle effects.
- Reduce transitions.
- Avoid unnecessary continuous motion.

Core functionality must remain unchanged.

---

# 56. Responsive State Rules

Do not create separate business logic for desktop and mobile.

Instead:

```text
Shared Application Logic
        ↓
Responsive Presentation
```

Different layouts may exist, but business behavior should remain consistent.

---

# 57. Component Rules

Components should have clear responsibilities.

Avoid extremely large components containing:

- UI
- Database logic
- Audio logic
- Search logic
- Scanning logic
- Navigation
- State management

Large components should be decomposed when responsibilities become unclear.

---

# 58. Service Rules

Services should have focused responsibilities.

Avoid one giant service such as:

```text
EverythingService
```

Prefer focused services such as:

```text
PlaybackService
LibraryService
PlaylistService
SearchService
ArtworkService
LyricsService
ScanService
GalaxyService
```

---

# 59. Naming Rules

Use clear and consistent names.

Names should describe responsibility rather than implementation detail.

Prefer:

```text
PlaybackManager
LibraryRepository
ArtworkService
ScanManager
GalaxyEngine
```

over vague names such as:

```text
Helper
Manager2
Utils
Thing
DataService
```

unless the responsibility is genuinely broad.

---

# 60. Avoid God Objects

Do not create one class/module that controls everything.

A system such as:

```text
MusicPlayerManager
```

should not contain:

- Database
- Filesystem
- Playback
- Search
- UI
- Playlists
- Galaxy
- Artwork
- Settings

Break responsibilities into clear modules.

---

# 61. Dependency Direction

Dependencies should flow toward stable abstractions.

For example:

```text
UI
 ↓
Application
 ↓
Domain
 ↓
Infrastructure
```

Infrastructure should not randomly import UI components.

Database code should not depend on visual components.

Audio engine code should not depend on screen components.

---

# 62. Avoid Circular Dependencies

Do not create dependency cycles such as:

```text
Player → Library
Library → Player
Player → UI
UI → Player
```

Use events, interfaces, or application-level coordination where appropriate.

---

# 63. Configuration Rules

Configuration should be centralized.

Avoid scattering magic values throughout the codebase.

Examples:

- Cache limits
- Supported extensions
- Default playback settings
- Animation settings
- Scan settings
- Search settings
- Performance thresholds

Configuration should be easy to locate and understand.

---

# 64. No Magic Numbers

Avoid unexplained values.

Instead of:

```text
timeout = 437
```

use a clearly named configuration concept.

Values should have a reason and, where relevant, documentation.

---

# 65. Caching Rules

Cache only when caching provides measurable value.

Every cache should define:

- Purpose
- Key
- Storage
- Maximum size
- Expiration or invalidation strategy
- Rebuild strategy

Never treat cache data as the authoritative source of user data.

---

# 66. Cache Failure

If a cache becomes corrupted:

```text
Invalidate
 ↓
Delete/rebuild cache
 ↓
Continue using authoritative data
```

The application should not become unusable because a cache was damaged.

---

# 67. Testing During Development

Each important subsystem should have tests.

Priorities include:

- Audio engine
- Playback state
- Queue
- Database
- Scanner
- Metadata
- Artwork
- Search
- Playlist
- Favorites
- Audio Galaxy
- Format detection
- Error handling
- Security boundaries

---

# 68. Do Not Optimize Without Evidence

Before optimization:

```text
Observe
 ↓
Measure
 ↓
Identify bottleneck
 ↓
Change
 ↓
Measure again
```

Do not rewrite stable systems simply because a different implementation appears theoretically faster.

---

# 69. Performance Regression Protection

When a performance-critical subsystem changes, verify that the change does not introduce regressions in:

- Playback
- Startup
- Search
- Scanning
- Memory
- Database operations
- Visualizer performance
- Galaxy rendering

Measured results should be distinguished from assumptions.

---

# 70. Do Not Break Existing Features for New Features

When implementing a new feature:

1. Understand existing behavior.
2. Identify dependencies.
3. Implement within the correct boundary.
4. Verify existing functionality.
5. Verify the new functionality.

A new feature is not complete if it breaks existing core behavior.

---

# 71. Incremental Implementation

Do not implement the entire application as one enormous change.

Prefer:

```text
Architecture
 ↓
Core infrastructure
 ↓
Database
 ↓
Library
 ↓
Playback
 ↓
UI
 ↓
Advanced features
```

Each stage should remain understandable and testable.

---

# 72. Build in Vertical Slices

Where practical, complete usable flows.

Example:

```text
Scan music
 ↓
Store track
 ↓
Display track
 ↓
Play track
```

before building dozens of disconnected screens.

---

# 73. Feature Completion Rule

A feature is not complete merely because its UI exists.

A complete feature requires:

```text
UI
+
Application Logic
+
Domain Logic
+
Persistence where required
+
Error Handling
+
Accessibility
+
Performance Consideration
+
Real Data
```

---

# 74. Empty States

Every major screen must define an empty state.

Examples:

```text
No songs
No albums
No playlists
No favorites
No search results
No lyrics
No supported files
No Galaxy relationships
```

Empty states should explain what the user can do next.

---

# 75. Loading States

Long-running operations require clear loading states.

Do not freeze the UI.

Examples:

```text
Scanning music…
Loading library…
Preparing Galaxy…
Loading artwork…
Analyzing audio…
```

Progress should be shown where meaningful.

---

# 76. Error States

Error states should include:

- What happened
- What remains usable
- What the user can do next

Avoid generic:

```text
Something went wrong.
```

when a more useful explanation is possible.

---

# 77. No Destructive Action Without Confirmation

Potentially destructive operations must require explicit user intent.

Examples:

- Delete playlist
- Remove library root
- Clear history
- Clear cache
- Modify original metadata
- Delete source files, if such a future feature exists

The confirmation should clearly describe the consequence.

---

# 78. User Control

The user should remain in control of:

- Playback
- Queue
- Playlists
- Favorites
- Library roots
- Scanning
- Cache cleanup
- Privacy
- Optional online features
- Visual preferences

Avoid unexpected automation that changes user-owned data.

---

# 79. Preserve User Intent

If the user explicitly starts:

- Playback
- Scan
- Search
- Import
- Playlist action

the application should respect that operation unless safety or system limitations require cancellation.

Do not unexpectedly restart operations.

---

# 80. Avoid Duplicate Actions

Rapid repeated interactions should not create duplicate operations.

Examples:

```text
Play clicked repeatedly
Scan clicked repeatedly
Favorite clicked repeatedly
Retry clicked repeatedly
Add to playlist clicked repeatedly
```

Use appropriate state guards, command coalescing, or debouncing where necessary.

---

# 81. Navigation Rules

Navigation should remain predictable.

Back navigation should return to the logical previous context.

Opening a track from:

```text
Search
Album
Artist
Playlist
Galaxy
Folder
```

should not destroy the user's navigation context.

---

# 82. Deep Linking

If the platform supports deep links or internal navigation targets, they should resolve to real application state.

Do not create links to screens that cannot actually display the requested content.

---

# 83. Search Result Consistency

Search results must correspond to actual indexed data.

Do not show stale entries after deletion or movement unless the UI is explicitly refreshing.

Search indexes must eventually synchronize with the database.

---

# 84. File Changes

When files are:

- Added
- Removed
- Moved
- Renamed
- Modified

the library must eventually reflect those changes.

The original source files remain authoritative.

---

# 85. Duplicate Handling

Do not silently delete duplicate files.

Duplicates should be detected and represented according to the library rules.

User-owned files must remain untouched unless the user explicitly performs a destructive action.

---

# 86. Unsupported Files

Unsupported files should not be treated as application failures.

The library may record:

```text
Detected
Unsupported
```

and provide appropriate filtering or information.

---

# 87. Corrupt Files

Corrupt files should be isolated.

The application should:

```text
Detect
 ↓
Record failure
 ↓
Inform user where useful
 ↓
Continue processing other files
```

---

# 88. Future Features Must Respect Current Architecture

Future additions such as:

- Metadata editor
- Smart playlists
- Online lyrics
- Cloud synchronization
- Music discovery
- Statistics
- Import/export

must integrate through existing architectural boundaries.

Do not redesign the core architecture unnecessarily for speculative features.

---

# 89. Documentation Rule

Important architectural decisions should be documented.

Documentation should explain:

- Why the decision exists
- Which subsystem owns it
- What constraints apply
- What must not be changed casually

Do not rely entirely on tribal knowledge.

---

# 90. Code Quality Rule

Code should favor:

- Readability
- Predictability
- Small responsibilities
- Explicit state
- Testability
- Maintainability

Avoid clever code that is difficult to understand merely for brevity.

---

# 91. Simplicity Rule

Do not introduce a complex abstraction unless it solves a real problem.

Prefer:

```text
Simple
Clear
Modular
Testable
```

over:

```text
Over-engineered
Highly abstract
Difficult to debug
```

---

# 92. Dependency Rules

Third-party dependencies should be evaluated before adoption.

Consider:

- Maintenance
- License
- Security
- Performance
- Platform compatibility
- Bundle size
- Offline behavior
- Community health
- Whether the dependency is actually necessary

Do not add a dependency for a problem that can be safely solved with existing platform capabilities.

---

# 93. Dependency Locking

Production builds should use controlled dependency versions.

Unexpected dependency upgrades must not silently change core behavior.

Major dependency updates should be evaluated and tested.

---

# 94. Security Updates

Security-sensitive dependencies must not be intentionally kept outdated without a documented reason.

When security issues are identified:

```text
Identify
 ↓
Evaluate impact
 ↓
Patch/update
 ↓
Test
 ↓
Document
```

---

# 95. No Unnecessary Refactoring

Do not refactor stable code merely for aesthetic reasons during unrelated feature work.

Unrelated refactoring increases regression risk.

If a refactor is required for a feature, keep the scope controlled.

---

# 96. Preserve Working Functionality

Before changing an existing subsystem:

- Understand its current contract.
- Identify its consumers.
- Identify its tests.
- Identify performance implications.
- Identify failure behavior.

Do not assume unused-looking code is safe to remove without verifying its role.

---

# 97. Remove Dead Code Carefully

Dead code may be removed when confirmed unused.

However, do not remove:

- Required platform integrations
- Migration code still needed for supported versions
- Error recovery paths
- Feature flags still in use
- Compatibility code without verification

---

# 98. Environment Awareness

Do not assume all devices have:

- The same CPU
- The same GPU
- The same memory
- The same filesystem
- The same audio devices
- The same codecs
- The same OS behavior

Use capability detection where appropriate.

---

# 99. Platform Abstraction

Platform-specific behavior should be isolated.

Examples:

```text
Audio Output Adapter
Filesystem Adapter
Media Session Adapter
Permission Adapter
Notification Adapter
Device Event Adapter
```

Core application logic should not be filled with platform-specific branches.

---

# 100. Development Priority

When implementing the project, use this order:

```text
1. Core architecture
2. Local database
3. Filesystem scanning
4. Metadata/indexing
5. Audio engine
6. Basic library UI
7. Playback UI
8. Queue/playlists/favorites
9. Search
10. Lyrics/audio information
11. Equalizer/DSP
12. Visualizer
13. Audio Galaxy
14. Advanced polish
```

Do not begin with decorative effects before the core system works.

---

# 101. Definition of Done

A feature is considered done only when:

- It works with real data.
- It follows the architecture.
- It handles failure states.
- It does not break playback.
- It does not introduce unnecessary privacy risks.
- It does not create uncontrolled resource usage.
- It is accessible.
- It works across supported layouts.
- It has appropriate tests.
- It has appropriate loading and empty states.
- It does not contain fake functionality.
- It does not silently modify user-owned files.

---

# 102. Anti Implementation Workflow

When Anti receives a feature request, it should follow this process:

```text
1. Understand the requested behavior
        ↓
2. Identify the responsible subsystem
        ↓
3. Read relevant project specifications
        ↓
4. Inspect existing implementation
        ↓
5. Identify dependencies and risks
        ↓
6. Plan the smallest correct change
        ↓
7. Implement within architectural boundaries
        ↓
8. Handle loading/error/empty states
        ↓
9. Verify existing behavior
        ↓
10. Verify the new behavior
        ↓
11. Check performance/privacy/security impact
        ↓
12. Report exactly what changed
```

---

# 103. Anti Must Not Guess

If an implementation detail is ambiguous, Anti should inspect the project specifications and existing architecture before making assumptions.

Do not invent:

- APIs
- Database fields
- Playback states
- File formats
- UI behavior
- Security policies
- Feature dependencies

When information is genuinely missing, choose the smallest architecture-compatible solution and document the assumption.

---

# 104. Anti Must Not Silently Change Requirements

Do not silently alter:

- Product behavior
- Design principles
- Architecture
- Database ownership
- Playback behavior
- Privacy rules
- Feature priorities

If a technical limitation requires a change, clearly identify the limitation and the proposed alternative.

---

# 105. Anti Must Not Overwrite Existing Work Blindly

Before replacing an existing implementation:

1. Inspect it.
2. Understand its purpose.
3. Identify dependencies.
4. Determine whether the change is actually required.
5. Preserve valid functionality.

Never perform broad destructive rewrites without justification.

---

# 106. Anti Must Prefer Minimal Safe Changes

When fixing a bug:

```text
Identify root cause
 ↓
Change the smallest responsible area
 ↓
Preserve existing contracts
 ↓
Verify the fix
```

Avoid rewriting unrelated systems.

---

# 107. Anti Must Respect Feature Boundaries

Examples:

```text
Playback problem
→ Investigate playback subsystem.

Search problem
→ Investigate search subsystem.

Artwork problem
→ Investigate artwork subsystem.

Galaxy problem
→ Investigate Galaxy subsystem.
```

Do not modify unrelated systems simply because they are nearby in the codebase.

---

# 108. Anti Must Preserve Privacy

Before adding any external service or telemetry:

- Determine whether it is actually required.
- Determine what data leaves the device.
- Determine whether the feature can work locally.
- Determine whether the user must explicitly opt in.

Local processing should be preferred when technically practical.

---

# 109. Anti Must Preserve Performance

Before adding expensive processing, consider:

- CPU cost
- Memory cost
- GPU cost
- Disk cost
- Battery cost
- Startup cost
- Playback impact

If a feature is expensive, it should be:

- Lazy
- Optional
- Backgrounded
- Cached
- Throttled
- Resource-aware

where appropriate.

---

# 110. Anti Must Preserve Audio Reliability

Any change touching:

- Audio engine
- Decoder
- DSP
- Output
- Buffering
- Queue
- Playback state

requires special caution.

Playback must remain stable before visual or convenience improvements are considered complete.

---

# 111. Anti Must Preserve Original Design

Do not replace the established visual direction with a generic music-player template.

The product must retain:

- Premium cinematic identity
- Original design language
- Audio Galaxy identity
- Dynamic artwork atmosphere
- Clean music-first navigation
- Ad-free experience

Do not turn the application into a clone of another music player.

---

# 112. Anti Must Avoid Scope Creep

Do not automatically add unrelated features because they appear useful.

Example:

User requests:

```text
Add search filtering.
```

Do not automatically implement:

```text
Cloud sync
Social sharing
Online recommendations
Account system
AI music generation
```

Implement the requested scope first.

---

# 113. Anti Must Keep User Data Safe

Never:

- Delete music automatically
- Rewrite music files automatically
- Reset the database unnecessarily
- Clear playlists unexpectedly
- Clear favorites unexpectedly
- Clear history unexpectedly
- Replace user artwork without consent

User-owned data receives the highest protection.

---

# 114. Final Development Golden Rules

```text
RULE 1:
Follow the architecture.

RULE 2:
One authoritative playback engine.

RULE 3:
UI does not own business logic.

RULE 4:
UI does not directly access the database or filesystem.

RULE 5:
Playback always has priority.

RULE 6:
Never block the real-time audio path.

RULE 7:
Heavy work belongs outside the UI thread.

RULE 8:
Use real data, never fake production functionality.

RULE 9:
Do not silently modify user-owned files.

RULE 10:
Protect privacy by default.

RULE 11:
Do not add advertising or forced accounts.

RULE 12:
Treat imported files as untrusted input.

RULE 13:
Isolate subsystem failures.

RULE 14:
Optimize using measurements, not assumptions.

RULE 15:
Prefer simple, maintainable architecture.

RULE 16:
Avoid unnecessary dependencies.

RULE 17:
Respect accessibility.

RULE 18:
Keep the visual design original.

RULE 19:
Do not introduce scope creep.

RULE 20:
When uncertain, inspect the existing architecture before changing it.
```

---

# 115. Final Anti Directive

Anti must treat all project specification documents as a connected system.

The documents should not be interpreted independently when implementing a feature.

The implementation must maintain consistency between:

```text
Project Vision
      ↓
Product Requirements
      ↓
System Architecture
      ↓
Audio Engine
      ↓
Music Library
      ↓
Design System
      ↓
Screen Architecture
      ↓
Now Playing
      ↓
Audio Galaxy
      ↓
Format Support
      ↓
Feature Specification
      ↓
Database Schema
      ↓
Performance / Privacy / Security
      ↓
Development Rules
```

If a new implementation conflicts with an earlier architectural requirement, resolve the conflict by preserving the higher-level product principles:

```text
Audio reliability
        +
User control
        +
Data integrity
        +
Privacy
        +
Security
        +
Performance
        +
Accessibility
        +
Original design
```

The final goal is not merely to make the application function.

The goal is to build a **stable, premium, original, privacy-first personal music system that remains reliable as the user's music collection grows.**
