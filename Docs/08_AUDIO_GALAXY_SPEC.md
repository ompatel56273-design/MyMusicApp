# MUSIC PLAYER — AUDIO GALAXY SPECIFICATION

## Document Purpose

This document defines the concept, information architecture, visual behavior, interaction model, data relationships, performance requirements, navigation, accessibility, and implementation rules for the Music Player App's signature feature:

# AUDIO GALAXY

Audio Galaxy is a visual exploration system for the user's personal music collection.

It should transform a traditional music library into an interactive visual map.

The feature must feel:

- Original
- Immersive
- Intelligent
- Personal
- Calm
- Discoverable
- Visually impressive
- Useful rather than decorative

Audio Galaxy is not intended to replace the conventional Library.

It is an additional way to understand and explore the user's existing music collection.

---

# 1. CORE CONCEPT

Traditional music libraries organize music into lists and folders.

Audio Galaxy represents relationships between music entities visually.

Conceptually:

```text
                    GENRE
                      │
                      │
                   ARTIST
                 /    │    \
                /     │     \
           ALBUM    ALBUM    ALBUM
             │        │        │
           TRACK    TRACK    TRACK
             │
          PLAYLIST
```

The exact visual structure may change based on the data.

The important principle is:

> Music becomes a connected environment rather than a collection of isolated rows.

---

# 2. WHY AUDIO GALAXY EXISTS

The primary library is optimized for efficient management.

Audio Galaxy is optimized for:

- Exploration
- Discovery
- Relationship understanding
- Visual browsing
- Collection awareness
- Serendipitous navigation

It should answer questions such as:

- Which artists have the most albums?
- Which genres dominate my library?
- Which albums belong to an artist?
- Which tracks belong to an album?
- How are different parts of my collection connected?

---

# 3. AUDIO GALAXY IS LOCAL-FIRST

Audio Galaxy must primarily use the local music database.

It should not require:

- Cloud music databases
- Online recommendation engines
- External social graphs
- User tracking
- Advertising networks

The Galaxy should be generated from the user's own collection.

---

# 4. SOURCE OF TRUTH

Audio Galaxy must never maintain a completely separate copy of library relationships.

The primary source is:

```text id="c2b2dq"
Local Music Database
       ↓
Library Repository
       ↓
Galaxy Data Builder
       ↓
Galaxy Visualization
```

The Galaxy is a visualization of library data.

It is not a second music database.

---

# 5. GALAXY ENTITY TYPES

The Galaxy may represent several entity types.

Core entities:

```text id="6cb0hj"
TRACK
ALBUM
ARTIST
GENRE
PLAYLIST
FOLDER
```

Optional future entities:

```text id="70v8yw"
YEAR
FORMAT
COMPOSER
MOOD
RATING
```

Future entities should only be added if reliable data exists.

---

# 6. NODE MODEL

Each visible Galaxy entity can be represented as a node.

Conceptual structure:

```text id="n4hknh"
Node
├── ID
├── Entity Type
├── Entity Reference
├── Position
├── Size
├── Visual Style
├── Label
├── Artwork
├── Accent Color
└── Interaction State
```

The visualization layer must not duplicate the complete database record.

It should reference the underlying entity.

---

# 7. NODE TYPES

## Artist Node

Represents an artist.

Visual characteristics may include:

- Artist name
- Representative artwork
- Number of albums
- Number of tracks

---

## Album Node

Represents an album.

Possible visual information:

- Album artwork
- Album title
- Artist
- Track count

---

## Track Node

Represents an individual song.

Possible information:

- Track title
- Artist
- Album
- Duration
- Format

---

## Genre Node

Represents a genre grouping.

Possible information:

- Genre name
- Track count
- Artist count

---

## Playlist Node

Represents a user playlist.

Possible information:

- Playlist name
- Artwork
- Track count

---

## Folder Node

Represents a filesystem collection.

Possible information:

- Folder name
- Track count
- Location context

---

# 8. NODE HIERARCHY

A default hierarchy may be:

```text id="w3lq3q"
Genre
   ↓
Artist
   ↓
Album
   ↓
Track
```

But relationships should not be limited to a strict tree.

Example:

```text id="b1w0sa"
Artist
 ├── Album A
 │    ├── Track 1
 │    └── Track 2
 │
 └── Album B
      ├── Track 3
      └── Track 4

Playlist X
 ├── Track 1
 └── Track 4
```

This is why the Galaxy is better modeled as a graph rather than a simple folder tree.

---

# 9. EDGE MODEL

Connections between nodes represent meaningful relationships.

Possible edge types:

```text id="p6qeqf"
ARTIST → ALBUM
ALBUM → TRACK
GENRE → TRACK
PLAYLIST → TRACK
FOLDER → TRACK
ARTIST → TRACK
```

Edges should not exist simply to make the visualization look busy.

Every visible connection should represent actual data.

---

# 10. GRAPH PRINCIPLE

The Galaxy must represent real relationships.

Never generate fake relationships.

For example:

If two artists are not connected through any defined relationship, the system must not draw an arbitrary connection simply because it looks interesting.

---

# 11. GALAXY START VIEW

When the user first opens Audio Galaxy, the interface should provide a useful overview.

Possible overview:

```text id="z0t7c9"
                 MUSIC GALAXY

        Genre A        Genre B

              Artist A
           /     |      \
       Album   Album    Album

             Artist B
               / \
            Album Album
```

The initial view should avoid overwhelming the user with every individual track in a huge library.

---

# 12. LARGE LIBRARY STRATEGY

For large collections, do not render every entity at full visual complexity immediately.

Use progressive detail.

Example:

```text id="i0gq1v"
Zoomed Out
    ↓
Genres / Major Artists
    ↓
Zoom In
    ↓
Artists / Albums
    ↓
Zoom Further
    ↓
Albums / Tracks
```

This keeps the visualization readable and performant.

---

# 13. LEVEL OF DETAIL

The Galaxy should use multiple visual detail levels.

### Level 1 — Overview

Show:

- Genres
- Major artist clusters
- Large collections

Hide most track-level information.

### Level 2 — Exploration

Show:

- Artists
- Albums
- Main relationships

### Level 3 — Detail

Show:

- Tracks
- Playlists
- Folder relationships where useful

### Level 4 — Focus

Show detailed information for a selected entity.

---

# 14. ZOOM

Users should be able to zoom in and out.

Possible interactions:

- Mouse wheel
- Pinch
- Trackpad gesture
- Zoom controls

Zoom should change information density.

It should not simply scale every object indefinitely.

---

# 15. PAN

Users should be able to move around the Galaxy.

Panning must remain smooth.

The system should avoid excessive inertia that makes precise navigation difficult.

---

# 16. NODE SELECTION

Selecting a node should visually emphasize:

- Selected node
- Direct relationships
- Relevant neighboring nodes

Unrelated nodes may be visually de-emphasized.

Example:

```text id="5wws95"
Selected Artist
      │
 ┌────┼────┐
 ▼    ▼    ▼
Album Album Album

Other Galaxy content
        ↓
   Reduced emphasis
```

This improves graph readability.

---

# 17. NODE DETAILS

Selecting a node may open a detail panel.

For an artist:

```text id="gnhg44"
Artist

Artist Name
Albums: 8
Tracks: 124

[Play]
[Shuffle]

Albums
Tracks
```

For an album:

```text id="y47o5m"
Album Artwork

Album Name
Artist
Year
12 Tracks

[Play]
[Queue]
[Open Album]
```

The detail panel should not require leaving the Galaxy unless the user chooses to open the full entity page.

---

# 18. GALAXY SEARCH

Search should be available inside the Galaxy.

Example:

```text id="nqj8jm"
Search Galaxy

"Radiohead"
```

The system should locate matching entities.

Search results should allow:

```text id="dby5p1"
Search Result
      ↓
Focus Camera
      ↓
Highlight Node
```

---

# 19. FOCUS MODE

Focus Mode isolates a selected entity and its relevant relationships.

Example:

```text id="8l5m8p"
Artist
  │
  ├── Album A
  │     ├── Track 1
  │     └── Track 2
  │
  └── Album B
        ├── Track 3
        └── Track 4
```

This provides a clean way to explore a large collection.

---

# 20. PLAY FROM GALAXY

The Galaxy must provide actual playback actions.

Possible actions:

```text id="g1e4w8"
Play Node
Play Album
Play Artist
Play Genre
Play Playlist
Play Selection
```

Examples:

Selecting an album:

```text id="9u7x3f"
Album
 ↓
Play
 ↓
Queue Manager
 ↓
Playback Engine
```

---

# 21. GALAXY → LIBRARY NAVIGATION

Users should be able to move from the visual representation to conventional screens.

Example:

```text id="0w6hpt"
Galaxy
 ↓
Album Node
 ↓
Open Album
 ↓
Album Detail Screen
```

Similarly:

```text id="y2o7cz"
Galaxy
 ↓
Artist Node
 ↓
Open Artist
 ↓
Artist Screen
```

---

# 22. GALAXY → NOW PLAYING

A track node should support playback.

Flow:

```text id="w3mx0v"
Track Node
 ↓
Play
 ↓
Playback Engine
 ↓
Mini Player
 ↓
Now Playing
```

The Galaxy should not implement a separate player.

---

# 23. VISUAL LANGUAGE

The Galaxy should feel related to the application's overall design but have its own identity.

Recommended characteristics:

- Dark background
- Subtle atmospheric gradients
- Artwork-based highlights
- Soft node glow
- Controlled transparency
- Thin relationship lines
- Minimal labels
- Strong focus states

Avoid making it look like:

- A scientific graphing application
- A generic network diagram
- A particle wallpaper
- A game interface

It should remain a music exploration environment.

---

# 24. NODE VISUALIZATION

Nodes may vary in visual size based on meaningful properties.

For example:

```text id="d1b8rq"
Artist size
→ Number of albums/tracks

Album size
→ Track count

Genre size
→ Number of tracks
```

These mappings must remain understandable.

Do not make size changes so extreme that small entities become impossible to find.

---

# 25. ARTWORK IN GALAXY

Artwork may be used for:

- Album nodes
- Artist nodes
- Playlist nodes

Artwork should be cached.

The Galaxy must not repeatedly decode the same artwork.

---

# 26. ARTWORK FALLBACK

If artwork is unavailable:

```text id="ztdm6g"
Missing Artwork
      ↓
Generated Neutral Node
```

Possible fallback:

- Initials
- Abstract shape
- Music icon
- Dynamic safe accent

The fallback must remain visually consistent.

---

# 27. COLOR SYSTEM

Galaxy colors should use the same global design token system.

Possible semantic colors:

```text id="qf5a9f"
Artist
Album
Track
Genre
Playlist
Folder
```

However, colors should not become overly saturated.

The visual hierarchy should primarily come from:

- Size
- Position
- Focus
- Opacity
- Connection

not from a rainbow of colors.

---

# 28. DYNAMIC COLOR

Artwork-derived colors can influence selected nodes and local atmosphere.

For example:

```text id="t1b5dn"
Album Artwork
      ↓
Accent Extraction
      ↓
Node Highlight
      ↓
Local Ambient Glow
```

Global Galaxy colors must remain controlled.

---

# 29. EDGE VISUALIZATION

Edges should remain subtle.

Possible properties:

- Low opacity
- Thin lines
- Highlight on selection
- Slight animation only when useful

Avoid animated flowing particles along every connection.

This can become visually noisy and expensive.

---

# 30. GALAXY MOTION

The Galaxy may use gentle motion for:

- Camera transitions
- Node focusing
- Opening clusters
- Selection changes
- Zoom transitions

It should not continuously animate every node without purpose.

---

# 31. REDUCED MOTION

When reduced motion is enabled:

- Disable unnecessary camera movement.
- Reduce node transitions.
- Remove continuous decorative animation.
- Use immediate state changes where possible.

The Galaxy must remain usable without motion.

---

# 32. GALAXY PHYSICS

A force-directed layout may be used if appropriate.

However, physics must be controlled.

Problems to avoid:

- Nodes constantly moving
- Layout instability
- Unpredictable positions
- Excessive CPU usage
- Difficult selection

The final experience should feel stable.

---

# 33. STABLE LAYOUT

Once the Galaxy has calculated a layout, it should not constantly rearrange itself.

Possible strategy:

```text id="s4lqgx"
Build Graph
    ↓
Calculate Layout
    ↓
Cache Positions
    ↓
Render
    ↓
Update Only When Data Changes
```

This improves user orientation.

---

# 34. GRAPH CACHE

The Galaxy may cache:

- Node positions
- Layout information
- Artwork references
- Calculated statistics

The cache must be invalidated when relevant library data changes.

---

# 35. LIBRARY UPDATE

When the music library changes:

```text id="m7p5ib"
Library Changed
      ↓
Galaxy Data Invalidated
      ↓
Affected Nodes Updated
      ↓
Galaxy Refresh
```

Do not rebuild the entire Galaxy unnecessarily for every single metadata change.

---

# 36. PERFORMANCE TARGET

The Galaxy must remain responsive.

Important goals:

- Smooth pan
- Smooth zoom
- Fast selection
- Low input latency
- Controlled memory usage
- Progressive rendering

Visual effects should automatically reduce when performance becomes constrained.

---

# 37. LARGE COLLECTION PERFORMANCE

For very large libraries:

Use:

- Level-of-detail rendering
- Viewport culling
- Node clustering
- Lazy label rendering
- Cached artwork
- Incremental graph updates
- Efficient spatial indexing

Do not render thousands of high-resolution album images simultaneously.

---

# 38. GPU USAGE

If GPU-accelerated rendering is available, the Galaxy may use it.

However:

```text id="tr5k6x"
GPU acceleration
≠
Unlimited effects
```

GPU resources must be shared responsibly with:

- Audio visualization
- Artwork rendering
- Application UI

Playback always has priority.

---

# 39. GALAXY SEARCH PERFORMANCE

Search should use the existing library search/indexing system where possible.

Do not scan the filesystem every time the user searches inside the Galaxy.

Preferred:

```text id="w6v8bg"
Search Index
      ↓
Entity IDs
      ↓
Galaxy Focus
```

---

# 40. GALAXY FILTERS

Possible filters:

```text id="c1q5f6"
Genre
Artist
Album
Year
Format
Favorites
Recently Played
Playlist
```

Filters should reduce visual complexity rather than merely hiding labels.

---

# 41. FILTER EXAMPLE

Example:

```text id="ex5cwh"
Filter:
Genre = Electronic

Galaxy

Electronic
 ├── Artist A
 │    ├── Album A
 │    └── Album B
 │
 └── Artist B
      └── Album C
```

---

# 42. GALAXY SORTING

Traditional sorting is less important than spatial relationships.

However, optional controls may include:

- Most played
- Recently added
- Artist
- Album
- Genre
- Track count

Sorting should never destroy meaningful graph relationships.

---

# 43. GALAXY OVERVIEW STATISTICS

The Galaxy may show lightweight collection statistics.

Examples:

```text id="r6b4ls"
12,482 Tracks
823 Artists
1,042 Albums
34 Genres
18 Playlists
14 Audio Formats
```

Statistics must come from the actual database.

---

# 44. COLLECTION HEALTH

Optional indicators may show:

- Tracks without artwork
- Tracks without artist metadata
- Unsupported formats
- Missing files
- Duplicate candidates

These should not overwhelm the Galaxy.

Detailed management belongs in Library/Settings.

---

# 45. GALAXY EMPTY STATE

If the library is empty:

```text id="a0d3pe"
Your Galaxy is empty.

Add music to your library
to create your personal music universe.

[Open Library Settings]
```

Do not render an empty graph with meaningless decorative nodes.

---

# 46. GALAXY LOADING STATE

During graph generation:

```text id="y70fsc"
Building your Music Galaxy...

Analyzing your library
Preparing relationships
Generating layout
```

The progress must represent real operations.

Do not fake percentage values.

---

# 47. GALAXY ERROR STATE

If graph generation fails:

```text id="z9ml5f"
The Music Galaxy could not be generated.

Your music library is safe.

[Try Again]
[Return to Library]
```

The Galaxy failure must not affect:

- Library
- Playback
- Database
- Music files

---

# 48. GALAXY DATA SAFETY

The Galaxy must be read-oriented.

It must not:

- Rename files
- Move files
- Delete music
- Modify metadata automatically
- Rewrite audio
- Upload user data

Any future editing capability must be explicitly separated from visualization.

---

# 49. GALAXY PRIVACY

The Galaxy should be generated locally whenever possible.

It should not transmit:

- Artist names
- Track names
- Album names
- Folder paths
- Listening history

to external services merely to generate the visualization.

---

# 50. GALAXY ACCESSIBILITY

A purely visual graph is not sufficient.

Provide alternative access to the same information.

Possible accessibility representation:

```text id="iq11a9"
Galaxy Node List

Artist: Artist A
  Albums: 4
  Tracks: 52

Album: Album A
  Artist: Artist A
  Tracks: 12
```

Screen readers should be able to access meaningful entity information.

---

# 51. KEYBOARD NAVIGATION

Where supported:

- Tab through controls
- Arrow navigation between focused nodes
- Enter to select
- Escape to close detail panel
- Search shortcut
- Zoom controls

The graph should not become inaccessible to keyboard users.

---

# 52. TOUCH INTERACTION

On touch devices:

- Tap → Select
- Double tap → Open/play depending on platform convention
- Pinch → Zoom
- Drag → Pan
- Long press → Context menu

Important actions must remain accessible through visible controls.

---

# 53. DESKTOP INTERACTION

Desktop may support:

- Mouse hover
- Click
- Right click
- Wheel zoom
- Drag pan
- Keyboard shortcuts

Hover should provide information without becoming mandatory.

---

# 54. CONTEXT MENU

Context menu actions depend on entity type.

Artist:

```text id="1z5hce"
Play Artist
Shuffle Artist
Open Artist
```

Album:

```text id="l7m3i9"
Play Album
Shuffle Album
Open Album
Add to Queue
Add to Playlist
```

Track:

```text id="7w5gq8"
Play
Play Next
Add to Queue
Favorite
Open Album
Open Artist
Audio Info
```

---

# 55. GALAXY CAMERA

The Galaxy should have a camera/navigation layer.

Possible controls:

```text id="m6d0y7"
Zoom In
Zoom Out
Reset View
Focus Selection
Center Galaxy
```

Reset View should always provide a reliable way to recover from navigation.

---

# 56. GALAXY STATE

Possible states:

```text id="v2xk9a"
INITIALIZING
LOADING
READY
FILTERED
FOCUSED
SEARCHING
UPDATING
ERROR
```

State transitions must be deterministic.

---

# 57. GALAXY ARCHITECTURE

Recommended architecture:

```text id="vl6lqv"
Local Database
      ↓
Library Repository
      ↓
Galaxy Data Builder
      ↓
Graph Model
      ↓
Layout Engine
      ↓
Rendering Engine
      ↓
Interaction Layer
      ↓
Application Actions
```

The rendering engine must not directly query the database.

---

# 58. GALAXY DATA MODEL

Conceptually:

```text id="4y5g6u"
GalaxyGraph
│
├── Nodes[]
│    ├── id
│    ├── type
│    ├── entityId
│    ├── position
│    ├── size
│    └── visualState
│
└── Edges[]
     ├── id
     ├── source
     ├── target
     └── relationshipType
```

This model should remain lightweight.

---

# 59. GALAXY UPDATE STRATEGY

Avoid full rebuilds when unnecessary.

Example:

```text id="w8h5h2"
One new album added
      ↓
Affected artist identified
      ↓
Affected album node added
      ↓
Related edges added
      ↓
Layout partially updated
```

For major library changes, a complete rebuild may be appropriate.

---

# 60. GALAXY RELATIONSHIP RULES

Every relationship must have a defined source.

Example:

```text id="8cv4j7"
Track belongs to Album
→ Album relationship

Track belongs to Artist
→ Artist relationship

Track belongs to Genre
→ Genre relationship

Track belongs to Playlist
→ Playlist relationship
```

Do not infer uncertain relationships as facts.

---

# 61. UNKNOWN METADATA

If a track has missing metadata:

```text id="u9kjrq"
Unknown Artist
Unknown Album
Unknown Genre
```

The Galaxy may group unknown values into controlled fallback nodes.

Avoid generating dozens of visually identical "Unknown" nodes.

---

# 62. COMPILATIONS

Compilation albums require special handling.

Possible relationship:

```text id="2p9zv7"
Compilation
 ├── Artist A → Track
 ├── Artist B → Track
 └── Artist C → Track
```

The Galaxy must avoid incorrectly treating the compilation as a single artist's complete album.

---

# 63. MULTI-DISC ALBUMS

Multi-disc albums should maintain album identity.

Possible hierarchy:

```text id="c5f1df"
Album
 ├── Disc 1
 │    ├── Track 1
 │    └── Track 2
 │
 └── Disc 2
      ├── Track 1
      └── Track 2
```

The visual graph does not need to display discs as independent nodes unless useful.

---

# 64. DUPLICATES

Duplicate files must not automatically create confusing duplicate nodes.

The Galaxy should use normalized library entities.

For example:

```text id="xkq8jv"
Same Album
   ↑
Multiple file representations
```

The database should determine whether files represent the same logical track.

---

# 65. GALAXY AND FORMATS

Format information may be used as an optional filter.

Example:

```text id="9yl1xw"
Filter: FLAC

Galaxy
 ↓
FLAC tracks
 ↓
Albums
 ↓
Artists
```

Format should not normally dominate the primary graph.

---

# 66. GALAXY AND PLAY HISTORY

Playback history may optionally influence visual emphasis.

For example:

- Recently played nodes
- Frequently played nodes
- Favorite nodes

However, these should be subtle visual indicators.

Do not turn the Galaxy into a popularity chart.

---

# 67. GALAXY AND FAVORITES

Favorites may receive a subtle indicator.

Example:

```text id="t3s4l9"
Favorite Track
     ↓
Small favorite marker
```

Do not recolor the entire graph for favorite status.

---

# 68. GALAXY AND PLAYLISTS

Playlist relationships can provide cross-connections.

Example:

```text id="5c3fkw"
Artist A
   │
Album A
   │
Track 1
   │
Playlist "Driving"
```

This demonstrates why the graph can reveal relationships not obvious in a standard album hierarchy.

---

# 69. GALAXY DISCOVERY

The system may optionally provide gentle discovery prompts.

Example:

```text id="g8l1k2"
Explore this artist's albums
```

These prompts must be based on actual library relationships.

No external recommendation engine is required.

---

# 70. GALAXY VISUAL DENSITY

The visualization should adapt to graph density.

Sparse collection:

```text id="r8s3bn"
Large nodes
More labels
More spacing
```

Dense collection:

```text id="s9x7kq"
Clusters
Fewer labels
Progressive detail
```

This improves readability.

---

# 71. GALAXY CLUSTERING

Clusters may be created around:

- Genre
- Artist
- Album
- Playlist

Clusters must preserve meaningful relationships.

They should not permanently hide entities.

---

# 72. GALAXY LABELS

Labels should be adaptive.

Zoomed out:

```text id="x5d0k4"
Artist Name
```

Zoomed in:

```text id="n4k8s1"
Artist Name
Album Name
Track Name
```

Labels should disappear when they become visually excessive.

---

# 73. HOVER BEHAVIOR

Hover can display a compact preview.

Example:

```text id="8c3b6n"
Artist A
8 albums
124 tracks
```

Hover must not be required for important actions.

---

# 74. SELECTED NODE EMPHASIS

Selected nodes may receive:

- Larger visual scale
- Brighter artwork
- Accent outline
- Glow
- Neighbor highlighting

Use restrained effects.

---

# 75. GALAXY TRANSITION TO DETAIL

When opening a full detail page:

```text id="m8g0az"
Selected Node
      ↓
Context recognized
      ↓
Open Artist / Album / Track
```

The user should understand how the Galaxy relates to the destination.

---

# 76. GALAXY RESET

Users must always be able to recover the default view.

Reset should:

- Clear selection
- Remove filters
- Restore default camera
- Restore normal emphasis
- Return to overview

---

# 77. GALAXY OFFLINE OPERATION

Audio Galaxy should function without internet access as long as the local library is available.

No network connection should be required for:

- Graph generation
- Navigation
- Search
- Playback
- Node selection

---

# 78. GALAXY FAILURE ISOLATION

If the Galaxy fails:

```text id="j8r3l4"
Galaxy Failure
      ↓
Return to Library
```

It must not:

- Crash the application
- Stop playback
- Corrupt the database
- Delete cached data
- Modify source files

---

# 79. GALAXY TESTING REQUIREMENTS

Test at minimum:

### Small Library

- 10 tracks
- 2 artists
- 2 albums

### Medium Library

- Hundreds of tracks
- Dozens of artists

### Large Library

- Thousands of tracks
- Hundreds of artists

### Metadata Problems

- Missing artist
- Missing album
- Missing genre
- Missing artwork

### File Problems

- Missing file
- Duplicate file
- Unsupported format

### Interaction

- Zoom
- Pan
- Select
- Search
- Focus
- Reset
- Play

### Performance

- Large graph
- Low-memory device
- Reduced-motion mode

---

# 80. GALAXY ACCEPTANCE CRITERIA

Audio Galaxy is considered complete when:

- It represents actual library data.
- Nodes correspond to real entities.
- Edges represent real relationships.
- Search works.
- Zoom works.
- Pan works.
- Selection works.
- Focus mode works.
- Playback actions work.
- Navigation to library entities works.
- Empty states work.
- Loading states work.
- Errors are isolated.
- Accessibility alternatives exist.
- Large libraries remain usable.
- No source files are modified.
- No music is uploaded without explicit user action.
- Playback remains independent of Galaxy rendering.

---

# 81. FINAL GALAXY ARCHITECTURE

```text id="e7q4v0"
                 LOCAL MUSIC DATABASE
                          │
                          ▼
                  LIBRARY REPOSITORY
                          │
                          ▼
                 GALAXY DATA BUILDER
                          │
                          ▼
                    GRAPH MODEL
                 ┌────────┴────────┐
                 ▼                 ▼
              NODES              EDGES
                 │                 │
                 └────────┬────────┘
                          ▼
                     LAYOUT ENGINE
                          │
                          ▼
                   RENDERING ENGINE
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
           ZOOM          PAN        SELECTION
             │            │            │
             └────────────┼────────────┘
                          ▼
                    USER ACTIONS
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           LIBRARY     PLAYBACK     DETAILS
```

---

# 82. FINAL AUDIO GALAXY PRINCIPLES

The following rules are permanent:

1. Audio Galaxy is a visualization of the user's real music collection.
2. It must remain local-first.
3. It must not require online services.
4. Every node must represent real data.
5. Every relationship must represent real data.
6. No fake relationships.
7. No decorative data masquerading as information.
8. Large collections must use progressive detail.
9. Zoom must change information density.
10. Pan must remain smooth.
11. Layout should remain stable.
12. Artwork must be cached.
13. Visual effects must remain optional.
14. Reduced motion must be supported.
15. Accessibility must provide an alternative representation.
16. Galaxy rendering must never control playback directly.
17. Galaxy failure must never stop playback.
18. Galaxy failure must never corrupt library data.
19. The Galaxy must be useful even without internet.
20. The Galaxy must remain optional for users who prefer traditional library views.
21. The visual language must be original to this application.
22. The Galaxy must feel like a personal music universe, not a generic graph.

---

# 83. FINAL EXPERIENCE

The intended mental model is:

```text id="u3r5n1"
              MY MUSIC
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      ARTISTS   ALBUMS   GENRES
        │         │         │
        └────┬────┴────┬────┘
             ▼         ▼
           TRACKS   PLAYLISTS
              \       /
               \     /
                \   /
              AUDIO GALAXY
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
        EXPLORE   PLAY     DISCOVER
                   │
                   ▼
              NOW PLAYING
                   │
                   ▼
             AUDIO ENGINE
```

Audio Galaxy should become one of the defining characteristics of the application:

> **A visual map of the user's own music universe, generated entirely from their personal library and connected directly to real playback.**
