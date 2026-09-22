# MUSIC PLAYER — DATA & DATABASE SCHEMA

## Document Purpose

This document defines the local data architecture for the Music Player App.

It establishes:

- Database responsibilities
- Core entities
- Relationships
- Primary identifiers
- Metadata storage
- Playback state
- Queue persistence
- Playlists
- Favorites
- History
- Lyrics
- Artwork references
- Library scanning
- Format information
- Search indexing
- Audio Galaxy data
- Cache references
- Migrations
- Data integrity
- Recovery
- Privacy

The database must remain a reliable local source of truth for the user's music library and application state.

---

# 1. DATABASE PHILOSOPHY

The database should provide structured access to the user's local music collection without modifying the original audio files.

Core principle:

```text id="p1q8zm"
SOURCE FILES
     │
     ▼
LIBRARY SCANNER
     │
     ▼
METADATA / FORMAT / ARTWORK
     │
     ▼
LOCAL DATABASE
     │
     ├── Library
     ├── Search
     ├── Playlists
     ├── Favorites
     ├── History
     ├── Queue
     └── Galaxy
```

The database is an index and application state store.

It is not the user's original music storage.

---

# 2. DATABASE RESPONSIBILITIES

The database should store:

- Indexed music records
- Metadata
- Technical audio information
- Artwork references
- Folder information
- Format information
- Playlist definitions
- Playlist membership
- Favorite state
- Playback history
- Resume positions
- Queue persistence
- Lyrics references/content where applicable
- Library scan state
- Search indexes
- Application preferences where appropriate

---

# 3. DATABASE MUST NOT STORE

The database should not become a replacement for the filesystem.

Avoid storing:

- Full audio files
- Unnecessary duplicate audio data
- Large uncompressed waveform data unless explicitly required
- Repeated full-resolution artwork copies
- Temporary processing data as permanent records

Large derived assets should use dedicated cache/storage mechanisms.

---

# 4. PRIMARY IDENTIFIER RULE

Every major entity must have a stable internal identifier.

Example:

```text id="9a1fqp"
Track ID
Album ID
Artist ID
Playlist ID
Folder ID
Genre ID
Artwork ID
```

Display names must never be used as the sole identity of an entity.

For example:

```text id="z2w4yc"
"Greatest Hits"
```

is not sufficient as a unique identifier.

Two artists may have albums with the same title.

---

# 5. ID REQUIREMENTS

Identifiers should be:

- Stable
- Unique
- Efficient to index
- Independent of display names
- Safe across library rescans

The exact identifier technology may depend on the database implementation.

---

# 6. TRACK ENTITY

The Track entity is the central music record.

Conceptual fields:

```text id="7d3y4k"
Track
├── id
├── fileId
├── title
├── artistId
├── albumId
├── albumArtistId
├── genreId
├── folderId
├── formatId
├── artworkId
├── trackNumber
├── discNumber
├── year
├── duration
├── fileSize
├── filePath/reference
├── dateAdded
├── dateModified
├── lastPlayed
├── playCount
├── favorite
├── resumePosition
└── availabilityState
```

The exact physical schema may normalize some fields into separate entities.

---

# 7. FILE ENTITY

A file record represents the physical audio file.

Conceptual:

```text id="5q6c9w"
AudioFile
├── id
├── path/reference
├── filename
├── extension
├── size
├── modifiedTime
├── contentIdentity
├── scanState
└── availability
```

The file entity should be separated from the logical Track where useful.

This helps handle moved files and multiple file versions.

---

# 8. TRACK VS FILE

A critical distinction:

```text id="k5p1m3"
TRACK
=
Logical music item

FILE
=
Physical storage representation
```

Example:

```text id="w7s4qa"
Track:
Song A

Files:
Song A.flac
Song A.mp3
```

The application may represent these as different playable files associated with related logical metadata.

---

# 9. ARTIST ENTITY

Conceptual:

```text id="x8f2lq"
Artist
├── id
├── name
├── sortName
├── normalizedName
└── artworkId
```

The artist name displayed to users should be preserved.

Normalization should primarily support searching and grouping.

---

# 10. ALBUM ENTITY

Conceptual:

```text id="m9x3cr"
Album
├── id
├── title
├── sortTitle
├── artistId
├── albumArtistId
├── year
├── genreId
├── artworkId
├── discCount
└── trackCount
```

Compilation albums require special handling.

---

# 11. GENRE ENTITY

Conceptual:

```text id="e7w4pk"
Genre
├── id
├── name
└── normalizedName
```

A track may contain multiple genres depending on metadata structure.

The final relational model should support this if required.

---

# 12. FOLDER ENTITY

Conceptual:

```text id="p3s8vd"
Folder
├── id
├── parentId
├── name
├── path/reference
└── scanRootId
```

This enables hierarchical folder browsing.

---

# 13. SCAN ROOT ENTITY

A Scan Root represents a user-selected library location.

Conceptual:

```text id="a9v2mn"
ScanRoot
├── id
├── location
├── enabled
├── includeSubfolders
├── lastScanStarted
├── lastScanCompleted
└── scanStatus
```

The application should support multiple music locations where the platform permits it.

---

# 14. FORMAT ENTITY

Conceptual:

```text id="q5f7xk"
AudioFormat
├── id
├── extension
├── container
├── codec
├── lossless
├── bitrate
├── sampleRate
├── bitDepth
├── channels
├── capabilityState
└── limitations
```

Technical information should be normalized where appropriate.

---

# 15. ARTWORK ENTITY

Artwork should be represented separately from Track/Album records.

Conceptual:

```text id="c8z6tp"
Artwork
├── id
├── source
├── cacheReference
├── width
├── height
├── format
├── hash
└── createdAt
```

This avoids unnecessary duplicate artwork storage.

---

# 16. ARTWORK RELATIONSHIPS

Possible ownership:

```text id="v6h1sa"
Track → Artwork
Album → Artwork
Artist → Artwork
Playlist → Artwork
```

The same artwork may be referenced by multiple records.

---

# 17. PLAYLIST ENTITY

Conceptual:

```text id="r2k9bx"
Playlist
├── id
├── name
├── description
├── artworkId
├── createdAt
├── updatedAt
└── sortOrder
```

Playlist membership must be stored separately.

---

# 18. PLAYLIST ITEM ENTITY

Conceptual:

```text id="g7p4wc"
PlaylistItem
├── id
├── playlistId
├── trackId
├── position
└── addedAt
```

The `position` field determines playlist order.

---

# 19. PLAYLIST ORDER

Playlist order must be explicit.

Example:

```text id="s3k9q1"
Playlist
│
├── Track A → position 0
├── Track B → position 1
├── Track C → position 2
└── Track D → position 3
```

Reordering must update positions without changing the underlying Track records.

---

# 20. FAVORITES

Favorite state may be represented either directly on Track or through a dedicated Favorite entity.

A dedicated entity may be preferable if future favorite types are expected.

Conceptual:

```text id="f8q2za"
Favorite
├── id
├── trackId
└── createdAt
```

There must be only one authoritative favorite state.

---

# 21. PLAYBACK HISTORY

Conceptual:

```text id="c7d9we"
PlaybackHistory
├── id
├── trackId
├── startedAt
├── endedAt
├── listenedDuration
└── completionState
```

History may be retained according to user settings.

---

# 22. PLAY COUNT

Play count should not increase simply because a track was loaded.

A play should be recorded according to a defined playback threshold.

Example:

```text id="n8x4wq"
Track starts
   ↓
Playback reaches threshold
   ↓
Count as play
```

The threshold should be defined consistently by the application.

---

# 23. RESUME POSITION

Resume state may be stored separately.

Conceptual:

```text id="z6c3pm"
PlaybackPosition
├── trackId
├── position
├── updatedAt
└── valid
```

Only meaningful positions should be persisted.

Do not save position every millisecond.

---

# 24. QUEUE ENTITY

The queue represents the current playback plan.

Conceptual:

```text id="u5j7vx"
QueueItem
├── id
├── trackId
├── position
├── source
├── addedAt
└── playbackState
```

The active queue should normally be treated as application state rather than a permanent playlist.

---

# 25. QUEUE SESSION

A Queue Session can represent the current playback session.

Conceptual:

```text id="q4x8nr"
PlaybackSession
├── id
├── currentTrackId
├── currentPosition
├── shuffleEnabled
├── repeatMode
├── startedAt
└── updatedAt
```

This enables reliable playback restoration if supported.

---

# 26. LYRICS ENTITY

Conceptual:

```text id="m7z1bc"
Lyrics
├── id
├── trackId
├── type
├── content
├── language
├── synchronized
└── source
```

Possible types:

```text id="q0v3fs"
Plain Text
Synchronized
Embedded
Local File
```

The source should be known.

---

# 27. LYRICS STORAGE

Large lyrics content should not be unnecessarily duplicated.

A track should reference one appropriate lyrics record.

If multiple versions exist, the application must define which one is active.

---

# 28. LIBRARY SCAN SESSION

Scanning should have its own state record.

Conceptual:

```text id="d4p8jm"
ScanSession
├── id
├── scanRootId
├── startedAt
├── completedAt
├── status
├── filesDiscovered
├── filesProcessed
├── filesFailed
└── cancelled
```

This enables real scan progress.

---

# 29. SCAN FILE STATE

The scanner may track:

```text id="e1k7qw"
NEW
UNCHANGED
MODIFIED
MISSING
ERROR
IGNORED
```

This helps incremental scanning.

---

# 30. LIBRARY EVENT MODEL

Library changes may generate events such as:

```text id="s4y8pf"
TrackAdded
TrackUpdated
TrackRemoved
AlbumUpdated
ArtistUpdated
ArtworkUpdated
FolderUpdated
FormatUpdated
```

The UI and Galaxy can react to these events.

---

# 31. SEARCH INDEX

Search should use indexed data.

Conceptual indexed fields:

```text id="a7m2px"
Track Title
Artist
Album
Album Artist
Genre
Playlist
Folder
Filename
```

The implementation may use database-native indexing or a dedicated local search index.

---

# 32. NORMALIZED SEARCH

Search should normalize:

- Case
- Whitespace
- Common punctuation

Where appropriate, accents/diacritics may also be normalized.

Original display values must remain unchanged.

---

# 33. SEARCH RANKING

Search results should prioritize relevance.

Possible ordering:

```text id="n5w8cq"
Exact title
↓
Starts with query
↓
Contains query
↓
Metadata match
```

The exact ranking should be deterministic.

Do not use opaque external recommendation systems for local search.

---

# 34. DATABASE RELATIONSHIP MAP

Conceptually:

```text id="c8r1vx"
ScanRoot
   │
   ▼
Folder
   │
   ▼
AudioFile
   │
   ▼
Track
 ┌─┼───────┬────────┬────────┐
 ▼ ▼       ▼        ▼        ▼
Artist Album Genre Artwork Format
   │      │
   │      └──── Track
   │
   └──── Track

Track
 ├── Favorite
 ├── History
 ├── Resume
 ├── Lyrics
 └── PlaylistItem
          │
          ▼
       Playlist
```

---

# 35. TRACK RELATIONSHIPS

A Track may reference:

```text id="0n9w3z"
One logical file
One album
One or more artists
One or more genres
Zero or more playlists
Zero or one favorite state
Zero or more history records
Zero or one resume state
Zero or one primary artwork
Zero or one lyrics record
One format record
One folder
```

The exact relationship cardinality depends on the final normalization model.

---

# 36. MULTI-ARTIST TRACKS

The schema should support multiple artists.

Example:

```text id="2q7v8x"
Track
 ├── Artist A
 └── Artist B
```

Do not force a multi-artist track into a single string if structured artist relationships are required.

---

# 37. MULTI-GENRE TRACKS

Similarly:

```text id="y4p6k1"
Track
 ├── Genre A
 └── Genre B
```

The schema should support multiple genres where metadata provides them.

---

# 38. COMPILATION SUPPORT

Compilation albums should not incorrectly assign all tracks to one artist.

The schema should allow:

```text id="b6n3cw"
Album Artist:
Various Artists

Track Artist:
Artist A
Artist B
Artist C
```

---

# 39. SORT FIELDS

The database should store normalized sort values where useful.

Examples:

```text id="g4r7sa"
Artist Name
Artist Sort Name

Album Title
Album Sort Title

Track Title
Track Sort Title
```

This improves alphabetical browsing.

---

# 40. YEAR HANDLING

Year information should be stored in a consistent representation.

If only partial date information exists, the database should not invent missing values.

Example:

```text id="e9c3km"
Year:
2024
```

If the source provides a full date and the application supports it, preserve the richer information separately.

---

# 41. DURATION

Duration should be stored in a consistent internal unit.

The application should avoid floating-point rounding errors in core playback calculations.

Display formatting can convert the stored value into:

```text id="x6n4pl"
03:42
```

or longer formats when necessary.

---

# 42. FILE SIZE

File size should be stored using an integer-safe representation.

The UI may display:

```text id="c5h2vx"
7.8 MB
1.2 GB
```

but the database should retain the accurate underlying value.

---

# 43. PATH STORAGE

File paths should be handled carefully.

Where platform architecture requires:

- Store normalized path references.
- Avoid leaking paths unnecessarily into UI.
- Protect paths from accidental external transmission.
- Support path changes during rescanning.

---

# 44. DATABASE PRIVACY

The local database contains sensitive information about the user's music collection.

It may reveal:

- Artist preferences
- Listening history
- Folder locations
- Playlist names
- Music collection structure

Therefore:

- Do not expose it unnecessarily.
- Do not upload it automatically.
- Do not log complete database records.
- Do not include personal paths in diagnostics by default.

---

# 45. DATABASE ENCRYPTION

If platform support makes local encryption practical, sensitive application state may be protected.

However, encryption must not unnecessarily damage performance.

The architecture should allow secure storage mechanisms where appropriate.

---

# 46. TRANSACTIONS

Use database transactions for operations requiring atomicity.

Examples:

```text id="2c7m1a"
Create Playlist
+
Add Playlist Items
```

or:

```text id="g5n8wp"
Remove Track
+
Update Related References
```

A partially completed database operation must be avoided.

---

# 47. ATOMIC PLAYLIST REORDER

Playlist reordering should be transactional.

Before:

```text id="7y3n4q"
A
B
C
D
```

After moving D to position 1:

```text id="1x8m0v"
A
D
B
C
```

The database should never remain in a permanently inconsistent intermediate ordering.

---

# 48. FAVORITE TRANSACTION

Changing favorite state should update the authoritative record atomically.

All UI surfaces should eventually observe the same resulting state.

---

# 49. HISTORY TRANSACTION

History insertion should not block playback.

The application may queue history writes asynchronously while preserving ordering and reliability.

---

# 50. DATABASE INDEXING

Frequently queried fields should have indexes.

Potential indexes:

```text id="v5k2sp"
Track.title
Track.artistId
Track.albumId
Track.genreId
Track.dateAdded
Track.lastPlayed
Track.favorite
AudioFile.path
AudioFile.modifiedTime
PlaylistItem.playlistId
PlaylistItem.position
PlaybackHistory.trackId
PlaybackHistory.startedAt
```

Exact indexes should be based on actual query patterns.

---

# 51. DATABASE PAGINATION

Large collections must not be loaded completely into memory.

Use:

- Pagination
- Cursor-based retrieval where appropriate
- Virtualized UI
- Incremental loading

Example:

```text id="k7z5rb"
10,000 Tracks
     ↓
Load first page
     ↓
Render
     ↓
Load next page
```

---

# 52. DATABASE QUERY RULE

The UI should not execute arbitrary database queries.

Preferred:

```text id="b6p2nc"
UI
 ↓
Application Service
 ↓
Repository
 ↓
Database
```

This preserves architecture boundaries.

---

# 53. REPOSITORY RESPONSIBILITY

Repositories should provide meaningful operations.

Examples:

```text id="q5s7xm"
getTracks()
getAlbum()
getArtist()
searchTracks()
getFavorites()
getRecentlyPlayed()
getPlaylist()
getFormatStatistics()
```

Screens should not know database table implementation details.

---

# 54. CACHE VS DATABASE

The database and cache have different responsibilities.

### Database

Stores authoritative structured application/library state.

### Cache

Stores regenerable derived data.

Examples:

```text id="e6t1cz"
Artwork cache
Waveform cache
Galaxy layout cache
Audio analysis cache
```

A cache can be deleted and rebuilt.

The database should remain authoritative.

---

# 55. GALAXY DATA

The Galaxy should not permanently duplicate the entire graph unless necessary.

Preferred:

```text id="n4p7kw"
Database
 ↓
Galaxy Data Builder
 ↓
Graph
 ↓
Optional Layout Cache
```

If the library changes significantly, the graph can be regenerated.

---

# 56. GALAXY LAYOUT CACHE

If cached, store only derived layout information.

Example:

```text id="q2x6dv"
Entity ID
X
Y
Scale
```

Do not duplicate full metadata records inside the Galaxy cache.

---

# 57. DATABASE MIGRATIONS

Database schema changes must use explicit migrations.

Never assume a user's database is always the latest version.

Conceptual:

```text id="t7y3cp"
Version 1
   ↓
Migration
   ↓
Version 2
   ↓
Migration
   ↓
Version 3
```

---

# 58. MIGRATION RULES

Each migration must:

- Have a unique version.
- Be deterministic.
- Preserve user data.
- Be testable.
- Be recoverable where practical.
- Avoid unnecessary destructive operations.

---

# 59. MIGRATION BACKUP

Before high-risk schema migrations, the application may create a safe backup of important local application data.

Do not create unlimited backups that consume storage.

---

# 60. DATABASE CORRUPTION

If corruption is detected:

```text id="w8n3ym"
Detect
 ↓
Protect Existing Data
 ↓
Attempt Recovery
 ↓
Restore Backup if Available
 ↓
Report Result
```

The application should not silently reset the user's entire library.

---

# 61. DATABASE REBUILD

A database rebuild may be supported.

Conceptually:

```text id="u1x6pk"
Existing Database
      ↓
Export Recoverable User Data
      ↓
Rebuild Library Index
      ↓
Restore Playlists/Favorites/History
```

The exact implementation should be carefully designed before use.

---

# 62. SCAN CONSISTENCY

After scanning:

```text id="m7c2vl"
Filesystem
    ↕
Database
```

should represent the same current library state according to scan rules.

The scanner must not partially remove large numbers of records because of a temporary scan failure.

---

# 63. PARTIAL SCAN FAILURE

If a scan fails halfway:

```text id="r9q3kw"
Scan Error
 ↓
Preserve Existing Library
 ↓
Record Failure
 ↓
Allow Retry
```

Do not treat unprocessed files as deleted.

---

# 64. FILE REMOVAL

A file should only be marked missing/deleted after reliable evidence.

A temporary filesystem access error should not be treated as proof that the file was deleted.

---

# 65. DUPLICATE RECORD PROTECTION

Database constraints should prevent accidental duplicate logical records where possible.

However, legitimate multiple files/versions must remain representable.

---

# 66. CONCURRENCY

Multiple background operations may access the database:

- Scanner
- Search indexer
- Artwork processor
- Playback history
- Playlist operations

Database access must be coordinated safely.

Playback should never be blocked by large background database operations.

---

# 67. BACKGROUND WRITE PRIORITY

Database writes should be prioritized.

Conceptually:

```text id="3h8v6c"
Playback State
     >
User Action
     >
Library State
     >
Artwork Cache
     >
Statistics
```

Critical user actions should not wait behind large background indexing operations.

---

# 68. DATABASE OBSERVABILITY

Diagnostics may expose:

- Database size
- Schema version
- Number of tracks
- Number of albums
- Number of artists
- Last scan
- Index status

Do not expose private music metadata unnecessarily in logs.

---

# 69. DATABASE TEST DATA

Testing should include:

- Empty database
- Small library
- Large library
- Duplicate tracks
- Missing files
- Missing metadata
- Multiple artists
- Multiple genres
- Compilation albums
- Multi-disc albums
- Large playlists
- Large history

---

# 70. DATABASE ACCEPTANCE TESTS

Verify:

```text id="a9r5b0"
Insert Track
Read Track
Update Track
Delete Track
Search Track
Create Album
Create Artist
Create Playlist
Reorder Playlist
Favorite Track
Record History
Save Resume Position
Restore Queue
Run Migration
Recover From Scan Failure
```

---

# 71. DATABASE PERFORMANCE TARGETS

The database should remain responsive with large collections.

Target scenarios should include:

```text id="q6k2vx"
10,000 tracks
50,000 tracks
100,000+ tracks
```

Actual supported maximum depends on platform storage and implementation.

The architecture must not assume a tiny library.

---

# 72. DATABASE STARTUP

Application startup should not require loading the entire database into memory.

Preferred:

```text id="x4p7sm"
Open Database
 ↓
Load Essential State
 ↓
Display UI
 ↓
Load Secondary Data Incrementally
```

---

# 73. DATABASE SHUTDOWN

Before shutdown/background suspension where necessary:

- Persist critical playback state.
- Flush important user actions.
- Close database connections safely.

Do not perform large unnecessary writes during shutdown.

---

# 74. DATA CONSISTENCY

The application must avoid conflicting sources of truth.

Examples:

```text id="v3m6zn"
Favorite State
→ Database

Current Playback State
→ Playback Engine / Playback State Store

Library Metadata
→ Database

Original Audio
→ Filesystem
```

Each category needs one authoritative owner.

---

# 75. DATABASE AND PLAYBACK ENGINE

The database stores persistent information.

The playback engine owns real-time playback state.

Do not force the audio engine to query the database during real-time audio processing.

Preferred:

```text id="s7q5xb"
Database
   ↓
Track Metadata
   ↓
Playback Manager
   ↓
Audio Engine
```

---

# 76. DATABASE AND UI

The UI should observe state through repositories/application services.

Preferred:

```text id="h2k8vw"
Database
 ↓
Repository
 ↓
Application State
 ↓
UI
```

Avoid direct database access from UI components.

---

# 77. DATABASE AND AUDIO GALAXY

Galaxy should query repository-level graph data.

Preferred:

```text id="r4c9tm"
Database
 ↓
Galaxy Repository / Data Builder
 ↓
Graph Model
 ↓
Galaxy UI
```

---

# 78. DATABASE AND SEARCH

Search should be optimized independently from filesystem access.

Preferred:

```text id="m8q1xz"
Search Query
 ↓
Search Index
 ↓
Track IDs
 ↓
Repository
 ↓
UI
```

---

# 79. DATABASE AND PLAYLISTS

Playlist operations should be transactional and repository-controlled.

Example:

```text id="b3n7ka"
UI
 ↓
Playlist Service
 ↓
Playlist Repository
 ↓
Database Transaction
```

---

# 80. DATA EXPORT CONSIDERATIONS

If export is implemented later, user-owned data may include:

- Playlists
- Favorites
- History
- Settings
- Library references

The application should avoid exporting unnecessary private filesystem information by default.

---

# 81. DATA DELETION

If the user requests deletion of application data:

Clearly distinguish:

```text id="s2g8nf"
Remove from Library
```

from:

```text id="x4m1qy"
Delete Physical File
```

These are not the same operation.

Normal library removal must not delete source audio unless the user explicitly chooses a destructive filesystem action.

---

# 82. DATABASE VERSIONING

The application should maintain:

```text id="f9q2lw"
Current Schema Version
Migration History
```

This helps diagnose compatibility problems.

---

# 83. BACKWARD COMPATIBILITY

Database migrations should preserve:

- User playlists
- Favorites
- Playback history where possible
- Resume positions
- Settings
- Library relationships

Never casually discard user-created data during upgrades.

---

# 84. DATABASE RESET

A complete reset should be an explicit advanced action.

Before reset, clearly explain what will be removed.

The application should distinguish:

```text id="c3x5vd"
Clear Cache
```

from:

```text id="e6q9wa"
Rebuild Library
```

from:

```text id="k8m2yr"
Delete Application Data
```

These must not be conflated.

---

# 85. FINAL DATABASE ARCHITECTURE

```text id="j5r8xn"
                    FILESYSTEM
                        │
                        ▼
                     SCANNER
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
       METADATA       FORMAT       ARTWORK
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                  LOCAL DATABASE
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
     LIBRARY         USER DATA       SEARCH INDEX
        │               │                │
   ┌────┼────┐      ┌───┼────┐           │
   ▼    ▼    ▼      ▼   ▼    ▼           ▼
 Track Album Artist  Fav History Queue   Search
   │
   ├── Lyrics
   ├── Artwork
   ├── Format
   └── Folder
        │
        ▼
   AUDIO GALAXY
        │
        ▼
   APPLICATION STATE
        │
        ▼
      PLAYER
```

---

# 86. FINAL DATABASE RULES

The following rules are mandatory:

1. The database is the authoritative source for indexed library metadata.
2. Original audio files remain on the filesystem.
3. Database IDs must be stable.
4. Display names must not be used as unique identity.
5. Track and physical file concepts should remain distinguishable.
6. Metadata must be normalized.
7. Format information must be structured.
8. Artwork should use references and caches rather than unnecessary duplication.
9. Playlist ordering must be explicitly stored.
10. Playlist operations must be transactional.
11. Favorites must have one authoritative state.
12. Playback history must not block audio playback.
13. Resume positions must be persisted efficiently.
14. Queue state must be separate from playlist state.
15. Search must use indexed local data.
16. Galaxy data should be derived from the database.
17. Cache data must remain regenerable.
18. Database migrations must be explicit.
19. Migrations must preserve user data.
20. Scan failures must not falsely delete library records.
21. Temporary filesystem failures must not be interpreted as deletion.
22. Database access must be concurrency-safe.
23. UI must not directly access database internals.
24. Real-time audio must not depend on database queries.
25. Private library information must not be unnecessarily logged or transmitted.
26. Library removal must not equal physical file deletion.
27. Database corruption must have a recovery strategy.
28. Large libraries must remain performant.
29. The database should remain useful without internet access.
30. No database design decision should compromise playback reliability.

---

# 87. FINAL DATA FLOW

The complete data lifecycle is:

```text id="y8p2mc"
USER MUSIC FILE
      │
      ▼
FILE SCANNER
      │
      ▼
FORMAT DETECTOR
      │
      ▼
METADATA PARSER
      │
      ├──────────────┐
      ▼              ▼
  ARTWORK        TECHNICAL DATA
      │              │
      └───────┬──────┘
              ▼
         NORMALIZATION
              │
              ▼
        LOCAL DATABASE
              │
      ┌───────┼────────┬───────────┐
      ▼       ▼        ▼           ▼
   LIBRARY  SEARCH  PLAYLISTS    GALAXY
      │       │        │           │
      └───────┴────────┼───────────┘
                       ▼
                  PLAYBACK
                       │
                       ▼
                 AUDIO ENGINE
                       │
                       ▼
                    OUTPUT
```

The database exists to make the user's music collection reliable, searchable, organized, and reusable throughout the application.

> **The filesystem owns the original music. The database owns the indexed knowledge about that music. The playback engine owns real-time audio. The UI consumes these systems through clean application boundaries.**
