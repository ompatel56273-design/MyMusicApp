# MUSIC PLAYER — UI/UX DESIGN SYSTEM

## Document Purpose

This document defines the complete visual language, interaction principles, component system, responsive behavior, motion system, accessibility rules, and design consistency standards for the Music Player App.

This document is the authoritative UI/UX reference for implementation.

The application must feel:

* Premium
* Original
* Immersive
* Modern
* Minimal but powerful
* Audio-focused
* Personal
* Fast
* Calm
* Ad-free
* Visually rich without becoming distracting

The design may be conceptually inspired by high-quality music players such as Muso, but it MUST NOT copy:

* Exact layouts
* Exact component arrangements
* Branding
* Logos
* Assets
* Typography combinations
* Pixel-level spacing
* Visual identity
* Proprietary interaction patterns

The final product must have its own recognizable visual identity.

---

# 1. DESIGN PHILOSOPHY

The interface should feel like a personal audio environment rather than a generic media application.

The design should communicate:

> "This is my music space."

The UI must prioritize the music itself.

Visual hierarchy:

1. Currently playing audio
2. Album artwork
3. Song and artist information
4. Playback controls
5. Library navigation
6. Secondary information
7. Advanced tools

The interface should never allow decorative elements to overpower the music experience.

---

# 2. CORE DESIGN PRINCIPLES

## 2.1 Audio First

Every important screen should reinforce the audio experience.

Avoid unnecessary:

* Promotional banners
* Ads
* Recommendations designed to increase engagement artificially
* Excessive notifications
* Distracting animations
* Decorative UI without purpose

---

## 2.2 Local First

The interface should communicate that the user's music belongs to them.

Do not visually imitate streaming services.

Avoid unnecessary concepts such as:

* Subscription prompts
* Streaming advertisements
* Premium upsells
* Sponsored content
* "Upgrade" messaging

The application is fundamentally a personal music library.

---

## 2.3 Premium Simplicity

Premium does not mean complicated.

Use:

* Strong typography
* Large artwork
* Controlled spacing
* Subtle depth
* Clean icons
* Smooth transitions
* High-quality visual hierarchy

Avoid:

* Excessive gradients
* Excessive shadows
* Excessive borders
* Too many colors
* Overloaded dashboards
* Tiny controls

---

# 3. VISUAL IDENTITY

The primary visual identity should be based on a dark cinematic environment.

Conceptual visual structure:

```text
BACKGROUND
    ↓
Deep Black / Graphite
    ↓
Subtle Surface Layers
    ↓
Artwork / Dynamic Color
    ↓
Typography
    ↓
Controls
    ↓
Micro-interactions
```

The UI should feel similar to a dark room where the album artwork becomes the primary light source.

---

# 4. COLOR SYSTEM

## 4.1 Base Colors

Primary background:

* Near-black
* Deep graphite
* Charcoal

Suggested conceptual range:

```text
Background:
#070707
#0B0B0C
#111113
```

These values are references rather than mandatory final values.

The implementation should allow design tokens to be adjusted centrally.

---

## 4.2 Surface Colors

Different elevation levels should use subtle tonal changes instead of heavy borders.

Example conceptual hierarchy:

```text
Surface 0
→ Main background

Surface 1
→ Cards / navigation

Surface 2
→ Elevated controls

Surface 3
→ Dialogs / sheets

Surface 4
→ Focused / active elements
```

Surfaces should remain visually related.

Avoid making every component a separate gray rectangle.

---

# 5. DYNAMIC ARTWORK COLOR

Album artwork can influence the visual environment.

The application may extract dominant colors from the current artwork.

Possible dynamic properties:

* Accent color
* Secondary accent
* Background tint
* Highlight color
* Progress indicator color
* Visualizer color

Example:

```text
Album Artwork
      ↓
Color Extraction
      ↓
Color Safety Processing
      ↓
Contrast Validation
      ↓
Dynamic Theme
      ↓
UI Accent
```

Dynamic colors must NEVER destroy readability.

If an extracted color has poor contrast:

1. Reduce saturation
2. Adjust brightness
3. Blend toward a safe neutral
4. Use a fallback accent

Artwork colors should enhance the interface rather than control it completely.

---

# 6. TYPOGRAPHY SYSTEM

Typography should feel modern and premium.

Use a clean sans-serif family.

Recommended hierarchy:

```text
Display
Large page titles

Heading
Section titles

Title
Track / album titles

Body
Descriptions and metadata

Caption
Secondary metadata

Micro
Technical information
```

Typography should prioritize readability over stylistic experimentation.

---

## 6.1 Track Title

Track titles should have strong visual priority.

Example hierarchy:

```text
Song Title
Artist Name
Album Name
```

The title should be significantly more prominent than secondary metadata.

---

## 6.2 Metadata

Metadata should be visually quieter.

Examples:

* Artist
* Album
* Year
* Format
* Bitrate
* Duration
* Sample rate

Technical information should not compete with the song title.

---

# 7. SPACING SYSTEM

Use a consistent spacing scale.

Conceptual spacing:

```text
4
8
12
16
20
24
32
40
48
64
80
96
```

The exact implementation values may be adapted to the target platform.

The important rule is consistency.

Do not introduce arbitrary spacing values throughout the application.

---

# 8. CORNER RADIUS SYSTEM

Use a small number of standardized radius values.

Conceptual:

```text
Small
Controls / tags

Medium
Cards / buttons

Large
Artwork containers / sheets

Extra Large
Hero surfaces
```

Avoid excessive rounded corners.

The interface should feel sophisticated rather than cartoon-like.

---

# 9. DEPTH AND ELEVATION

Depth should primarily come from:

* Tonal contrast
* Blur
* Transparency
* Soft shadows
* Artwork lighting

Do not rely heavily on thick borders.

Preferred visual relationship:

```text
Background
    ↓
Subtle Surface
    ↓
Elevated Surface
    ↓
Focused Surface
```

The UI should maintain a sense of depth without appearing like a collection of floating boxes.

---

# 10. GLASS / TRANSLUCENT SURFACES

Glass effects may be used selectively.

Good locations:

* Mini player
* Bottom navigation
* Now Playing overlays
* Dialogs
* Context menus
* Queue sheets

Avoid applying glass effects to everything.

Too much transparency reduces hierarchy and performance.

Glass must always maintain sufficient contrast.

---

# 11. ARTWORK DESIGN

Album artwork is one of the most important visual elements.

Artwork should be displayed:

* Large
* Sharp
* Properly cropped
* Correctly aspect-preserved where appropriate
* With controlled corner radius
* With optional subtle depth

Avoid unnecessary frames around artwork.

---

## 11.1 Artwork Priority

In Now Playing:

```text
Artwork
    ↓
Song title
    ↓
Artist
    ↓
Progress
    ↓
Controls
```

In library cards:

```text
Artwork
    ↓
Title
    ↓
Secondary metadata
```

---

# 12. NAVIGATION SYSTEM

The navigation model should remain predictable.

Primary navigation may contain:

```text
Home
Library
Galaxy
Playlists
Settings
```

The exact platform-specific implementation can differ.

Navigation should always make the current location obvious.

---

# 13. HOME SCREEN DESIGN

Home should feel personal rather than algorithmically commercial.

Possible sections:

```text
Good Evening

Recently Played

Continue Listening

Recently Added

Favorites

Most Played

Albums

Quick Access
```

Sections should only appear when meaningful data exists.

Do not show empty decorative sections.

---

# 14. LIBRARY DESIGN

Library should provide multiple ways to explore music.

Possible views:

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

The user should be able to change sorting and filtering without losing context.

---

# 15. LIST DESIGN

Music lists should prioritize scanning speed.

A typical song row:

```text
[Artwork]  Song Title
           Artist • Album
           
                         Duration
```

Optional contextual action:

```text
[ ⋮ ]
```

Rows should support:

* Tap
* Long press
* Context menu
* Swipe where appropriate
* Multi-selection where supported

---

# 16. CARDS

Cards should be used for meaningful grouping.

Good uses:

* Albums
* Playlists
* Artist collections
* Recently played
* Galaxy nodes
* Feature highlights

Do not turn every piece of information into a card.

---

# 17. BUTTON SYSTEM

Primary button:

* Strong visual emphasis
* Used for important actions

Secondary button:

* Lower emphasis
* Supporting action

Tertiary button:

* Minimal visual weight

Icon button:

* Compact
* Used for frequent actions

Destructive button:

* Used only for genuinely destructive operations

Buttons should communicate hierarchy through:

* Size
* Contrast
* Placement
* Iconography

Not through excessive decoration.

---

# 18. ICONOGRAPHY

Use one consistent icon family.

Icons should have:

* Consistent stroke weight
* Consistent optical size
* Consistent alignment
* Clear semantic meaning

Avoid mixing unrelated icon styles.

Common actions:

```text
Play
Pause
Previous
Next
Shuffle
Repeat
Favorite
Queue
Search
More
Back
Forward
Volume
Lyrics
Equalizer
Visualizer
Settings
```

---

# 19. MINI PLAYER

The Mini Player is a persistent audio control surface.

It should appear when music is active.

Conceptual layout:

```text
┌─────────────────────────────────────┐
│ Artwork │ Song / Artist │ Play │ ⋮ │
└─────────────────────────────────────┘
```

The Mini Player should provide immediate access to:

* Current track
* Play/pause
* Next
* Now Playing

It must not obstruct primary navigation.

---

# 20. NOW PLAYING VISUAL LANGUAGE

Now Playing should be the most immersive screen.

It should feel substantially different from ordinary library screens.

Recommended visual layers:

```text
Artwork
   ↓
Artwork-derived atmosphere
   ↓
Track information
   ↓
Progress
   ↓
Playback controls
   ↓
Secondary controls
```

Possible secondary actions:

* Lyrics
* Queue
* Equalizer
* Audio information
* Visualizer
* Favorite
* More actions

---

# 21. BOTTOM SHEETS

Bottom sheets should be used for contextual actions.

Examples:

* Queue
* Track options
* Playlist selection
* Sort options
* Filter options
* Audio information

Sheets should:

* Clearly show their purpose
* Have an obvious dismissal mechanism
* Avoid excessive nesting
* Preserve context

---

# 22. DIALOGS

Dialogs should be reserved for decisions requiring attention.

Good examples:

* Delete confirmation
* Permission explanation
* Rename playlist
* Error requiring action
* Destructive confirmation

Do not use dialogs for ordinary navigation.

---

# 23. SEARCH EXPERIENCE

Search should be fast and visually simple.

Search should cover:

* Songs
* Artists
* Albums
* Genres
* Playlists
* Folders

Results should be grouped logically.

Example:

```text
Search

Songs
─────
...

Artists
───────
...

Albums
──────
...

Playlists
─────────
...
```

Search should not require unnecessary navigation.

---

# 24. EMPTY STATES

Empty states should explain what happened and what the user can do next.

Example:

```text
No music found

Add a music folder to begin building
your personal library.

[Choose Folder]
```

Avoid:

* Blank screens
* Generic error messages
* Fake content
* Promotional suggestions

---

# 25. LOADING STATES

Loading states should communicate progress without creating visual noise.

Use:

* Skeletons
* Progress indicators
* Subtle placeholders
* Scan progress

Avoid long blocking screens when content can load progressively.

---

# 26. ERROR STATES

Errors should be:

* Understandable
* Actionable
* Non-technical by default

Example:

```text
This audio file could not be played.

Possible reason:
The format is unsupported or the file is damaged.

[Audio Info]   [Try Again]
```

Technical diagnostics may be available separately.

---

# 27. MOTION DESIGN

Motion should make the interface feel alive without slowing it down.

Motion principles:

* Fast
* Smooth
* Purposeful
* Interruptible
* Consistent

Avoid:

* Long animations
* Constant movement
* Decorative animation during playback
* Animations that block interaction

---

# 28. TRANSITION CATEGORIES

Use standardized motion categories.

### Micro Interaction

For:

* Button press
* Favorite toggle
* Play/pause
* Slider movement

Very short.

### Navigation Transition

For:

* Page changes
* Library navigation
* Detail views

Moderate duration.

### Hero Transition

For:

* Artwork expansion
* Mini Player → Now Playing

More expressive but still controlled.

---

# 29. REDUCE MOTION

The application must respect platform accessibility settings.

When reduced motion is enabled:

* Reduce movement
* Remove unnecessary parallax
* Reduce scaling effects
* Avoid continuous animations

Functionality must remain unchanged.

---

# 30. VISUALIZER DESIGN

The visualizer should be optional.

Possible modes:

```text
Spectrum
Waveform
Bars
Circular
Particles
Minimal
```

The visualizer must never interfere with playback.

It should automatically reduce complexity when:

* Device performance is low
* Battery-saving mode is active
* User disables visual effects

---

# 31. AUDIO GALAXY VISUAL DESIGN

Audio Galaxy should have its own visual identity.

The Galaxy should feel like a living map of the user's music collection.

Possible node relationships:

```text
Artist
Album
Genre
Track
Playlist
```

Conceptual structure:

```text
             Artist
                │
        ┌───────┴───────┐
        │               │
      Album           Album
        │               │
      Track           Track
        │
      Genre
```

The visualization must remain understandable.

Avoid turning the Galaxy into an unreadable collection of animated particles.

---

# 32. RESPONSIVE DESIGN

The design system must adapt to different screen sizes.

Supported conceptual classes:

```text
Compact
Medium
Large
Wide
```

Layouts should reflow rather than simply scale down.

---

## Compact Layout

Prioritize:

* Current track
* Playback
* Navigation
* Essential actions

Hide secondary information behind contextual actions.

---

## Medium Layout

Allow:

* Larger artwork
* More metadata
* Multi-column library sections
* Expanded navigation

---

## Large Layout

Allow:

* Persistent navigation
* Multi-column content
* Large artwork
* Queue side panel
* Additional metadata

---

# 33. COMPONENT HIERARCHY

The UI should use reusable components.

Conceptual hierarchy:

```text
App Shell
 ├── Navigation
 ├── Content Area
 │    ├── Page Header
 │    ├── Sections
 │    ├── Cards
 │    └── Lists
 │
 └── Playback Layer
      ├── Mini Player
      └── Now Playing
```

Reusable components should be preferred over screen-specific duplicates.

---

# 34. DESIGN TOKENS

All visual constants should be centralized.

Token categories:

```text
Colors
Typography
Spacing
Radius
Elevation
Opacity
Motion
Icon Size
Component Height
Breakpoints
```

Changing the design system should not require manually editing every screen.

---

# 35. ACCESSIBILITY

Accessibility is mandatory.

Requirements include:

* Sufficient text contrast
* Large enough touch targets
* Clear focus states
* Screen-reader labels
* Semantic controls
* Keyboard navigation where applicable
* Reduced-motion support
* No color-only information
* Accessible error messages

Do not sacrifice accessibility for visual style.

---

# 36. TOUCH TARGETS

Interactive elements should provide comfortable touch areas.

Small icons may visually appear compact while maintaining a larger interactive region.

Do not create tiny buttons simply to make the UI look minimal.

---

# 37. FOCUS STATES

Keyboard and accessibility focus must always be visible.

Focus should use:

* Outline
* Glow
* Contrast shift
* Surface change

Never rely only on subtle color differences.

---

# 38. DARK MODE

Dark mode is the primary visual identity.

If a light theme is later implemented, it must be designed as a proper theme rather than a simple color inversion.

The architecture should support theme tokens from the beginning.

---

# 39. PERFORMANCE RULES FOR UI

The UI must remain responsive during:

* Music scanning
* Metadata extraction
* Artwork processing
* Search indexing
* Audio analysis
* Galaxy generation

Heavy work must not block the UI thread.

Animations must not consume excessive CPU/GPU resources.

The player must prioritize:

```text
Playback
>
User Interaction
>
Library Operations
>
Visual Effects
```

---

# 40. NO UI FUNCTIONALITY FRAUD

Never visually display functionality that does not actually work.

Examples of prohibited behavior:

```text
Fake EQ
Fake lyrics
Fake visualizer
Fake scan progress
Fake audio information
Fake format support
Fake AI analysis
```

If functionality is unavailable:

* Disable it
* Hide it
* Explain why

Do not simulate a completed feature.

---

# 41. AD-FREE DESIGN RULE

There must be no advertising surfaces.

Do not reserve UI space for:

* Banner ads
* Sponsored cards
* Promotional advertisements
* Interstitial ads
* Advertising placeholders

The interface should use the full available space for the user's music experience.

---

# 42. PRIVACY VISUAL LANGUAGE

The UI should communicate local ownership without making privacy messaging intrusive.

Useful settings may include:

```text
Local Library
Offline Mode
Scan Locations
Privacy
Data Storage
Cache
Diagnostics
```

The application should clearly communicate when information stays on the device.

---

# 43. CONTEXT MENUS

Context menus should provide actions relevant to the selected object.

For a song:

```text
Play
Play Next
Add to Queue
Add to Playlist
Favorite
View Album
View Artist
Audio Info
Open Folder
Remove from Library
```

For an album:

```text
Play
Shuffle
Add to Queue
Add to Playlist
Favorite
View Artist
Album Info
```

Do not show irrelevant actions.

---

# 44. MULTI-SELECTION

Large libraries may require multi-selection.

Selection should provide:

* Clear visual state
* Selection count
* Batch actions
* Cancel action

Example:

```text
3 selected

[Add to Playlist] [Queue] [Favorite] [More]
```

---

# 45. FEEDBACK SYSTEM

User actions should receive appropriate feedback.

Examples:

Favorite:

```text
Favorite icon changes state
```

Playlist addition:

```text
Short confirmation
```

Scan completed:

```text
Library update notification
```

Error:

```text
Actionable message
```

Avoid excessive toast/snackbar messages.

---

# 46. DESIGN CONSISTENCY RULE

If two components perform similar actions, they should behave similarly.

For example:

* Song menus should use consistent placement.
* Play buttons should look consistent.
* Favorite interactions should behave consistently.
* Lists should share row behavior.
* Dialogs should share structure.

Consistency reduces learning time.

---

# 47. PREMIUM IDENTITY CHECKLIST

Every major screen should pass this checklist:

```text
Does it feel premium?
Does it feel original?
Is the hierarchy obvious?
Is the music the focus?
Is the interface uncluttered?
Are controls easy to discover?
Is the typography readable?
Is artwork visually important?
Is motion purposeful?
Does it work without internet?
Does it avoid advertising?
Does it avoid unnecessary decoration?
```

---

# 48. ANTI-COPY RULE

The application must not become a visual clone of another music player.

When implementing a familiar pattern:

1. Understand the user problem.
2. Design the interaction from first principles.
3. Use the application's own visual language.
4. Avoid copying exact layouts.
5. Avoid copying proprietary visual details.
6. Prefer original component compositions.

The goal is inspiration from the quality of existing products, not replication.

---

# 49. DESIGN PRIORITY ORDER

When design decisions conflict, use this order:

```text
1. Playback usability
2. Accessibility
3. Readability
4. Performance
5. Navigation clarity
6. Visual hierarchy
7. Visual beauty
8. Decorative effects
```

Beauty must never damage usability.

---

# 50. FINAL UI/UX RULES

The implementation must follow these permanent rules:

1. Music is the primary content.
2. Album artwork is a major visual element.
3. The application must remain ad-free.
4. The interface must feel premium without being excessive.
5. Dynamic artwork colors must preserve readability.
6. Heavy visual effects must remain optional.
7. Motion must be purposeful.
8. Accessibility must be built into components.
9. Responsive layouts must be intentional.
10. Components must be reusable.
11. Design tokens must be centralized.
12. Empty states must be meaningful.
13. Loading states must communicate real progress.
14. Errors must be actionable.
15. No fake functionality.
16. No unnecessary network dependency.
17. No visual clutter.
18. No pixel-level copying of existing music players.
19. Playback always receives priority over visual effects.
20. The final interface must feel like a unique personal music environment.

---

# 51. DESIGN SYSTEM SUMMARY

The Music Player App should ultimately feel like:

```text
                 PERSONAL
                    │
                    ▼
              MUSIC LIBRARY
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
       CONTENT             PLAYBACK
          │                   │
          ▼                   ▼
      LIBRARY UI          NOW PLAYING
          │                   │
          └─────────┬─────────┘
                    ▼
              AUDIO GALAXY
                    │
                    ▼
             PERSONAL AUDIO
                ENVIRONMENT
```

The interface should not simply display music.

It should create a coherent visual environment around the user's music collection.

The result should be recognizable as its own product even when all branding and application names are removed.
