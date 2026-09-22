# MUSIC PLAYER — NOW PLAYING & PLAYER SPECIFICATION

## Document Purpose

This document defines the complete behavior, structure, interaction model, visual hierarchy, playback controls, states, gestures, queue integration, lyrics integration, visualizer integration, audio information, and performance requirements of the Music Player App's playback experience.

The Now Playing experience is one of the most important parts of the application.

It must feel:

- Immersive
- Premium
- Responsive
- Audio-focused
- Original
- Reliable
- Minimal
- Powerful

The player must never sacrifice actual playback reliability for visual effects.

---

# 1. PLAYER PHILOSOPHY

The player is not simply a collection of buttons.

It is the primary environment where the user interacts with their music.

The experience should communicate:

```text
Music
  ↓
Artwork
  ↓
Emotion
  ↓
Information
  ↓
Control
```

The current track must always remain understandable.

The user should be able to answer immediately:

- What is playing?
- Who made it?
- Where am I in the track?
- What comes next?
- Is shuffle enabled?
- Is repeat enabled?
- How do I pause?
- How do I open the queue?
- How do I access lyrics?
- How do I access audio controls?

---

# 2. PLAYER ARCHITECTURE

The playback experience must follow the architecture defined by the Audio Engine specification.

Conceptually:

```text
User Interaction
      ↓
Player UI
      ↓
Playback Controller
      ↓
Queue Manager
      ↓
Playback Manager
      ↓
Audio Engine
      ↓
Audio Output
```

The UI must NOT directly:

- Decode audio
- Manage audio buffers
- Open codec implementations
- Access raw filesystem streams
- Modify the database directly
- Perform heavy DSP operations

---

# 3. SINGLE AUTHORITATIVE PLAYBACK ENGINE

There must be exactly one authoritative playback session.

The application must not create independent playback engines for:

- Mini Player
- Now Playing
- Visualizer
- Lyrics
- Queue
- Background playback

All these systems observe the same playback state.

```text
                  PLAYBACK ENGINE
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
    Mini Player     Now Playing       Queue
        │               │                │
        └───────────────┼────────────────┘
                        ▼
                   Shared State
```

---

# 4. PLAYER STATES

The player must expose a well-defined state machine.

Core states:

```text
IDLE
LOADING
READY
PLAYING
PAUSED
SEEKING
STOPPING
ERROR
```

Possible transitions:

```text
IDLE
 ↓
LOADING
 ↓
READY
 ↓
PLAYING
 ↓
PAUSED
 ↓
PLAYING
```

Track transition:

```text
PLAYING
 ↓
NEXT
 ↓
LOADING
 ↓
READY
 ↓
PLAYING
```

Failure:

```text
LOADING
 ↓
ERROR
```

The UI must always reflect the real engine state.

---

# 5. NOW PLAYING SCREEN

The Now Playing screen should be the application's most immersive standard screen.

Conceptual structure:

```text
┌───────────────────────────────────────┐
│ Back                         More     │
│                                       │
│                                       │
│              ALBUM ART                │
│                                       │
│                                       │
│ Song Title                            │
│ Artist                                │
│ Album                                 │
│                                       │
│ ─────────────●──────────────────────  │
│ 01:42                         03:58   │
│                                       │
│      Previous  Play/Pause  Next       │
│                                       │
│ Shuffle   Repeat   Favorite   Queue   │
│                                       │
│ Lyrics        EQ        Visualizer     │
└───────────────────────────────────────┘
```

This is a conceptual structure, not a mandatory pixel layout.

---

# 6. ARTWORK

Artwork is the visual centerpiece.

Requirements:

- High-quality rendering
- Correct aspect ratio
- Appropriate caching
- Smooth transitions
- Graceful fallback when unavailable

Artwork should never cause playback to stop.

If artwork extraction fails:

```text
Artwork unavailable
      ↓
Neutral placeholder
      ↓
Playback continues
```

---

# 7. ARTWORK TRANSITIONS

When changing tracks, artwork may transition smoothly.

Possible effects:

- Fade
- Crossfade
- Scale transition
- Subtle slide
- Controlled blur transition

Do not use aggressive animations.

If the device is under load, artwork transitions may be simplified.

---

# 8. DYNAMIC ARTWORK ATMOSPHERE

The current artwork may influence the background environment.

Example:

```text
Album Artwork
      ↓
Color Extraction
      ↓
Safe Accent Generation
      ↓
Background Atmosphere
```

Possible effects:

- Soft gradient
- Ambient glow
- Subtle color field
- Background blur

The artwork itself must remain visually dominant.

---

# 9. TRACK INFORMATION

The player should display:

### Required

- Track title
- Artist

### Recommended

- Album
- Track number
- Disc number

### Optional

- Year
- Genre
- Composer

Technical metadata should not clutter the primary player.

---

# 10. LONG TRACK TITLES

Long titles must never break the layout.

Possible behavior:

- Wrap to two lines
- Ellipsis
- Controlled scrolling where appropriate

Do not allow text to overlap controls.

---

# 11. ARTIST AND ALBUM NAVIGATION

Artist and album information should be interactive where supported.

Example:

```text
Tap Artist
    ↓
Artist Detail
```

```text
Tap Album
    ↓
Album Detail
```

This provides natural exploration without requiring global search.

---

# 12. PROGRESS BAR

The progress bar must reflect real playback position.

It should support:

- Tap seeking
- Drag seeking
- Accurate position
- Current time
- Remaining time or duration

Example:

```text
00:42 ─────────────●──────────── 04:12
```

The visual position must be driven by playback state.

---

# 13. SEEKING

When the user begins seeking:

```text
PLAYING
   ↓
SEEKING
   ↓
Target Position
   ↓
Seek Engine
   ↓
PLAYING
```

The UI should clearly communicate the target position.

Seeking should not create multiple conflicting seek operations.

If the user drags continuously, the application should avoid flooding the audio engine with unnecessary operations.

---

# 14. PLAY / PAUSE

The central playback button should have the strongest control emphasis.

Behavior:

```text
PLAYING → Pause
PAUSED  → Play
READY   → Play
```

The icon must always reflect the actual state.

Do not display Play while the engine is still actively playing.

---

# 15. PREVIOUS TRACK

Previous behavior should be configurable.

Typical behavior:

If playback position is beyond a threshold:

```text
Previous
→ Restart current track
```

If near the beginning:

```text
Previous
→ Previous queue item
```

The threshold should be configurable where appropriate.

---

# 16. NEXT TRACK

Next should:

1. Request the next item from the Queue Manager.
2. Load the next track.
3. Start playback according to playback settings.

If no next track exists:

```text
End of queue
```

The application should follow the selected repeat behavior.

---

# 17. SHUFFLE

Shuffle must operate on the queue model, not randomly manipulate UI rows.

Possible states:

```text
Shuffle OFF
Shuffle ON
```

Shuffle behavior should be deterministic within the current playback session where possible.

The user should not unexpectedly hear the same track repeatedly unless the queue configuration permits it.

---

# 18. REPEAT

Supported conceptual states:

```text
Repeat OFF
Repeat ALL
Repeat ONE
```

The visual indicator must clearly communicate the active state.

---

# 19. FAVORITE

The favorite control should be immediately accessible.

Behavior:

```text
Not Favorite
      ↓
Favorite
```

The state should update through the application's data layer.

The UI should optimistically respond only when the underlying operation is safely recoverable.

---

# 20. QUEUE ACCESS

The queue must always be easily accessible from Now Playing.

Queue should show:

```text
Current
Next
Upcoming
```

The queue must reflect the actual playback order.

If shuffle is active, the displayed queue should clearly communicate the effective order.

---

# 21. QUEUE EDITING

Users may:

- Reorder tracks
- Remove tracks
- Play a specific track
- Clear upcoming tracks
- Save queue as playlist

The currently playing track should remain stable during ordinary queue edits.

---

# 22. MINI PLAYER

The Mini Player is the persistent playback surface.

It should display:

```text
Artwork
Track
Artist
Play/Pause
Next or Open Player
```

The exact controls may vary by platform.

The Mini Player should remain visible across library navigation while playback is active.

---

# 23. MINI PLAYER → NOW PLAYING

Tapping the Mini Player should open the full Now Playing screen.

The transition should visually connect the two states.

Possible:

```text
Mini Artwork
      ↓
Expands
      ↓
Full Artwork
```

The transition must remain optional/reducible under reduced-motion settings.

---

# 24. BACKGROUND PLAYBACK

Playback must continue when the user:

- Navigates to another screen
- Browses the library
- Opens settings
- Locks the device where platform support exists
- Switches applications where platform support exists

Background playback must not depend on the Now Playing screen remaining mounted.

---

# 25. SYSTEM MEDIA CONTROLS

Where supported by the platform, integrate with:

- Play
- Pause
- Next
- Previous
- Seek
- Current track metadata
- Artwork
- Playback state

System media controls must control the same authoritative playback engine.

---

# 26. HEADPHONE EVENTS

Where supported:

### Headphones disconnected

Possible behavior:

```text
Pause playback
```

This should follow user-configurable platform behavior.

### Headphones connected

The application should not automatically start playback unless the user explicitly enables that behavior.

---

# 27. BLUETOOTH / EXTERNAL AUDIO

The player should react appropriately to external audio devices.

Examples:

- Bluetooth headphones
- Bluetooth speakers
- Wired headphones
- USB audio devices

The application should expose output information where the platform allows it.

---

# 28. AUDIO FOCUS

When another application requests audio focus:

Possible behavior:

```text
Pause
Duck Volume
Resume
```

The exact behavior should follow platform capabilities and user settings.

The player must not fight another application's audio session.

---

# 29. VOLUME

Where platform control is available, the player may expose:

- System volume
- App-level volume
- Preamp

Do not create dangerous amplification defaults.

If software gain exceeds normal levels, provide appropriate safeguards.

---

# 30. BALANCE

A balance control may be provided:

```text
Left ─────●───── Right
```

Default:

```text
Center
```

Changes should be reversible.

---

# 31. REPLAYGAIN / NORMALIZATION

If supported by the audio engine, provide:

- Track gain
- Album gain
- Normalization mode

The UI must clearly distinguish normalization from equalization.

---

# 32. EQUALIZER ACCESS

The Now Playing screen may expose an Equalizer shortcut.

The shortcut should open the dedicated EQ interface.

The Now Playing screen should not contain dozens of EQ controls.

---

# 33. LYRICS ACCESS

If lyrics exist, provide an obvious entry point.

Possible states:

```text
Lyrics Available
Lyrics Not Available
Lyrics Loading
```

Do not display an empty lyrics interface when no lyrics exist.

---

# 34. SYNCHRONIZED LYRICS

If timestamps are available:

```text
Previous Line
Current Line
Next Line
```

The current line should be visually emphasized.

Scrolling should follow playback without fighting manual user interaction.

---

# 35. MANUAL LYRICS SCROLL

If the user manually scrolls:

- Temporarily reduce automatic scrolling.
- Provide a return-to-current-line action.
- Resume synchronization when appropriate.

---

# 36. VISUALIZER ACCESS

The visualizer should be accessible from Now Playing without replacing basic controls.

The user should be able to switch between:

```text
Player
Visualizer
Lyrics
```

without disrupting playback.

---

# 37. AUDIO INFORMATION ACCESS

Audio Info should be available through a secondary action.

The user can inspect:

```text
Format
Codec
Bitrate
Sample Rate
Bit Depth
Channels
Duration
File Size
File Location
```

The information must come from actual file metadata/analysis.

---

# 38. SLEEP TIMER

Sleep Timer should support time-based playback stopping.

Example:

```text
Sleep Timer

15 min
30 min
45 min
60 min
End of Track
Custom
```

When active, Now Playing should provide a visible indicator.

---

# 39. PLAYBACK SPEED

Playback speed should be available where supported.

Examples:

```text
0.75×
1.0×
1.25×
1.5×
2.0×
```

The UI should clearly indicate the active speed.

The audio engine must actually apply the speed.

---

# 40. CROSSFADE

If supported:

```text
Crossfade
OFF
3 sec
5 sec
8 sec
10 sec
```

Crossfade should be handled by the audio engine.

The UI must not simulate crossfade through animation.

---

# 41. GAPLESS PLAYBACK

For compatible audio formats and playback paths, gapless playback should minimize unintended silence between tracks.

The player UI does not need to expose technical complexity.

The user should simply experience continuous playback.

---

# 42. PLAYBACK ERRORS

If a track fails:

```text
Track failed
      ↓
Display understandable error
      ↓
Offer:
Retry
Skip
Audio Info
```

The player should not become permanently stuck.

---

# 43. CORRUPT FILE

For corrupt audio:

```text
Cannot decode this file
```

Possible actions:

- Retry
- Skip
- View Audio Info
- Open File Location

The original file must not be modified automatically.

---

# 44. UNSUPPORTED FORMAT

If a format cannot be decoded:

```text
This audio format is not currently supported.
```

Do not claim that every listed extension is guaranteed to work on every platform.

Actual support must come from the active audio backend.

---

# 45. MISSING FILE

If the library references a file that no longer exists:

```text
File unavailable

The original audio file could not be found.
```

The library should preserve useful metadata until the next library synchronization removes or marks the record appropriately.

---

# 46. PLAYBACK HISTORY

After successful playback according to configured history rules, record:

- Track ID
- Timestamp
- Playback duration where useful
- Completion status where useful

History must not block playback.

---

# 47. RESUME PLAYBACK

The player may remember playback position.

Example:

```text
Track
Position: 02:17
```

When resumed, playback can continue from that position.

The user should have control over resume behavior.

---

# 48. AUTOMATIC ADVANCE

When a track ends:

```text
Track Finished
      ↓
Queue Manager
      ↓
Next Track
```

The player must respect:

- Repeat
- Shuffle
- Queue state
- End-of-queue behavior

---

# 49. PLAYER NOTIFICATIONS

Notifications should only communicate meaningful playback information.

Examples:

- Track changed
- Playback paused
- Playback resumed
- Scan completed

Avoid unnecessary notification spam.

---

# 50. PLAYER GESTURES

Where appropriate, support intuitive gestures.

Potential gestures:

```text
Swipe artwork
→ Next / Previous

Swipe Mini Player
→ Playback navigation

Drag progress
→ Seek

Swipe queue item
→ Remove
```

Gestures must never be the only way to perform important actions.

---

# 51. PLAYER KEYBOARD CONTROLS

On platforms with keyboard input, provide familiar controls where possible.

Examples:

```text
Space
→ Play / Pause

Previous key
→ Previous

Next key
→ Next

Arrow / seek controls
→ Seek
```

Exact mappings depend on platform conventions.

---

# 52. PLAYER ACCESSIBILITY

All controls require accessible labels.

Examples:

```text
Play
Pause
Next track
Previous track
Shuffle
Repeat
Favorite
Open queue
Open lyrics
Open equalizer
Open audio information
```

Do not rely only on icons.

---

# 53. PLAYER PERFORMANCE

The player must remain responsive during:

- Artwork changes
- Lyrics synchronization
- Visualizer rendering
- Queue updates
- Library scanning

The audio engine always receives higher priority than decorative rendering.

Priority:

```text
Audio Playback
      >
Player Interaction
      >
Lyrics
      >
Artwork Effects
      >
Visualizer
```

---

# 54. REAL-TIME AUDIO RULE

No UI operation may block the real-time audio callback.

Never perform inside a real-time audio callback:

- Database queries
- File scanning
- Network requests
- Heavy allocations
- Artwork decoding
- Logging with blocking I/O
- Expensive analysis

This is an audio-engine responsibility.

---

# 55. ARTWORK FAILURE IS NOT PLAYBACK FAILURE

This rule is mandatory.

If:

```text
Artwork fails
```

then:

```text
Playback continues
```

If:

```text
Lyrics fail
```

then:

```text
Playback continues
```

If:

```text
Visualizer fails
```

then:

```text
Playback continues
```

Secondary feature failures must be isolated from core playback.

---

# 56. PLAYER STATE SYNCHRONIZATION

All playback-related UI must derive from one shared state.

Examples:

```text
Mini Player
Now Playing
Lock Screen
Notification
Queue
Visualizer
Lyrics
```

If playback changes externally, all surfaces must update.

There must not be competing playback states.

---

# 57. PLAYER EVENT MODEL

Important events may include:

```text
TrackLoaded
PlaybackStarted
PlaybackPaused
PlaybackResumed
PlaybackStopped
PlaybackCompleted
TrackChanged
SeekStarted
SeekCompleted
QueueChanged
ShuffleChanged
RepeatChanged
VolumeChanged
OutputChanged
PlaybackError
```

The UI should observe these events through the application layer.

---

# 58. PLAYER TRANSITION EXAMPLE

Typical user interaction:

```text
User selects song
      ↓
Queue Manager updates
      ↓
Playback Manager requests load
      ↓
Audio Engine loads decoder
      ↓
Audio Engine becomes READY
      ↓
Playback starts
      ↓
Player state becomes PLAYING
      ↓
Mini Player appears
      ↓
Now Playing becomes available
```

Every step should represent actual system state.

---

# 59. NOW PLAYING SCREEN PRIORITY

The screen should prioritize:

```text
1. Artwork
2. Track title
3. Artist
4. Progress
5. Play/Pause
6. Previous/Next
7. Queue
8. Shuffle/Repeat/Favorite
9. Lyrics/EQ/Visualizer
10. Technical information
```

Secondary functions should never overpower playback controls.

---

# 60. FINAL PLAYER RULES

The following rules are mandatory:

1. One authoritative playback engine.
2. Mini Player and Now Playing share the same playback state.
3. Playback must continue independently of screen navigation.
4. Artwork failure must never stop playback.
5. Lyrics failure must never stop playback.
6. Visualizer failure must never stop playback.
7. UI must reflect actual playback state.
8. Seek operations must be controlled.
9. Queue must represent actual playback order.
10. Shuffle must operate on queue logic.
11. Repeat must have clear states.
12. System media controls must connect to the same engine.
13. Background playback must not depend on the Now Playing screen.
14. Audio focus must be handled appropriately.
15. External device changes must be handled safely.
16. Unsupported and corrupt files must produce actionable errors.
17. No fake playback behavior.
18. No fake audio processing.
19. No heavy operation may block real-time audio.
20. Visual effects are always secondary to audio reliability.
21. Accessibility is mandatory.
22. Reduced motion must be respected.
23. The player must remain usable on small and large screens.
24. The player must feel premium without becoming visually overloaded.
25. The Now Playing experience must remain unmistakably original to this application.

---

# 61. FINAL PLAYER EXPERIENCE

The intended experience is:

```text
                    MUSIC
                      │
                      ▼
                   ARTWORK
                      │
                      ▼
               NOW PLAYING
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
      LYRICS         QUEUE          EQ
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                  VISUALIZER
                      │
                      ▼
                AUDIO ENGINE
                      │
                      ▼
                REAL PLAYBACK
```

The player should make the user feel that every part of the interface is connected to the same underlying music session.

The visual experience can be expressive.

The playback engine must remain authoritative.
