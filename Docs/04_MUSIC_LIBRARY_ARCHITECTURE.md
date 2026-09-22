# 🎵 MUSIC PLAYER — MUSIC LIBRARY ARCHITECTURE

**Document:** `04_MUSIC_LIBRARY_ARCHITECTURE.md`
**Version:** 1.0
**Status:** Music Library System Specification
**Parent Documents:**

* `00_PROJECT_MASTER_SPEC.md`
* `01_PRODUCT_REQUIREMENTS.md`
* `02_SYSTEM_ARCHITECTURE.md`
* `03_AUDIO_ENGINE_ARCHITECTURE.md`

---

# 1. PURPOSE

This document defines how the Music Player discovers, analyzes, organizes, stores, updates, and presents the user's local audio collection.

The Music Library is the foundation of the application.

It connects:

```text
Device Files
     ↓
Scanner
     ↓
Format Detection
     ↓
Metadata
     ↓
Artwork
     ↓
Database
     ↓
Library
     ↓
Search / Player / Playlists / Galaxy
```

The library must be designed for both small and extremely large collections.

---

# 2. LIBRARY PHILOSOPHY

The Music Library must follow these principles:

1. Local-first.
2. Database-driven.
3. Incremental scanning.
4. Non-destructive.
5. Metadata-aware.
6. Format-aware.
7. Fault tolerant.
8. Memory efficient.
9. Searchable.
10. Scalable.

The application should never require the user to manually organize every song before it becomes useful.

---

# 3. LIBRARY ARCHITECTURE

```text id="p8r3qf"
                         MUSIC LIBRARY
                              │
               ┌──────────────┼──────────────┐
               ↓              ↓              ↓
           Filesystem       Scanner       Database
               │              │              │
               └──────┬───────┘              │
                      ↓                       │
                File Discovery               │
                      ↓                       │
                Format Detection             │
                      ↓                       │
                Metadata Parser              │
                      ↓                       │
                Artwork Extractor            │
                      ↓                       │
                Metadata Normalizer          │
                      └───────────┬───────────┘
                                  ↓
                           Library Database
                                  │
             ┌────────────────────┼────────────────────┐
             ↓                    ↓                    ↓
          Library UI            Search              Galaxy
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  ↓
                              Playback
```

---

# 4. AUDIO FILE DISCOVERY

The scanner must discover audio files from locations accessible to the application.

Potential sources:

```text id="dyb3tr"
Music
Downloads
Recordings
Podcasts
Custom User Folders
External Storage
```

The application should not assume that all audio exists inside one fixed folder.

---

# 5. SCAN ROOTS

The application should maintain a list of scan roots where supported.

Example:

```text id="9n2t0j"
SCAN LOCATIONS

✓ Music
✓ Downloads
✓ Recordings
□ Podcasts
□ Custom Folder
```

Users should be able to add/remove scan locations where platform permissions permit.

---

# 6. FILE DISCOVERY PIPELINE

```text id="z8rx6u"
Scan Root
   ↓
Directory Traversal
   ↓
File Detection
   ↓
Extension Candidate
   ↓
File Validation
   ↓
Format Detection
   ↓
Audio Candidate
```

Non-audio files should be ignored.

---

# 7. DIRECTORY TRAVERSAL

The scanner must:

* Handle nested directories.
* Avoid infinite loops where applicable.
* Respect platform storage restrictions.
* Handle inaccessible directories.
* Handle symbolic links according to platform safety rules.
* Avoid crashing when a directory disappears during scanning.

---

# 8. FILE CANDIDATE FILTER

The scanner may initially use extensions to reduce work.

Potential extensions:

```text id="nq2p7v"
.mp3
.flac
.wav
.m4a
.aac
.ogg
.opus
.wma
.aiff
.ape
.alac
```

Extension filtering is only a candidate step.

Actual media detection must rely on the audio backend where required.

---

# 9. FILE VALIDATION

For each candidate:

```text id="9xjzq0"
Candidate File
     ↓
Exists?
     ↓
Readable?
     ↓
Valid File?
     ↓
Audio?
```

Invalid files should be skipped safely.

---

# 10. FILE IDENTITY

The system needs a stable way to identify files.

Potential identity information:

```text id="w0i8yz"
Path
File Size
Modified Time
Platform File ID where available
Content Fingerprint where necessary
```

Do not calculate expensive full-file hashes for every scan unless there is a clear reason.

---

# 11. INCREMENTAL SCANNING

The scanner should not reprocess unchanged files.

Conceptual flow:

```text id="k5f80m"
Existing Database
      ↓
File Discovery
      ↓
Compare File State
      ↓
┌─────┼───────────────┐
↓     ↓               ↓
New  Modified      Unchanged
↓     ↓               ↓
Parse Parse          Skip
```

This is critical for large libraries.

---

# 12. NEW FILE

When a new audio file is found:

```text id="c3kq74"
New File
  ↓
Validate
  ↓
Detect Format
  ↓
Parse Metadata
  ↓
Extract Artwork
  ↓
Create Database Record
  ↓
Library Updated
```

---

# 13. MODIFIED FILE

A file may have:

* Changed metadata.
* Changed size.
* Changed content.
* Changed modification timestamp.

If modified:

```text id="p83qkn"
Existing File
     ↓
Change Detected
     ↓
Re-parse Required
     ↓
Update Metadata
     ↓
Update Artwork if needed
     ↓
Database Updated
```

---

# 14. UNCHANGED FILE

If a file has not changed:

```text id="8jngw0"
File
 ↓
State Matches Database
 ↓
Skip Expensive Processing
```

Do not repeatedly extract artwork or parse metadata for unchanged files.

---

# 15. DELETED FILE

If a previously indexed file no longer exists:

```text id="3dr1n4"
Database Track
     ↓
File Missing
     ↓
Mark Missing
```

Depending on product behavior, the application may:

* Immediately remove it from the active library, or
* Keep a temporary missing state before cleanup.

Do not silently destroy user-created playlist references unless the product explicitly requires it.

---

# 16. MOVED FILE

A file may move from:

```text id="8p5m4d"
/Music/Album/Track.flac
```

to:

```text id="4ql1v9"
/Music/NewFolder/Track.flac
```

The library should attempt to recognize it as the same media where practical.

Potential matching signals:

```text id="o3qf9g"
Stable File ID
Metadata
File Size
Content Fingerprint
```

Avoid creating unnecessary duplicate library entries.

---

# 17. DUPLICATE DETECTION

The system should distinguish:

### Same file indexed twice

from:

### Two genuinely separate copies

and:

### Two different files containing the same song.

Duplicate detection should not automatically delete files.

The library may identify:

```text id="p3k3tz"
Potential Duplicate
```

and let the user decide what to do.

---

# 18. NON-DESTRUCTIVE PRINCIPLE

The scanner must NEVER automatically:

* Delete audio files.
* Rename files.
* Move files.
* Rewrite metadata.
* Convert formats.

Scanning is an indexing operation.

File modification requires an explicit user action.

---

# 19. METADATA EXTRACTION

Metadata may include:

```text id="rj7z8b"
Title
Artist
Album
Album Artist
Genre
Year
Track Number
Disc Number
Composer
Comment
Copyright
Lyrics
Artwork
```

Additional metadata may be stored if supported.

---

# 20. TECHNICAL METADATA

Technical information may include:

```text id="0o8f2b"
Container
Codec
Bitrate
Sample Rate
Bit Depth
Channels
Channel Layout
Duration
File Size
```

This information should be separated conceptually from musical metadata.

---

# 21. METADATA NORMALIZATION

Raw metadata can be inconsistent.

Example:

```text id="y9k6o3"
"THE WEEKND"
"The Weeknd"
"the weeknd"
```

The system may normalize presentation without modifying the original file.

Important distinction:

```text id="6is8v4"
Original Metadata
       ↓
Normalized Library Representation
```

Do not overwrite the source file merely to normalize display data.

---

# 22. MISSING METADATA

If a file has missing metadata:

```text id="lqgy2p"
Title → Filename fallback
Artist → Unknown Artist
Album → Unknown Album
Genre → Unknown Genre
```

The UI should clearly distinguish actual metadata from fallback values where necessary.

---

# 23. METADATA EDITOR

A future metadata editor may allow:

* Title
* Artist
* Album
* Album Artist
* Genre
* Year
* Track number
* Disc number
* Artwork

But editing must be explicit.

The library scanner itself must remain non-destructive.

---

# 24. ARTWORK EXTRACTION

Artwork may come from:

1. Embedded audio artwork.
2. Local folder artwork.
3. Optional future external source.

Priority should generally be:

```text id="1d1yq6"
Embedded Artwork
      ↓
Local Artwork
      ↓
Generated Placeholder
```

Do not automatically download artwork unless the user explicitly enables an online feature.

---

# 25. ARTWORK CACHE

Artwork should not be repeatedly decoded from audio files.

Architecture:

```text id="3xk0z7"
Audio File
    ↓
Artwork Extractor
    ↓
Image Processing
    ↓
Artwork Cache
    ↓
Artwork ID
    ↓
UI
```

---

# 26. ARTWORK CACHE REQUIREMENTS

The cache must:

* Have a size limit.
* Support eviction.
* Avoid duplicate artwork.
* Support multiple resolutions.
* Handle missing/corrupt artwork.
* Avoid keeping all images in memory.

---

# 27. ARTWORK SIZES

Different UI surfaces need different image sizes.

Examples:

```text id="p1f0bx"
Tiny Thumbnail
Medium Card
Large Player
Full-Screen Visualizer
```

Do not load the original full-resolution image everywhere.

Generate or retrieve an appropriate cached size.

---

# 28. PLACEHOLDER ARTWORK

If artwork is missing:

```text id="8ck9vl"
Unknown Artwork
```

The placeholder should still fit the design system.

Potential dynamic fallback:

```text id="z9a4m1"
Artist Initial
Album Initial
Generated Abstract Pattern
Dynamic Gradient
```

---

# 29. ALBUM GROUPING

Tracks should be grouped into albums based on normalized metadata.

Primary fields may include:

```text id="4e8e8e"
Album
Album Artist
Disc Number
```

The system must avoid incorrectly combining unrelated albums with identical names where artist context differs.

---

# 30. ARTIST GROUPING

Artists may have:

* Individual artist names.
* Multiple artists.
* Featured artists.

The data model should allow multiple artist relationships when appropriate.

Example:

```text id="9d0e5y"
Song
 ├── Primary Artist
 ├── Featured Artist
 └── Other Credits
```

Exact representation depends on the metadata model.

---

# 31. GENRE GROUPING

Genres should be derived from metadata.

Potential issue:

```text id="x5o2wv"
"Rock; Alternative"
```

versus:

```text id="d8i7uo"
"Rock"
```

The parser should preserve source information while creating a useful normalized representation.

---

# 32. YEAR HANDLING

Year may be:

* Missing.
* Ambiguous.
* Stored as full date.
* Stored as year.

The system should normalize it for filtering while retaining original metadata where appropriate.

---

# 33. TRACK / DISC ORDER

Albums may contain multiple discs.

Example:

```text id="7l7pyn"
Disc 1
 ├── Track 1
 ├── Track 2
 └── Track 3

Disc 2
 ├── Track 1
 ├── Track 2
 └── Track 3
```

The database must preserve disc and track ordering.

---

# 34. COMPILATIONS

Compilation albums may have many different artists.

The library should not incorrectly create a single artist page containing the entire compilation unless the metadata actually indicates that relationship.

---

# 35. VARIOUS ARTISTS

Support the concept of:

```text id="f6y3a1"
Various Artists
```

where metadata identifies a compilation appropriately.

---

# 36. FOLDER ORGANIZATION

The application should maintain the relationship:

```text id="n2b5sh"
Track
 ↓
Folder
 ↓
Parent Folder
 ↓
Root
```

This allows folder-based navigation without duplicating track records.

---

# 37. FOLDER BROWSER

The Folder Browser should show actual filesystem hierarchy.

Example:

```text id="2ry1fe"
Music
├── Rock
│   ├── Album A
│   └── Album B
├── Pop
└── Downloads
```

Selecting a folder displays the audio files contained within it and optionally descendants.

---

# 38. DATABASE MODEL

The library database should conceptually contain:

```text id="5t2x2p"
Tracks
Artists
Albums
Genres
Folders
Formats
Artwork
Playlists
PlaylistItems
Favorites
PlaybackHistory
Lyrics
```

Detailed schema is defined in:

`11_DATA_DATABASE_SCHEMA.md`

---

# 39. TRACK RECORD

A Track should conceptually contain:

```text id="shl8at"
Track ID
File ID
File Path
Title
Duration
Format
Codec
Bitrate
Sample Rate
Bit Depth
Channels
Album ID
Artist Relationships
Genre Relationships
Artwork ID
Track Number
Disc Number
Year
Favorite State
Availability State
Created / Indexed Time
Modified Time
```

Exact schema should be defined separately.

---

# 40. LIBRARY QUERIES

The library should expose queries such as:

```text id="tv4b2w"
Get All Songs
Get Album
Get Artist
Get Genre
Get Folder
Get Favorites
Get Recently Played
Get Most Played
Get By Format
Search
```

These should operate against the database.

---

# 41. PAGINATION

Large result sets must not be loaded completely into memory.

Example:

```text id="h5p4pj"
Database
 ↓
First 50 tracks
 ↓
UI

Scroll
 ↓
Next 50
```

Exact page size should be tuned based on platform performance.

---

# 42. SORTING

Potential sorting options:

### Songs

* Title
* Artist
* Album
* Duration
* Date Added
* Last Played
* Play Count
* Format

### Albums

* Album name
* Artist
* Year
* Date Added

### Artists

* Name
* Most Played
* Recently Played

Sorting must be performed efficiently.

---

# 43. FILTERING

Potential filters:

```text id="5m1u7w"
Format
Genre
Artist
Album
Year
Folder
Favorite
Date Added
```

Filters should combine cleanly where practical.

Example:

```text id="8a5lq3"
FLAC
+
Rock
+
2024
```

---

# 44. SEARCH INDEX

Search should be optimized using appropriate database indexes or search mechanisms.

Potential indexed fields:

```text id="h8m5vv"
Title
Artist
Album
Genre
File Name
Folder
```

Do not load every track into application memory just to perform search.

---

# 45. LIBRARY EVENTS

Useful events:

```text id="oqfrc6"
SCAN_STARTED
SCAN_PROGRESS
SCAN_COMPLETED
TRACK_ADDED
TRACK_UPDATED
TRACK_REMOVED
ARTWORK_UPDATED
LIBRARY_CHANGED
```

Events should allow UI and other services to update without repeatedly rescanning.

---

# 46. SCAN PROGRESS

The UI should be able to show progress.

Example:

```text id="qf6o0v"
Scanning Music Library

1,248 / 4,832 files

████████░░░░░░░░
```

Progress should be approximate if exact totals are expensive to determine.

Do not freeze the interface during scanning.

---

# 47. SCAN CANCELLATION

Where supported:

```text id="t9i1fl"
Scanning
   ↓
User Cancels
   ↓
Stop Safely
   ↓
Commit Valid Results
   ↓
Preserve Existing Library
```

A cancelled scan must not corrupt the database.

---

# 48. SCAN RECOVERY

If the application closes during scanning:

```text id="x5m2dp"
Application Closed
      ↓
Restart
      ↓
Validate Database
      ↓
Resume / Restart Safely
```

Partial results must not corrupt existing records.

---

# 49. DATABASE TRANSACTIONS

Library updates should use appropriate transactions.

For example:

```text id="0z4j8u"
Parse Track
 ↓
Update Track
 ↓
Update Relationships
 ↓
Update Artwork Reference
 ↓
Commit
```

If the operation fails:

```text id="n6z3q1"
Rollback
```

where supported.

---

# 50. LIBRARY CONSISTENCY

The following must remain consistent:

```text id="d3g5z5"
Track
 ↕
Album
 ↕
Artist
 ↕
Genre
 ↕
Playlist
```

Removing a track should not create invalid database references.

---

# 51. MISSING FILE STRATEGY

A missing file should have a defined state.

Example:

```text id="9u1v1h"
AVAILABLE
MISSING
UNREADABLE
UNSUPPORTED
CORRUPTED
```

The UI may hide non-available tracks from normal browsing while preserving enough information for recovery.

---

# 52. STORAGE CHANGES

External storage may become:

* Unavailable.
* Remounted.
* Renamed.
* Permission-revoked.

The library should handle these events gracefully.

---

# 53. MULTIPLE STORAGE LOCATIONS

If the platform allows:

```text id="9g8m6p"
Internal Storage
External Storage
USB Storage
Network Storage*
```

Each source should have an identifiable root.

`*` Network storage is optional and should not be required for the core product.

---

# 54. LIBRARY STATISTICS

The application may calculate:

```text id="h6d4yx"
Total Songs
Total Albums
Total Artists
Total Genres
Total Formats
Total Storage Used
```

Statistics must be calculated from actual indexed data.

---

# 55. COLLECTION INSIGHTS

The application may eventually display:

```text id="5cv6k0"
Your Collection

4,832 Tracks
384 Albums
612 Artists
17 Formats
214 GB
```

These values must always come from the library database.

---

# 56. FORMAT STATISTICS

Example:

```text id="k4q0c5"
FLAC      142 tracks
MP3       842 tracks
WAV        51 tracks
AAC       123 tracks
OPUS       19 tracks
```

These statistics may feed the Format Explorer.

---

# 57. LIBRARY AND PLAYBACK RELATIONSHIP

The library identifies tracks.

The Playback Manager plays tracks.

Correct:

```text id="c2n9h8"
Library
 ↓
Track ID
 ↓
Playback Manager
 ↓
Audio Engine
```

The library must not become the playback engine.

---

# 58. LIBRARY AND PLAYLIST RELATIONSHIP

Playlists should reference track IDs.

Preferred:

```text id="7x9f7p"
Playlist
 ↓
Track IDs
```

Not:

```text id="5m9o9f"
Playlist
 ↓
Copied Track Objects
```

This prevents unnecessary data duplication.

---

# 59. LIBRARY AND AUDIO GALAXY

Audio Galaxy should consume library relationships.

```text id="m2d8k3"
Library Database
      ↓
Graph Query
      ↓
Artist / Album / Track Relationships
      ↓
Galaxy Model
      ↓
Galaxy Renderer
```

Galaxy must not independently scan the filesystem.

---

# 60. LIBRARY AND SEARCH

Search should query the library database.

```text id="z1y8q0"
Search
 ↓
Search Service
 ↓
Library Repository
 ↓
Database
```

No full filesystem scan should occur for a normal search.

---

# 61. LIBRARY AND ARTWORK

Artwork references should be reusable.

If 12 tracks share the same album artwork:

```text id="6xqj5w"
12 Tracks
     ↓
1 Artwork Record
```

rather than storing 12 unnecessary copies.

---

# 62. LIBRARY AND MEMORY

Never load the complete library into memory just to display a screen.

Prefer:

```text id="0r5f1w"
Database
 ↓
Query
 ↓
Small Result Set
 ↓
UI
```

Use pagination/virtualization for large collections.

---

# 63. LIBRARY SECURITY

Media files and metadata should be treated as untrusted input.

The scanner must safely handle:

* Malformed metadata.
* Unexpectedly long strings.
* Invalid characters.
* Corrupted files.
* Extremely large files.
* Unusual folder structures.

---

# 64. PERFORMANCE TARGET

The exact performance targets depend on hardware, but the architecture should aim for:

```text id="9p5m0a"
Fast initial library display
Fast incremental scans
Smooth scrolling
Fast search
Minimal repeated parsing
Low idle CPU usage
Controlled memory usage
```

Do not optimize blindly.

Measure actual bottlenecks.

---

# 65. LARGE LIBRARY TARGETS

The architecture should remain viable for:

```text id="gq4q9m"
1,000 tracks
10,000 tracks
50,000 tracks
100,000+ tracks
```

The exact upper limit should be discovered through profiling rather than assumed.

---

# 66. SCANNER PERFORMANCE

Potential optimizations:

* Extension prefiltering.
* Parallel metadata parsing where safe.
* Incremental scanning.
* Metadata caching.
* Artwork caching.
* Database batching.
* Avoiding unnecessary full-file hashing.

Do not sacrifice correctness for scan speed.

---

# 67. DATABASE PERFORMANCE

Use:

* Appropriate indexes.
* Efficient joins.
* Pagination.
* Batch operations.
* Transactions.
* Prepared statements or equivalent safe mechanisms.

Avoid N+1 query patterns.

---

# 68. BACKGROUND SCANNING

Scanning should run independently of normal UI rendering.

Example:

```text id="n7i8p5"
Home
  │
  ├── User browsing
  │
  └── Background Scanner
          ↓
       Database
          ↓
      Library Update
```

The user should be able to continue using the application while scanning where platform resources permit.

---

# 69. SCAN PRIORITY

Suggested priority:

```text id="l9p8ra"
1. Discover files
2. Identify playable audio
3. Basic metadata
4. Database availability
5. Artwork
6. Advanced metadata
7. Optional analysis
```

The library should become usable as early as practical.

---

# 70. ARTWORK PRIORITY

Artwork extraction may be deferred when necessary.

For example:

```text id="8p5qrm"
Track indexed
      ↓
Library immediately available
      ↓
Artwork processed in background
      ↓
UI updates progressively
```

This prevents artwork extraction from blocking the entire library.

---

# 71. METADATA FAILURE

If metadata parsing fails:

```text id="s6v8u4"
File still valid?
      ↓
YES
      ↓
Index using fallback metadata
```

Do not discard a playable track merely because optional metadata is malformed.

---

# 72. ARTWORK FAILURE

If artwork extraction fails:

```text id="g3j7p2"
Track remains playable
      ↓
Fallback artwork
```

Artwork failure must never stop playback.

---

# 73. LIBRARY FAILURE ISOLATION

A single bad file must not stop scanning the entire library.

Example:

```text id="y2j0d9"
Track 1 → Success
Track 2 → Success
Track 3 → Corrupt
Track 4 → Success
Track 5 → Success
```

Track 3 should be recorded as failed/skipped while scanning continues.

---

# 74. USER FEEDBACK

During scanning, provide meaningful status:

```text id="t6w3l9"
Scanning…
Found 1,248 audio files
Processing metadata…
Loading artwork…
Library ready
```

Do not expose unnecessary technical logs to ordinary users.

---

# 75. LIBRARY EMPTY STATE

If no audio is found:

```text id="l3b4c8"
YOUR LIBRARY IS EMPTY

No supported audio files were found.

Add music to a scanned folder and scan again.
```

Provide a clear action.

---

# 76. UNSUPPORTED FILES

If files exist but none are supported:

```text id="d8g5j1"
Audio files were found,
but none are currently supported by the audio engine.
```

Do not incorrectly tell the user that their storage is empty.

---

# 77. LIBRARY REFRESH

Provide an explicit refresh/rescan action.

Possible actions:

```text id="5e2x0q"
Refresh Library
Scan Now
Scan Folder
```

The application should distinguish a lightweight refresh from a full rescan where possible.

---

# 78. MANUAL FOLDER SCAN

The user may choose:

```text id="0p3k6z"
Scan This Folder
```

The scanner should process only the selected location.

---

# 79. LIBRARY SETTINGS

Potential settings:

```text id="6j2n4a"
Scan Locations
Automatic Scanning
Include Subfolders
Artwork Handling
Metadata Handling
Show Unsupported Files
Show Missing Files
```

Only expose settings that the platform actually supports.

---

# 80. NO AUTOMATIC FILE MODIFICATION

The library system must never silently modify the user's files.

Scanning means:

```text id="5n0j9q"
READ
ANALYZE
INDEX
CACHE
```

Not:

```text id="h3k8m5"
RENAME
MOVE
DELETE
REWRITE
CONVERT
```

---

# 81. LIBRARY DATA LIFECYCLE

```text id="2d5f7n"
FILE CREATED
     ↓
DISCOVERED
     ↓
INDEXED
     ↓
AVAILABLE
     ↓
MODIFIED
     ↓
REINDEXED
     ↓
MOVED
     ↓
REASSOCIATED
     ↓
DELETED
     ↓
REMOVED / MARKED MISSING
```

---

# 82. LIBRARY QUALITY RULES

### Rule 1

**The database is the primary source for library browsing.**

### Rule 2

**Filesystem scanning is not a UI rendering operation.**

### Rule 3

**Scanning must be incremental.**

### Rule 4

**Never modify user files during indexing.**

### Rule 5

**One corrupt file must not stop scanning.**

### Rule 6

**Artwork must be cached.**

### Rule 7

**Large libraries must not be loaded entirely into memory.**

### Rule 8

**Metadata failures must degrade gracefully.**

### Rule 9

**Duplicate detection must not delete files automatically.**

### Rule 10

**Actual file state must always take priority over stale cached assumptions.**

---

# 83. LIBRARY TESTING MATRIX

Test at minimum:

### File Types

```text
MP3
FLAC
WAV
AAC
M4A
OGG
OPUS
```

### Metadata Conditions

```text
Complete metadata
Missing metadata
Incorrect metadata
Unicode metadata
Very long metadata
Multiple artists
Multiple discs
Compilation
```

### File Conditions

```text
Valid
Corrupt
Zero-byte
Missing
Renamed
Moved
Duplicated
Very large
```

### Library Sizes

```text
100
1,000
10,000
50,000+
```

---

# 84. LIBRARY ACCEPTANCE CRITERIA

The library system is acceptable when:

* [ ] Audio files are discovered.
* [ ] Unsupported files are handled.
* [ ] Metadata is extracted.
* [ ] Artwork is extracted/cached.
* [ ] Songs are stored in the database.
* [ ] Albums are grouped correctly.
* [ ] Artists are grouped correctly.
* [ ] Genres are available.
* [ ] Folders are browsable.
* [ ] Formats are browsable.
* [ ] Search works from database data.
* [ ] Incremental scanning works.
* [ ] Missing files are handled.
* [ ] Duplicate handling is safe.
* [ ] Large libraries remain responsive.
* [ ] Scanning does not freeze the UI.
* [ ] Scanning does not modify user files.

---

# 85. FINAL LIBRARY ARCHITECTURE

```text id="h5n3xb"
                    DEVICE STORAGE
                         │
                         ↓
                  ┌──────────────┐
                  │    SCANNER   │
                  └──────┬───────┘
                         ↓
                ┌──────────────────┐
                │ FORMAT DETECTOR  │
                └────────┬─────────┘
                         ↓
                ┌──────────────────┐
                │ METADATA PARSER  │
                └────────┬─────────┘
                         ↓
                ┌──────────────────┐
                │ ARTWORK EXTRACTOR│
                └────────┬─────────┘
                         ↓
                ┌──────────────────┐
                │ NORMALIZER       │
                └────────┬─────────┘
                         ↓
                ┌──────────────────┐
                │ LOCAL DATABASE   │
                └────────┬─────────┘
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       Library         Search         Galaxy
          │              │              │
          └──────────────┼──────────────┘
                         ↓
                    Track IDs
                         ↓
                  Playback Manager
                         ↓
                    Audio Engine
```

---

# 86. FINAL PRINCIPLE

The Music Library must make the user's collection feel immediate and organized without taking ownership of the user's files.

The system should:

> **Discover the music, understand the music, organize the music, and make the music instantly playable — without modifying the user's original files.**

The Library is the bridge between the user's filesystem and every higher-level feature in the Music Player.

---

# END OF MUSIC LIBRARY ARCHITECTURE
