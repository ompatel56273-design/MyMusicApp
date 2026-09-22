# 🎵 MUSIC PLAYER — AUDIO ENGINE ARCHITECTURE

**Document:** `03_AUDIO_ENGINE_ARCHITECTURE.md`
**Version:** 1.0
**Status:** Audio Subsystem Specification
**Parent Documents:**

- `00_PROJECT_MASTER_SPEC.md`
- `01_PRODUCT_REQUIREMENTS.md`
- `02_SYSTEM_ARCHITECTURE.md`

---

# 1. PURPOSE

This document defines the architecture and behavior of the Music Player's audio engine.

The Audio Engine is one of the most critical systems in the application.

It is responsible for transforming local audio files into reliable audio playback while supporting:

- Multiple audio formats
- Decoding
- PCM/audio-frame processing
- Playback control
- Buffering
- Seeking
- DSP
- Equalization
- Volume
- Balance
- Crossfade
- Gapless playback
- Audio analysis
- Output routing
- Playback recovery
- Device lifecycle changes

The audio engine must remain independent from the user interface.

---

# 2. PRIMARY AUDIO PRINCIPLE

The most important rule is:

> **Audio playback must remain reliable even if visual features, library features, lyrics, or other UI systems fail.**

The audio engine should be treated as a critical subsystem.

Conceptually:

```text
                         AUDIO ENGINE
                              │
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
       Decoder               DSP              Output
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ↓
                       Playback Manager
                              │
                              ↓
                         Application
                              │
                              ↓
                              UI
```

---

# 3. AUDIO DATA PIPELINE

Normal playback should conceptually follow:

```text
Audio File
    ↓
File Reader
    ↓
Format / Codec Detection
    ↓
Decoder
    ↓
Decoded Audio Frames
    ↓
PCM / Internal Audio Representation
    ↓
DSP Pipeline
    ↓
Audio Buffer
    ↓
Audio Output
    ↓
Device / Headphones / Bluetooth / External Output
```

---

# 4. RESPONSIBILITIES

The Audio Engine is responsible for:

- Opening audio sources.
- Selecting a decoder.
- Decoding audio.
- Managing audio buffers.
- Seeking.
- Processing DSP.
- Controlling playback.
- Feeding the audio output.
- Reporting playback state.
- Reporting technical information.
- Handling decoder errors.
- Handling output errors.
- Supporting output-device changes.

The Audio Engine is NOT responsible for:

- Rendering buttons.
- Rendering album artwork.
- Managing playlists.
- Rendering lyrics.
- Rendering the Audio Galaxy.
- Direct database management.

---

# 5. AUDIO ENGINE MODULES

Recommended structure:

```text
AUDIO ENGINE
│
├── AudioSource
│
├── FormatDetector
│
├── DecoderManager
│   ├── Decoder A
│   ├── Decoder B
│   └── Decoder C
│
├── PCM Pipeline
│
├── BufferManager
│
├── DSP Engine
│   ├── Volume
│   ├── Preamp
│   ├── Equalizer
│   ├── Balance
│   ├── Normalization
│   ├── Effects
│   └── Limiter
│
├── AudioAnalyzer
│
├── OutputManager
│
└── PlaybackEngine
```

The exact decoder implementation depends on the target platform and selected libraries.

---

# 6. AUDIO SOURCE

An AudioSource represents the media being played.

It should contain or provide access to:

```text
File Path
File Size
Format
Codec
Duration
Metadata
```

It should not own the entire playback process.

---

# 7. FORMAT DETECTION

The system must determine the actual media format.

Do not rely exclusively on the filename extension.

Conceptually:

```text
File
 ↓
Extension Check
 ↓
Container / Header Detection
 ↓
Codec Detection
 ↓
Playable?
```

If the extension says:

```text
.mp3
```

but the file content is invalid, the engine must detect the failure safely.

---

# 8. DECODER MANAGER

The DecoderManager chooses an appropriate decoder.

Conceptually:

```text
Audio File
     ↓
Format Detection
     ↓
Decoder Manager
     ↓
Compatible Decoder
     ↓
Decoded Frames
```

The DecoderManager should hide decoder-specific details from the rest of the application.

---

# 9. DECODER ABSTRACTION

All decoders should expose a consistent conceptual interface.

Required capabilities may include:

```text
Open
Read
Seek
Get Duration
Get Format
Get Sample Rate
Get Channels
Get Bit Depth
Close
```

This allows the rest of the audio engine to remain independent from a specific codec implementation.

---

# 10. SUPPORTED FORMAT STRATEGY

The application should aim for broad support.

Potential formats:

```text
MP3
FLAC
WAV
AAC
M4A
OGG
OPUS
AIFF
WMA
ALAC
APE
```

Actual availability depends on the platform and decoder backend.

The application must maintain an explicit capability map.

Example:

```text
Format
 ↓
Supported?
 ↓
Decoder Available?
 ↓
Playable?
```

---

# 11. FORMAT CAPABILITY STATES

A media file may have one of these states:

```text
SUPPORTED
UNSUPPORTED
CORRUPTED
UNAVAILABLE
DECODER_ERROR
PERMISSION_DENIED
```

These states should be distinguishable where practical.

---

# 12. PCM REPRESENTATION

Decoded audio should enter a consistent internal representation.

Conceptually:

```text
Compressed Audio
       ↓
Decoder
       ↓
PCM / Internal Audio Frames
```

Typical properties:

```text
Sample Rate
Channel Count
Sample Format
Frame Count
```

The engine may use another internal representation if required by the chosen platform.

The rest of the pipeline should not need to understand codec-specific packet formats.

---

# 13. SAMPLE RATE HANDLING

Different files may have different sample rates.

Examples:

```text
44.1 kHz
48 kHz
88.2 kHz
96 kHz
192 kHz
```

The engine must handle differences safely.

If output hardware requires resampling:

```text
Decoded Audio
      ↓
Resampler
      ↓
Output-Compatible Audio
```

Do not unnecessarily resample when the native output path can handle the source format directly.

---

# 14. CHANNEL HANDLING

Possible configurations:

```text
Mono
Stereo
Multi-channel
```

The engine must know the source channel layout.

If conversion is required:

```text
Source Channels
      ↓
Channel Mapper
      ↓
Output Channels
```

Channel mapping must not accidentally duplicate, remove, or invert channels.

---

# 15. BIT DEPTH / SAMPLE FORMAT

Potential source formats include:

```text
16-bit
24-bit
32-bit
Floating point
```

The engine should preserve quality where practical.

Internal processing may use a standardized format for DSP.

Conversion should be deliberate rather than accidental.

---

# 16. PLAYBACK MANAGER

The Playback Manager is the application's authoritative controller for playback.

It should control:

```text
Play
Pause
Stop
Seek
Next
Previous
Speed
Shuffle
Repeat
Volume
Queue
```

The UI communicates with the Playback Manager rather than the decoder directly.

---

# 17. PLAYBACK STATE MACHINE

Playback should have explicit states.

Conceptually:

```text
IDLE
 │
 ↓
LOADING
 │
 ↓
READY
 │
 ↓
PLAYING
 │
 ├────→ PAUSED
 │        │
 │        └────→ PLAYING
 │
 ├────→ SEEKING
 │        │
 │        └────→ PLAYING
 │
 └────→ ERROR
           │
           └────→ IDLE / RECOVERY
```

Avoid ambiguous playback states.

---

# 18. PLAYBACK STATE

Central state should include:

```text
Current Track
Playback Status
Position
Duration
Buffered Position
Volume
Playback Speed
Shuffle
Repeat
Current Output
Error
```

All player-related UI should observe the same state.

---

# 19. SINGLE PLAYBACK ENGINE

There must be one authoritative playback engine.

Do NOT create:

```text
Home Audio Player
Library Audio Player
Player Screen Audio Player
Notification Audio Player
```

Instead:

```text
                Playback Engine
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
      Home         Player     Notification
```

All interfaces control the same playback session.

---

# 20. BUFFERING

The engine must maintain enough audio data to avoid playback interruptions.

Conceptually:

```text
Decoder
   ↓
Decode Buffer
   ↓
DSP
   ↓
Output Buffer
   ↓
Audio Hardware
```

Buffer sizes should be configurable internally where appropriate.

Avoid excessively large buffers because they can increase:

- Memory usage
- Seek latency
- Track-change latency

Avoid excessively small buffers because they can cause:

- Underruns
- Stuttering
- Playback instability

---

# 21. BUFFER UNDERRUN

If the decoder cannot provide data quickly enough:

```text
Decoder
   ↓
Buffer Empty
   ↓
Underrun
```

The engine should:

1. Detect the underrun.
2. Attempt recovery.
3. Avoid crashing.
4. Report diagnostics.
5. Resume playback if possible.

---

# 22. PRELOADING

The engine may preload the next track where practical.

Example:

```text
Current Track
     │
     ├── Playing
     │
     └── Next Track
            ↓
         Preload
```

Preloading should be carefully bounded to avoid excessive memory use.

---

# 23. GAPLESS PLAYBACK

For compatible formats:

```text
Track A
████████████████
                 ↓
              Track B
```

There should be no unintended silence between tracks.

Gapless playback must depend on decoder/output capabilities.

If true gapless playback is impossible:

- Do not pretend it is gapless.
- Use the best supported transition.

---

# 24. CROSSFADE

Crossfade should be implemented as an optional DSP/output transition.

Conceptually:

```text
Track A
██████████████
          ███████████
             Track B
```

During the overlap:

```text
A Volume ↓
B Volume ↑
```

Crossfade must not be enabled automatically unless the user chooses it or the product design explicitly defines a default.

---

# 25. SEEKING

Seeking should support:

```text
Forward
Backward
Tap progress position
Drag progress slider
```

Flow:

```text
User Seeks
    ↓
Playback Manager
    ↓
Decoder Seek
    ↓
Buffer Reset
    ↓
DSP State Reset if Required
    ↓
Resume
```

Seeking must not leave stale decoded audio in the output buffer.

---

# 26. SEEK ACCURACY

Seek behavior depends on codec capabilities.

For compressed formats:

```text
Requested Position
        ↓
Nearest Seek Point
        ↓
Decoder
        ↓
Decode Forward
        ↓
Exact Playback Position
```

The UI should display the resulting actual position.

---

# 27. VOLUME

Volume control should be separate from file decoding.

Conceptually:

```text
Decoded Audio
      ↓
DSP Volume
      ↓
Output
```

If platform-level volume control exists, the application should integrate with it rather than attempting to replace it unnecessarily.

---

# 28. BALANCE

Balance control should adjust left/right channel levels.

Example:

```text
Left  ←────●────→ Right
          Center
```

Balance must not alter channel routing incorrectly.

---

# 29. PREAMP

Preamp should operate before final output limiting.

Conceptually:

```text
Audio
 ↓
Preamp
 ↓
EQ
 ↓
Limiter
 ↓
Output
```

Avoid excessive gain that creates clipping.

---

# 30. EQUALIZER

Equalizer should be modular.

Potential bands:

```text
60 Hz
150 Hz
400 Hz
1 kHz
2.4 kHz
6 kHz
15 kHz
```

The actual number and frequencies may depend on the implementation.

The EQ engine should expose:

```text
Enable
Disable
Gain per band
Preset
Reset
```

---

# 31. LIMITER

A limiter may be used as a safety stage.

Conceptually:

```text
DSP Chain
   ↓
Limiter
   ↓
Output
```

The limiter should prevent severe digital clipping caused by excessive DSP gain.

It should not unnecessarily compress normal audio.

---

# 32. REPLAYGAIN / NORMALIZATION

If implemented:

```text
Track Loudness
       ↓
Normalization Gain
       ↓
DSP
       ↓
Output
```

The application should distinguish between:

- Track gain
- Album gain

where the underlying metadata provides that information.

---

# 33. DSP PIPELINE ORDER

A conceptual pipeline:

```text
Decoded PCM
    ↓
Channel Handling
    ↓
Resampling if required
    ↓
Preamp
    ↓
Equalizer
    ↓
Effects
    ↓
Normalization
    ↓
Limiter
    ↓
Volume
    ↓
Output
```

The exact ordering may change based on platform requirements and DSP correctness.

Any change should be documented and tested.

---

# 34. AUDIO ANALYSIS

Audio analysis must be separate from the playback output path.

```text
Decoded / Analysis Audio
       │
       ├────────→ DSP → Output
       │
       └────────→ Analyzer
                      ↓
                  Visualizer
```

The analyzer must not block playback.

---

# 35. ANALYSIS DATA

Possible analysis data:

```text
RMS
Peak
Spectrum
Frequency Bands
Waveform
Energy
Beat Information
```

Analysis resolution should be appropriate for the visualizer.

Do not calculate expensive analysis at unnecessarily high frequency.

---

# 36. VISUALIZER SAFETY

If visualizer processing becomes expensive:

```text
High CPU/GPU Usage
       ↓
Reduce Analysis Frequency
       ↓
Reduce Visual Quality
       ↓
Maintain Playback
```

Playback reliability always has higher priority.

---

# 37. OUTPUT MANAGER

OutputManager is responsible for delivering processed audio to the platform's output system.

Possible outputs:

```text
Device Speaker
Wired Headphones
Bluetooth
USB / External DAC
Other Platform Outputs
```

The output layer should hide platform-specific details from the rest of the application.

---

# 38. OUTPUT DEVICE CHANGES

When an output device changes:

```text
Output Device Changed
        ↓
Output Manager
        ↓
Reconfigure Output
        ↓
Preserve Playback State
        ↓
Continue Playback
```

If the new device cannot use the current audio configuration:

```text
Reconfigure / Resample
```

where supported.

---

# 39. HEADPHONE DISCONNECT

Where supported:

```text
Headphones Disconnected
        ↓
Platform Event
        ↓
Playback Manager
        ↓
Pause According to User Setting
```

Do not assume this behavior on platforms where the required event is unavailable.

---

# 40. BLUETOOTH HANDLING

Bluetooth output should use the platform audio routing system.

The application should not create its own low-level Bluetooth stack unless explicitly required.

---

# 41. MEDIA SESSION INTEGRATION

Where the platform supports media sessions, integrate:

```text
Play
Pause
Next
Previous
Seek
Current Track
Artwork
Playback Position
```

This enables external controls such as:

- Lock screen
- Headphone controls
- Bluetooth controls
- System media controls
- Vehicle controls where supported

---

# 42. AUDIO FOCUS

Where the platform provides audio focus:

The application should respond appropriately to:

```text
Audio Focus Gained
Audio Focus Lost
Transient Focus Loss
Duck Request
```

Possible behavior:

```text
Permanent Loss
    ↓
Pause

Transient Loss
    ↓
Pause / Duck

Focus Restored
    ↓
Resume if user settings permit
```

Exact behavior must follow platform conventions.

---

# 43. NOTIFICATION CONTROL

The notification system should control the Playback Manager.

It must not instantiate another playback engine.

```text
Notification
     ↓
Media Command
     ↓
Playback Manager
```

---

# 44. PLAYBACK SPEED

Where supported:

```text
0.5x
0.75x
1.0x
1.25x
1.5x
2.0x
```

Speed changes must not cause playback instability.

---

# 45. TIME STRETCHING

If playback speed changes while preserving pitch:

```text
Audio
 ↓
Time Stretch
 ↓
Output
```

This is optional and depends on the audio backend.

If high-quality time stretching is unavailable, the application should use the platform-supported mechanism.

---

# 46. ERROR HANDLING

Possible decoder errors:

```text
Invalid File
Unsupported Codec
Corrupt Header
Decode Failure
Unexpected EOF
Read Failure
```

Possible output errors:

```text
Output Device Unavailable
Initialization Failure
Audio Route Failure
Buffer Underrun
```

The engine must convert these into structured errors.

---

# 47. PLAYBACK ERROR RECOVERY

Example:

```text
Track A
   ↓
Decoder Error
   ↓
Playback Manager
   ↓
Record Error
   ↓
Release Decoder
   ↓
Attempt Recovery
```

If recovery fails:

```text
Skip Track
   ↓
Load Next Track
```

The user should receive an understandable message.

---

# 48. CORRUPTED FILE HANDLING

A corrupted file must never crash the entire application.

Example:

```text
Corrupt Track
      ↓
Decoder Failure
      ↓
Mark Playback Failed
      ↓
Offer Skip
      ↓
Continue Queue
```

The original file should not be modified automatically.

---

# 49. UNSUPPORTED FORMAT

If no decoder exists:

```text
Unsupported Format
      ↓
Playback Failure
      ↓
Clear User Message
```

Example:

> This audio format is not supported by the current audio engine.

Do not present an ordinary "file corrupted" message if the actual issue is lack of decoder support.

---

# 50. FILE DISAPPEARS DURING PLAYBACK

If a file is deleted or moved:

```text
File Access Failure
      ↓
Playback Manager
      ↓
Stop / Skip
      ↓
Mark Track Missing
      ↓
Library Refresh
```

Do not crash.

---

# 51. RESOURCE RELEASE

When changing tracks:

```text
Current Decoder
      ↓
Flush / Stop
      ↓
Release Resources
      ↓
Open New Decoder
```

Avoid retaining unnecessary resources from the previous track.

---

# 52. DECODER REUSE

Decoder reuse may be used where supported and beneficial.

However:

- Do not reuse a decoder if it risks stale state.
- Do not sacrifice reliability for micro-optimization.
- Measure before introducing complex reuse.

---

# 53. MEMORY SAFETY

Audio engine must carefully manage:

- Decode buffers
- Output buffers
- DSP buffers
- Analyzer buffers
- Artwork-independent playback resources

Never retain full decoded versions of long tracks unnecessarily.

Streaming decode is preferred.

---

# 54. LARGE AUDIO FILES

The engine must support large files without loading the entire file into memory.

Example:

```text
2 GB WAV
     ↓
Stream / Chunked Decode
     ↓
Small Working Buffers
     ↓
Output
```

Memory usage should depend primarily on buffer configuration rather than total file size.

---

# 55. HIGH-RESOLUTION AUDIO

Potential files:

```text
24-bit / 44.1 kHz
24-bit / 48 kHz
24-bit / 96 kHz
24-bit / 192 kHz
```

The engine should preserve source quality where the platform/output path supports it.

Do not claim bit-perfect output unless it has actually been verified.

---

# 56. BIT-PERFECT PRINCIPLE

If the product eventually offers a "Bit-Perfect" mode:

It must mean that the application avoids unnecessary DSP/resampling when the output path permits it.

Do not label a mode "Bit-Perfect" simply because the source file is lossless.

---

# 57. GAPLESS + DSP INTERACTION

Gapless playback and DSP must be carefully coordinated.

Potential issue:

```text
Track A
 ↓
DSP State
 ↓
Track B
```

The engine must ensure that:

- DSP state does not create unwanted gaps.
- Crossfade does not accidentally occur in gapless mode unless intended.
- Buffer transitions are clean.

---

# 58. TRACK TRANSITION

Normal transition:

```text
Track A
    ↓
Track Completed
    ↓
Queue Manager
    ↓
Track B
    ↓
Playback Manager
    ↓
Audio Engine
```

The transition must update:

- Current track
- Metadata
- Artwork
- Theme
- Lyrics
- Queue
- History
- Notification

These updates should be event-driven rather than manually coordinated by each screen.

---

# 59. AUDIO ENGINE EVENTS

Useful events:

```text
PLAYBACK_STARTED
PLAYBACK_PAUSED
PLAYBACK_RESUMED
PLAYBACK_STOPPED
TRACK_CHANGED
POSITION_CHANGED
TRACK_COMPLETED
SEEK_STARTED
SEEK_COMPLETED
BUFFERING
BUFFER_READY
OUTPUT_CHANGED
PLAYBACK_ERROR
```

Events should have stable definitions.

---

# 60. POSITION UPDATE FREQUENCY

The UI does not need to receive an expensive high-frequency database update for every audio frame.

Use separate concepts:

```text
Real-Time Audio Position
        ↓
Playback UI Position

Occasional Persistence
        ↓
Saved Resume Position
```

Do not write the playback position to the database every few milliseconds.

---

# 61. THREADING / EXECUTION

Audio processing should use appropriate platform audio mechanisms.

Heavy non-audio work should not block the audio callback.

Avoid performing:

```text
Database Query
Filesystem Scan
Network Request
Artwork Decode
Large Allocation
```

inside a time-critical audio callback.

---

# 62. REAL-TIME AUDIO RULE

The audio callback/path must remain lightweight.

Never perform unpredictable operations such as:

- Blocking filesystem access
- Network calls
- Long database queries
- Large memory allocations
- Complex UI operations

inside the real-time audio path.

---

# 63. AUDIO ENGINE AND UI BOUNDARY

Correct:

```text
UI
 ↓
Playback Command
 ↓
Playback Manager
 ↓
Audio Engine
```

Incorrect:

```text
UI
 ↓
Decoder.Read()
```

The UI must never depend on decoder internals.

---

# 64. AUDIO ENGINE AND DATABASE BOUNDARY

Correct:

```text
Playback Manager
 ↓
Track Repository
 ↓
Database
```

The decoder should receive an AudioSource rather than querying the database.

---

# 65. AUDIO ENGINE AND FILESYSTEM BOUNDARY

The audio engine should use a controlled AudioSource/FileReader abstraction.

Avoid scattering direct filesystem calls through decoder code.

---

# 66. TESTING REQUIREMENTS

Audio engine testing should include:

### Format Tests

- MP3
- FLAC
- WAV
- AAC
- M4A
- OGG
- OPUS
- Other supported formats

### Playback Tests

- Play
- Pause
- Resume
- Seek
- Next
- Previous
- Shuffle
- Repeat

### Edge Tests

- Corrupt file
- Missing file
- Zero-length file
- Very large file
- Unsupported codec
- Rapid track changes
- Repeated seeking

---

# 67. LONG-DURATION TEST

The engine should eventually be tested for extended playback.

Potential target:

```text
1 hour
4 hours
8 hours
12+ hours
```

Observe:

- Memory growth
- Playback stability
- Decoder stability
- Buffer behavior
- Resource leaks

---

# 68. RAPID CONTROL TEST

Test sequences such as:

```text
Play
Pause
Play
Next
Previous
Seek
Next
Pause
Next
Play
```

rapidly.

The engine must not enter inconsistent states.

---

# 69. RAPID TRACK CHANGE TEST

Test:

```text
Track A
 ↓
Track B
 ↓
Track C
 ↓
Track D
```

quickly.

The final selected track must become authoritative.

Old decoder operations must not overwrite newer playback state.

---

# 70. SEEK STRESS TEST

Test repeated:

```text
0:05
2:30
0:10
4:50
1:20
End
Middle
Start
```

The decoder must not leave stale buffers.

---

# 71. OUTPUT CHANGE TEST

Where platform support exists:

```text
Speaker
 ↓
Bluetooth
 ↓
Wired
 ↓
Speaker
```

Playback state should remain correct.

---

# 72. PERFORMANCE PRIORITY

Priority order:

```text
1. Playback correctness
2. Playback stability
3. Audio quality
4. Low latency
5. Memory efficiency
6. CPU efficiency
7. Visual synchronization
```

Visual effects must never take priority over stable playback.

---

# 73. BATTERY PRIORITY

When playback is active:

- Avoid unnecessary analysis.
- Avoid excessive visualizer updates when not visible.
- Avoid redundant database writes.
- Avoid repeated file access.
- Avoid unnecessary network activity.

---

# 74. AUDIO ENGINE DIAGNOSTICS

The engine should optionally expose diagnostic information:

```text
Decoder
Format
Codec
Sample Rate
Channels
Bit Depth
Output Device
DSP State
Buffer State
Playback State
Error State
```

Diagnostics are primarily for development and troubleshooting.

Do not expose unnecessary technical complexity to ordinary users.

---

# 75. AUDIO ENGINE API CONCEPT

The application-level interface should conceptually provide:

```text
load(track)
play()
pause()
resume()
stop()
seek(position)
next()
previous()
setVolume(value)
setSpeed(value)
setShuffle(value)
setRepeat(mode)
getState()
getAudioInfo()
```

The exact API depends on the implementation language/framework.

---

# 76. AUDIO ENGINE NON-GOALS

The Audio Engine should not:

- Manage UI screens.
- Manage album artwork UI.
- Manage playlists directly.
- Perform database queries unrelated to playback.
- Download music.
- Display advertisements.
- Control the Audio Galaxy renderer.
- Own application navigation.

---

# 77. GOLDEN AUDIO RULES

### Rule 1

**One authoritative playback engine.**

### Rule 2

**Never block the real-time audio path.**

### Rule 3

**Never let UI code directly control decoder internals.**

### Rule 4

**A broken media file must not crash the application.**

### Rule 5

**Playback must have priority over visualization.**

### Rule 6

**Do not load entire large audio files into memory unnecessarily.**

### Rule 7

**Do not claim format support without actual decoder support.**

### Rule 8

**Do not claim bit-perfect output without verification.**

### Rule 9

**Keep DSP modular.**

### Rule 10

**Keep platform-specific audio code isolated.**

---

# 78. FINAL AUDIO ARCHITECTURE

```text id="i6x7ad"
                         AUDIO ENGINE
                              │
                              ↓
                       ┌──────────────┐
                       │ Audio Source │
                       └──────┬───────┘
                              ↓
                       ┌──────────────┐
                       │Format Detect │
                       └──────┬───────┘
                              ↓
                       ┌──────────────┐
                       │DecoderManager│
                       └──────┬───────┘
                              ↓
                       ┌──────────────┐
                       │ Decode Audio │
                       └──────┬───────┘
                              ↓
                       ┌──────────────┐
                       │ PCM / Frames │
                       └──────┬───────┘
                              ↓
                 ┌─────────────────────────┐
                 │       DSP PIPELINE      │
                 │                         │
                 │ Preamp                  │
                 │ Equalizer               │
                 │ Effects                 │
                 │ Normalization           │
                 │ Limiter                 │
                 │ Volume                  │
                 └────────────┬────────────┘
                              ↓
                       ┌──────────────┐
                       │Audio Buffer  │
                       └──────┬───────┘
                              ↓
                 ┌─────────────────────────┐
                 │      OUTPUT MANAGER     │
                 └────────────┬────────────┘
                              ↓
               ┌──────────────┼──────────────┐
               ↓              ↓              ↓
            Speaker        Bluetooth       Wired
               │              │              │
               └──────────────┼──────────────┘
                              ↓
                         AUDIO OUTPUT

                    PARALLEL ANALYSIS PATH
                              │
                              ↓
                       Audio Analyzer
                              ↓
                    Waveform / Spectrum
                              ↓
                         Visualizer
```

---

# 79. FINAL IMPLEMENTATION PRINCIPLE

The Audio Engine should be built as a **stable, independent subsystem**.

The rest of the application should be able to change dramatically without requiring the audio engine to be rewritten.

For example:

```text
Change UI
    ↓
Audio Engine unaffected

Change Visualizer
    ↓
Audio Engine unaffected

Change Library UI
    ↓
Audio Engine unaffected

Change Audio Decoder
    ↓
Playback API remains stable

Change Database
    ↓
Audio Engine remains independent
```

The ultimate goal is:

> **The user should hear reliable, high-quality audio regardless of how complex or visually advanced the rest of the application becomes.**

---

# END OF AUDIO ENGINE ARCHITECTURE
