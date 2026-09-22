# 12 — PERFORMANCE, PRIVACY & SECURITY

## 1. Document Purpose

This document defines the performance, privacy, security, resource-management, and reliability requirements for the Music Player App.

The application is designed as a:

- Local-first music player
- Ad-free personal audio environment
- Offline-capable application
- Privacy-respecting music library
- Performance-sensitive audio system
- Large-library-capable application
- Secure local data system

Performance must never be achieved by sacrificing audio reliability, data integrity, privacy, or user control.

---

# 2. Core Engineering Priorities

The application follows this priority order:

```text
1. Audio reliability
2. User interaction responsiveness
3. Data integrity
4. Library responsiveness
5. Background processing
6. Visual effects
7. Non-essential computation
```

When resources become limited, lower-priority work must yield to higher-priority work.

For example:

```text
Audio playback
      ↓
User interaction
      ↓
Library operations
      ↓
Scanning
      ↓
Artwork processing
      ↓
Audio Galaxy
      ↓
Visualizer
      ↓
Non-essential background work
```

Visual effects must never be allowed to interfere with playback.

---

# 3. Performance Philosophy

The application must feel responsive even when performing expensive operations.

The following principles are mandatory:

- Do not block the UI thread with heavy operations.
- Do not perform full-library operations during normal interaction unless explicitly requested.
- Do not decode unnecessary audio.
- Do not load unnecessary artwork.
- Do not render thousands of UI elements simultaneously.
- Do not repeatedly query the database for identical information.
- Do not repeatedly calculate expensive visual data when cached results are available.
- Do not perform unnecessary filesystem scans.
- Do not keep unlimited data in memory.
- Do not allow visualizers or Audio Galaxy to consume resources needed by playback.

Performance optimization must preserve correctness.

---

# 4. Performance Budget Concept

Every subsystem should have an explicit resource budget.

Budgets should consider:

- CPU usage
- Memory usage
- GPU usage
- Disk I/O
- Database activity
- Filesystem activity
- UI rendering
- Audio processing
- Battery consumption

The exact values may vary by platform and hardware.

Therefore, implementation must distinguish between:

```text
Target
Budget
Observed
Limit
Failure threshold
```

Do not present a target as an actual measured benchmark.

Actual performance numbers must come from real profiling.

---

# 5. UI Responsiveness

The UI must remain responsive during:

- Music scanning
- Metadata extraction
- Artwork extraction
- Database updates
- Search indexing
- Playlist operations
- Audio analysis
- Audio Galaxy generation
- Visualizer processing
- Cache maintenance

Heavy operations must not execute synchronously on the main/UI thread.

---

# 6. Frame Performance

For interfaces targeting approximately 60 FPS:

```text
Frame budget ≈ 16.7 ms
```

This should be treated as a design target, not a guaranteed platform capability.

Animations should avoid:

- Excessive layout recalculation
- Large DOM/tree updates
- Unnecessary image decoding
- Repeated expensive calculations
- Excessive blur effects
- Excessive transparency layers
- Large particle systems
- Unbounded graph rendering

When the system is under resource pressure, visual complexity should automatically reduce where possible.

---

# 7. Audio Real-Time Safety

Audio processing is a real-time-sensitive subsystem.

The audio callback/output path must not perform operations that can unpredictably block.

Avoid performing the following directly in real-time audio processing:

- Database queries
- Filesystem operations
- Network requests
- Large memory allocations
- Garbage collection-triggering work
- Metadata parsing
- Artwork processing
- Complex logging
- UI operations
- Long locks
- Synchronous external service calls

The audio engine should consume prepared data from non-real-time components.

---

# 8. Playback Priority

Playback always receives higher priority than visual features.

If CPU, memory, or GPU resources become constrained:

```text
Visualizer quality ↓
Galaxy detail ↓
Artwork effects ↓
Background processing ↓
Scanning speed ↓

Playback quality remains protected.
```

The application must never intentionally sacrifice stable playback merely to maintain an animation.

---

# 9. Audio Buffering

The playback system should maintain sufficient buffering to prevent avoidable interruptions.

Buffering should account for:

- Storage speed
- Decoder behavior
- Track size
- Seek operations
- CPU load
- DSP processing
- Device output behavior

Buffer strategy should avoid both:

```text
Too little buffering → underruns
```

and:

```text
Excessive buffering → unnecessary memory usage
```

---

# 10. Seeking Performance

Seeking should prioritize perceived responsiveness.

The system should:

1. Receive seek request.
2. Update playback state.
3. Stop or reposition decoding as required.
4. Locate the appropriate decoder position.
5. Refill buffers.
6. Resume output.
7. Synchronize UI position.

Repeated seek requests should not create an uncontrolled queue of expensive operations.

Rapid slider movement may use debouncing or seek coalescing where appropriate.

---

# 11. Background Processing

Expensive operations should run through a controlled background task system.

Examples:

- Library scanning
- Metadata extraction
- Artwork extraction
- Search indexing
- Audio analysis
- Duplicate analysis
- Cache cleanup
- Audio Galaxy data preparation

Each job should have:

- Priority
- Cancellation support
- Progress reporting
- Error handling
- Resource limits
- Retry policy
- Lifecycle state

Example:

```text
QUEUED
  ↓
RUNNING
  ↓
COMPLETED

or

RUNNING
  ↓
FAILED

or

RUNNING
  ↓
CANCELLED
```

---

# 12. Concurrency Control

Concurrency must be deliberate.

Do not create unlimited background workers.

The system should control:

- Worker count
- Queue length
- Memory usage
- Disk activity
- CPU activity
- Database write frequency

High-cost jobs should be serialized or throttled when necessary.

---

# 13. Task Priorities

Recommended priority hierarchy:

### Critical

- Audio playback
- Audio output
- Playback state changes
- User-triggered playback actions

### High

- Current screen data
- Search interaction
- Queue updates
- User-requested library operations

### Normal

- Library scanning
- Metadata indexing
- Artwork processing

### Low

- Audio Galaxy preparation
- Statistics
- Background cache maintenance
- Non-essential analysis

### Opportunistic

- Prefetching
- Predictive cache warming
- Optional analysis

---

# 14. Startup Performance

Application startup should avoid unnecessary work.

Startup should prioritize:

```text
Application initialization
        ↓
Restore essential application state
        ↓
Initialize database
        ↓
Initialize playback system
        ↓
Display UI
        ↓
Load library data
        ↓
Start background work
```

The application should not wait for a complete library scan before becoming interactive.

---

# 15. Library Loading

Library screens must use:

- Pagination
- Virtualization where appropriate
- Lazy loading
- Indexed queries
- Cached summaries
- Incremental rendering

Do not load an entire large library into the UI at once.

Example:

```text
Database
   ↓
Requested page
   ↓
Repository
   ↓
Application state
   ↓
Visible UI
```

---

# 16. Large Library Strategy

The application must be designed for collections ranging from small personal libraries to very large libraries.

Avoid assumptions such as:

```text
Library = 500 songs
```

The architecture should remain functional when the collection contains:

- Thousands of tracks
- Tens of thousands of tracks
- Potentially much larger collections

Large libraries require:

- Indexed queries
- Pagination
- Lazy artwork loading
- Virtualized lists
- Incremental scanning
- Efficient search
- Cached aggregate data
- Controlled memory usage

---

# 17. Memory Management

Memory usage must remain bounded.

Avoid:

- Loading every song into memory
- Keeping full-resolution artwork indefinitely
- Keeping decoded audio indefinitely
- Creating duplicate image buffers unnecessarily
- Keeping abandoned screen state alive
- Retaining obsolete scan results
- Unlimited playback history in memory

Memory-heavy resources should be released when no longer needed.

---

# 18. Artwork Cache

Artwork is one of the major potential memory consumers.

The system should distinguish:

```text
Original artwork
Cached artwork
UI thumbnail
Now Playing artwork
Temporary decoded image
```

These must not be treated as the same resource.

Artwork caching should support:

- Size limits
- Eviction
- Lazy loading
- Resolution-aware variants
- Reuse
- Background decoding

Do not decode a 4000×4000 artwork image when a small list thumbnail is sufficient.

---

# 19. Audio Cache

Audio caching must be controlled.

Do not cache entire large tracks unless explicitly justified.

Prefer:

- Decoder buffering
- Small temporary buffers
- Controlled preloading
- Track transition prefetching where useful

Cache lifetime should be predictable.

---

# 20. CPU Optimization

CPU-intensive work includes:

- Audio decoding
- DSP
- Metadata parsing
- Artwork decoding
- Audio analysis
- Graph layout
- Visualizer calculations
- Search indexing

Optimization strategies:

- Avoid duplicate computation.
- Cache reusable results.
- Batch suitable operations.
- Throttle background work.
- Prefer incremental processing.
- Stop unnecessary work immediately when cancelled.
- Avoid polling when event-driven updates are possible.

---

# 21. GPU Optimization

GPU resources may be used for:

- Visualizers
- Artwork effects
- Animations
- Audio Galaxy rendering
- Advanced UI effects

GPU work must remain optional.

If GPU performance is poor:

```text
Reduce visual complexity
        ↓
Reduce particle count
        ↓
Reduce graph detail
        ↓
Reduce animation quality
        ↓
Disable non-essential effects
```

Playback must remain unaffected.

---

# 22. Battery Optimization

For battery-powered devices:

Avoid continuous high-power work when the user is not actively viewing the feature.

Examples:

- Stop visualizer processing when Now Playing is not visible.
- Pause Audio Galaxy animation when not visible.
- Stop unnecessary scanning when the application is inactive.
- Reduce background polling.
- Avoid repeated filesystem scans.
- Avoid unnecessary database writes.

The application should prefer event-driven processing over constant polling.

---

# 23. Database Performance

The database must be optimized for the application's most common queries.

Important query categories include:

- Songs
- Albums
- Artists
- Genres
- Favorites
- Recently played
- Recently added
- Playlists
- Search
- Folder browsing
- Format filtering
- Audio Galaxy relationships

Indexes should be created based on actual query patterns.

Do not add indexes blindly.

---

# 24. Database Pagination

Large result sets must use pagination or equivalent incremental retrieval.

Example:

```text
Request:
Songs 1–100

Then:
Songs 101–200

Then:
Songs 201–300
```

The UI should not request thousands of rows when only a small visible portion is required.

---

# 25. Database Write Optimization

Database writes should be efficient.

Avoid writing to the database on every tiny UI state change unless persistence is actually required.

Suitable batching may be used for:

- Scan results
- Metadata indexing
- Playback history
- Statistics
- Search index updates

However, critical playback state should not be delayed in a way that risks losing important state.

---

# 26. Filesystem Scanning Performance

Scanning should be incremental.

The scanner should distinguish:

```text
New file
Modified file
Unchanged file
Moved file
Deleted file
Unreadable file
Unsupported file
Corrupt file
```

Unchanged files should not be fully reparsed unnecessarily.

The scanner should use file identity information such as:

- Path
- File size
- Modification timestamp
- Stable filesystem identity where available
- Additional fingerprinting when necessary

---

# 27. Metadata Processing

Metadata extraction should happen outside the UI thread.

Processing should avoid repeatedly parsing the same file.

Metadata should be normalized before being stored in the database.

Failures should be isolated to individual files.

One malformed file must not terminate an entire scan.

---

# 28. Artwork Extraction Performance

Artwork extraction can be expensive.

The system should:

- Extract only when necessary.
- Avoid repeatedly decoding identical artwork.
- Cache extracted artwork.
- Generate appropriate thumbnails.
- Process large artwork carefully.
- Release temporary buffers quickly.

Artwork failure must not prevent the track from being indexed.

---

# 29. Audio Galaxy Performance

Audio Galaxy can become computationally expensive for large collections.

The implementation should use:

- Aggregated data
- Cached graph relationships
- Level-of-detail rendering
- Lazy node generation
- Virtualized or culled rendering where possible
- Stable layouts
- Incremental updates

For very large collections:

```text
Overview
   ↓
Aggregated nodes
   ↓
Zoom
   ↓
More detailed nodes
   ↓
Further zoom
   ↓
Individual tracks
```

Do not render every relationship simultaneously when the user cannot see them.

---

# 30. Audio Galaxy Resource Degradation

When Galaxy performance decreases:

1. Reduce visual effects.
2. Reduce graph detail.
3. Reduce animation.
4. Reduce visible relationships.
5. Use cached layout.
6. Prefer stable rendering over complex physics.

The Galaxy must remain optional and must never interfere with playback.

---

# 31. Visualizer Performance

Visualizers should operate independently from audio output.

The visualizer may consume analyzed audio information but must not become part of the critical audio-output path.

Visualizer processing should support:

- Frame throttling
- Reduced detail
- Reduced particle count
- Reduced resolution
- Reduced animation frequency
- Automatic pause when not visible

The visualizer should never cause audio underruns.

---

# 32. Network Usage

The application is local-first.

Normal music playback and library management must not require an internet connection.

Network access should be:

```text
Optional
Explicitly justified
Minimized
User-controlled
Feature-specific
```

The application must not silently upload the user's music library.

---

# 33. Offline-First Requirements

Core features must remain functional offline:

- Music playback
- Library browsing
- Search
- Queue
- Playlists
- Favorites
- Audio Galaxy
- Equalizer
- Visualizer
- Audio information
- Folder browsing
- Format exploration
- Local lyrics already stored
- Playback history

Future online features must fail gracefully when no network is available.

---

# 34. Privacy-by-Default

The application should assume:

> The user's music collection is private.

Therefore:

- Music filenames are private.
- Folder paths are private.
- Metadata is private.
- Listening history is private.
- Playlists are private.
- Favorites are private.
- Playback statistics are private.
- Lyrics stored locally are private.
- Artwork may contain private information.

None of these should be transmitted without a clear user-controlled reason.

---

# 35. Local Data Boundary

The default architecture is:

```text
User Device
│
├── Music Files
├── Local Database
├── Artwork Cache
├── Lyrics
├── Playback History
├── Playlists
└── Application Settings
```

These remain local by default.

The application should not introduce unnecessary cloud dependencies.

---

# 36. Telemetry Policy

Telemetry should be disabled by default unless explicitly required by the platform or clearly enabled by the user.

If optional diagnostics are introduced:

- Explain what is collected.
- Explain why it is collected.
- Allow the user to disable it.
- Avoid collecting music content.
- Avoid collecting full file paths.
- Avoid collecting unnecessary identifiers.
- Avoid uploading personal metadata.

No hidden analytics system should be introduced.

---

# 37. Diagnostics

Diagnostics should help developers understand failures without exposing private information.

Good diagnostic information:

- Application version
- Platform version
- Error category
- Subsystem
- Operation type
- Generic performance measurements
- Decoder capability
- Non-sensitive state

Avoid:

- Full filesystem paths
- Personal filenames
- Personal playlist names
- Full lyrics
- Raw metadata dumps
- Account credentials
- Access tokens
- Private network information

---

# 38. Path Redaction

When a filesystem path is needed for diagnostics, sensitive portions should be redacted.

Instead of logging:

```text
C:\Users\Om\Music\PrivateCollection\song.flac
```

prefer something conceptually like:

```text
<USER_MUSIC_ROOT>\song.flac
```

The exact redaction mechanism depends on the platform.

---

# 39. Security Threat Model

The application must treat imported music files and metadata as untrusted input.

Potential threats include:

- Malformed audio files
- Corrupt containers
- Malformed metadata
- Extremely large metadata fields
- Malicious filenames
- Dangerous filesystem paths
- Path traversal attempts
- Unexpected symbolic links
- Resource exhaustion
- Database corruption
- Malformed artwork
- Unexpected embedded content
- Unsafe external URLs
- Compromised future online services

---

# 40. Untrusted Audio Files

Audio files must be treated as data, not trusted executable content.

Decoder failures must be isolated.

A malformed file should result in:

```text
File processing failed
        ↓
Record failure
        ↓
Continue processing other files
```

It must not crash the entire application.

---

# 41. Metadata Security

Metadata fields may contain unexpected content.

Examples:

- Extremely long titles
- Invalid Unicode
- Embedded control characters
- HTML-like content
- Unexpected markup
- Malformed dates
- Very large comments

Metadata must be safely normalized before being displayed.

Metadata should never automatically become executable content.

---

# 42. Path Security

Filesystem paths must be validated.

The application must protect against:

- Path traversal
- Invalid paths
- Unexpected path formats
- Unauthorized roots
- Accidental access outside selected locations

The application should only scan directories that the user has explicitly granted or selected according to the platform's permission model.

---

# 43. Symbolic Links and Special Files

Where supported by the platform, scanners should handle symbolic links and special filesystem objects carefully.

Avoid:

- Infinite directory loops
- Scanning the same physical data repeatedly
- Unexpected access outside allowed roots

The scanner should maintain safe traversal rules.

---

# 44. Database Security

The database must protect against:

- Corruption
- Partial writes
- Invalid migrations
- Concurrent write conflicts
- Unexpected schema versions

Use transactions for logically related operations.

Example:

```text
Create Playlist
      +
Create Playlist Items
      +
Update Related State
```

should be treated as one consistent operation where appropriate.

---

# 45. Database Corruption Recovery

The application should detect database integrity failures where practical.

Recovery strategy:

```text
Detect corruption
      ↓
Stop unsafe writes
      ↓
Preserve recoverable data
      ↓
Attempt safe recovery
      ↓
Restore from known-good state if available
      ↓
Inform user
```

Do not silently delete the user's library database.

---

# 46. Source File Protection

The music player must not silently modify original music files.

Normal operations should be:

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

Any future metadata-editing feature must require explicit user action and clearly indicate that the original file will be modified.

---

# 47. Secrets and Credentials

The core application should not require user accounts.

If future online services are added, credentials must never be stored in:

- Plaintext configuration files
- Logs
- Database fields without appropriate protection
- Source code
- URLs
- Debug output

Use platform-appropriate secure credential storage.

Tokens must be treated as sensitive information.

---

# 48. External Services

Future integrations such as:

- Online lyrics
- Metadata services
- Cloud backup
- Music discovery
- Account synchronization

must be isolated from the core local player.

The core playback system must remain functional without them.

External services must not receive the user's complete library automatically.

---

# 49. Data Retention

The application should retain only data that provides useful functionality.

Potential persistent data:

- Library index
- Playlists
- Favorites
- Playback history
- Playback position
- Settings
- Cached artwork
- Local lyrics
- Galaxy cache

Temporary processing data should be deleted when no longer required.

---

# 50. User-Controlled Deletion

Users should eventually be able to clear:

- Cache
- Artwork cache
- Playback history
- Search history if implemented
- Galaxy cache
- Temporary processing data

Deleting indexed library information must not delete the original music files unless the user explicitly chooses a future destructive file-management operation.

---

# 51. Crash Recovery

A crash in one subsystem must not automatically crash unrelated subsystems.

Examples:

```text
Visualizer crash
→ Playback continues

Galaxy failure
→ Library continues

Artwork failure
→ Track remains playable

One corrupt track
→ Other tracks remain usable

Search index failure
→ Basic library browsing remains available
```

Failure isolation is mandatory.

---

# 52. Playback Recovery

If a decoder or output error occurs:

1. Detect failure.
2. Stop unsafe processing.
3. Preserve application stability.
4. Report the error.
5. Attempt safe recovery where possible.
6. Avoid infinite retry loops.
7. Allow the user to continue using the library.

---

# 53. Logging Architecture

Logs should be structured by subsystem.

Example categories:

```text
APP
PLAYBACK
AUDIO_ENGINE
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

Logs should have appropriate severity:

```text
DEBUG
INFO
WARNING
ERROR
CRITICAL
```

Verbose diagnostics should not be permanently enabled in normal production operation.

---

# 54. Sensitive Logging Rules

Never log:

- Passwords
- Access tokens
- API keys
- Authentication cookies
- Full private lyrics
- Complete personal library exports
- Unnecessary personal paths
- Sensitive account information

Logs should use identifiers that are safe and useful.

---

# 55. Performance Diagnostics

Performance diagnostics should measure real behavior rather than guess.

Useful measurements include:

- Startup duration
- Library query duration
- Scan duration
- Metadata parsing duration
- Artwork processing duration
- Database query duration
- Search latency
- Playback startup latency
- Seek latency
- Decoder initialization
- Buffer underruns
- Visualizer frame performance
- Galaxy rendering performance
- Memory usage
- CPU usage
- GPU usage

Measurements should be clearly identified as observed data.

---

# 56. Performance Degradation Strategy

The application should degrade gracefully.

Recommended order:

```text
Normal operation
      ↓
Reduce visual effects
      ↓
Reduce background work
      ↓
Reduce scanning concurrency
      ↓
Reduce Galaxy complexity
      ↓
Reduce visualizer quality
      ↓
Pause non-essential work
```

Do not degrade core playback unnecessarily.

---

# 57. Accessibility and Performance

Accessibility features must not be treated as optional performance overhead.

Examples:

- Reduced motion should reduce unnecessary animation.
- Large text should remain readable without breaking layout.
- Screen readers should receive meaningful semantic information.
- Keyboard navigation should remain responsive.
- Focus indicators must remain visible.
- Touch targets must remain usable.

Performance optimizations must not remove accessibility functionality.

---

# 58. Privacy and Performance Interaction

Privacy-preserving architecture can also improve performance.

Examples:

```text
Local database
→ No network round trip

Local search
→ Fast offline results

Local artwork cache
→ Reduced network dependence

Local lyrics
→ No external request during playback
```

The application should avoid introducing network dependencies where local processing is sufficient.

---

# 59. Secure Update and Migration Strategy

Application updates must preserve user data.

Before schema or storage changes:

```text
Validate current version
      ↓
Create safe migration path
      ↓
Apply migration transactionally
      ↓
Validate new structure
      ↓
Start application
```

Failed migrations must not silently destroy user data.

---

# 60. Version Compatibility

The application should maintain explicit versions for:

- Database schema
- Cache format
- Application settings format
- Galaxy cache format
- Search index format where necessary

Old caches may be safely rebuilt.

User-created data must receive stronger preservation guarantees than temporary caches.

---

# 61. Resource Cleanup

Every temporary resource should have a defined lifecycle.

Examples:

```text
File handle
→ Open
→ Read
→ Close

Image buffer
→ Allocate
→ Process
→ Release

Database transaction
→ Begin
→ Execute
→ Commit/Rollback

Background task
→ Start
→ Execute
→ Complete/Cancel
→ Cleanup
```

Resource leaks must be treated as defects.

---

# 62. Cancellation

Long-running operations should support cancellation where practical.

Examples:

- Library scan
- Artwork processing
- Search indexing
- Galaxy preparation
- Large imports
- Cache rebuilding

Cancellation should leave the application in a consistent state.

---

# 63. Priority Inversion Prevention

Lower-priority tasks must not hold resources required by critical playback operations for long periods.

Examples:

- Background database maintenance must not block playback state updates.
- Artwork processing must not monopolize CPU resources.
- Galaxy calculations must not prevent user interaction.
- Large scans must not prevent immediate playback.

---

# 64. Storage Management

The application should distinguish between:

```text
User-owned source files
Application database
Reusable cache
Temporary files
```

Cache storage may be cleaned automatically when necessary.

Original music files must never be treated as disposable cache data.

---

# 65. Low-Storage Behavior

When storage becomes constrained:

1. Detect low-storage condition where platform support allows.
2. Reduce temporary file creation.
3. Clean safe caches.
4. Avoid unnecessary artwork duplication.
5. Avoid creating large temporary datasets.
6. Inform the user when required.
7. Preserve user-owned source files.

---

# 66. Security vs Convenience

Security controls must be proportional and understandable.

Do not create unnecessary permissions.

Do not request access to unrelated directories.

Do not require internet access for local playback.

Do not require an account for core functionality.

Do not collect information merely because it might be useful later.

---

# 67. Privacy-Friendly Defaults

Default behavior should favor:

```text
Local storage
Local processing
Offline playback
No advertising
No tracking
No forced account
No automatic cloud upload
No silent file modification
Minimal permissions
Minimal diagnostics
```

Any future deviation must have a clear product reason and user-facing explanation.

---

# 68. Performance Acceptance Criteria

The implementation is considered performance-compliant when:

- UI remains responsive during background operations.
- Playback is not blocked by scanning.
- Playback is not blocked by artwork extraction.
- Playback is not blocked by Audio Galaxy.
- Playback is not blocked by visualizers.
- Large libraries remain navigable.
- Library queries use efficient access patterns.
- Artwork memory usage remains controlled.
- Background work can be cancelled.
- Resources are released correctly.
- No uncontrolled worker creation occurs.
- Network access is not required for core playback.
- Performance degradation is graceful.

---

# 69. Privacy Acceptance Criteria

The application is privacy-compliant when:

- Core music functionality works locally.
- Music files are not uploaded automatically.
- Library metadata remains local by default.
- Playback history remains local by default.
- Playlist data remains local by default.
- Diagnostics do not expose unnecessary personal information.
- Logs do not contain credentials or secrets.
- File paths are appropriately protected in diagnostics.
- External services are isolated.
- Users can clear appropriate application data.
- Original music files are not silently modified.

---

# 70. Security Acceptance Criteria

The application is security-compliant when:

- Malformed files do not crash the entire application.
- Metadata is safely handled.
- Paths are validated.
- Directory traversal is prevented.
- Special filesystem cases are handled safely.
- Database transactions preserve consistency.
- Database migrations are recoverable.
- Secrets are not logged.
- External services cannot silently access the full library.
- One failed subsystem does not compromise unrelated functionality.

---

# 71. Golden Performance Rules

```text
RULE 1:
Playback always has priority.

RULE 2:
Never block the UI with heavy work.

RULE 3:
Never perform unsafe blocking work in the real-time audio path.

RULE 4:
Memory usage must remain controlled.

RULE 5:
Large libraries require pagination, indexing, and lazy loading.

RULE 6:
Background work must be cancellable and resource-aware.

RULE 7:
Visual effects are optional and subordinate to playback.

RULE 8:
Do not claim performance numbers without measurement.

RULE 9:
Optimize based on profiling, not assumptions.

RULE 10:
Prefer incremental work over repeated full processing.
```

---

# 72. Golden Privacy Rules

```text
RULE 1:
The user's music collection is private.

RULE 2:
Local-first means local by default.

RULE 3:
No unnecessary network communication.

RULE 4:
No hidden tracking.

RULE 5:
No forced account for core playback.

RULE 6:
No automatic cloud upload of the music library.

RULE 7:
Minimize permissions.

RULE 8:
Minimize diagnostics.

RULE 9:
Never expose secrets in logs.

RULE 10:
Never silently modify or delete original music files.
```

---

# 73. Golden Security Rules

```text
RULE 1:
Treat imported files as untrusted input.

RULE 2:
Validate filesystem paths.

RULE 3:
Protect against path traversal.

RULE 4:
Isolate decoder failures.

RULE 5:
Protect database integrity.

RULE 6:
Use safe migrations.

RULE 7:
Protect credentials and secrets.

RULE 8:
Keep external services isolated from the core player.

RULE 9:
Prevent one subsystem failure from destabilizing the application.

RULE 10:
Fail safely rather than silently corrupting data.
```

---

# 74. Final Architecture Principle

The Music Player App should behave as a resource-aware local audio system:

```text
                 USER
                  │
                  ▼
             UI / INPUT
                  │
                  ▼
        APPLICATION SERVICES
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
   LOCAL DATABASE      PLAYBACK ENGINE
        │                   │
        ▼                   ▼
 LIBRARY / SEARCH       AUDIO OUTPUT
        │
        ├── PLAYLISTS
        ├── FAVORITES
        ├── HISTORY
        ├── LYRICS
        ├── AUDIO GALAXY
        └── AUDIO INFO

Background Systems:
        │
        ├── Scanner
        ├── Metadata
        ├── Artwork
        ├── Search Index
        ├── Cache
        └── Statistics

Cross-cutting:
        │
        ├── Performance
        ├── Privacy
        ├── Security
        ├── Accessibility
        └── Error Recovery
```

The fundamental rule is:

> **The application must remain fast, private, stable, and predictable even when the music collection is large and the device is under resource pressure.**

Audio reliability comes first.

User responsiveness comes second.

Data integrity comes before visual complexity.

Privacy is the default.

Security is built into the architecture rather than added afterward.

---

# 75. Document Completion Criteria

This specification is complete when the implementation clearly demonstrates:

- Performance-aware architecture
- Controlled background processing
- Real-time-safe audio design
- Bounded memory behavior
- Large-library support
- Efficient database access
- Controlled artwork and audio caching
- GPU/CPU resource awareness
- Battery-conscious behavior
- Offline-first operation
- Privacy-by-default behavior
- Secure filesystem handling
- Safe metadata processing
- Database integrity protection
- Safe migration strategy
- Failure isolation
- Secure diagnostics
- Graceful performance degradation
- No unnecessary network dependency
- No advertisements
- No silent modification of source music

**This document must be treated as an architectural requirement, not as optional optimization guidance.**
