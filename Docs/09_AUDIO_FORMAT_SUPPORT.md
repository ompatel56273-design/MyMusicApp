# MUSIC PLAYER — AUDIO FORMAT SUPPORT SPECIFICATION

## Document Purpose

This document defines how the Music Player App identifies, analyzes, indexes, displays, and plays different audio formats.

The goal is to provide broad and reliable audio compatibility without making unsupported claims.

The application should support as many practical local audio formats as the active platform and audio backend can reliably decode.

The system must distinguish between:

- File extension
- Container format
- Audio codec
- Metadata format
- Actual decoder capability

An extension alone must never be treated as proof that a file is playable.

---

# 1. CORE FORMAT PHILOSOPHY

The application should follow:

```text
File
 ↓
Identify
 ↓
Inspect Container
 ↓
Identify Codec
 ↓
Check Decoder Capability
 ↓
Read Metadata
 ↓
Index
 ↓
Playback
```

The system must not assume:

```text
".xyz" = guaranteed playable
```

Instead:

```text
File
 ↓
Actual Format Detection
 ↓
Capability Check
 ↓
Playable / Unsupported / Invalid
```

---

# 2. FORMAT SUPPORT CATEGORIES

Every discovered audio file should fall into a capability state.

### Supported

The current audio backend can decode the file reliably.

### Supported With Limitations

The file can be played, but one or more advanced features may be unavailable.

Examples:

- No gapless support
- Limited metadata
- Limited seeking
- Unsupported embedded artwork type

### Detected But Unsupported

The application recognizes the format but the active decoder cannot play it.

### Invalid / Corrupt

The file appears to be an audio file but cannot be parsed or decoded correctly.

### Unknown

The application cannot confidently identify the format.

---

# 3. EXTENSION DETECTION

Common audio extensions may include:

```text
.mp3
.flac
.wav
.m4a
.mp4
.aac
.ogg
.opus
.aiff
.aif
.wma
.alac
.ape
.mka
```

This list is not a guarantee of playback support.

Extensions should be treated as an initial hint.

---

# 4. FORMAT DETECTION

Preferred detection order:

```text
File Extension
      ↓
Container Signature
      ↓
Codec Identification
      ↓
Decoder Capability
```

Where possible, the application should inspect file signatures rather than relying exclusively on filenames.

---

# 5. COMMON FORMAT MATRIX

The implementation should conceptually support investigation of the following formats:

| Format / Container | Common Codec              | Typical Use             | Support Model               |
| ------------------ | ------------------------- | ----------------------- | --------------------------- |
| MP3                | MPEG Audio Layer III      | Music                   | Decoder-dependent           |
| FLAC               | FLAC                      | Lossless music          | Decoder-dependent           |
| WAV                | PCM                       | Uncompressed audio      | Decoder-dependent           |
| M4A                | AAC / ALAC                | Music                   | Container + codec dependent |
| MP4                | AAC / ALAC / other        | Multimedia/audio        | Container + codec dependent |
| AAC                | AAC                       | Compressed audio        | Decoder-dependent           |
| OGG                | Vorbis                    | Music                   | Decoder-dependent           |
| OGG                | Opus                      | Modern compressed audio | Decoder-dependent           |
| OPUS               | Opus                      | Speech/music            | Decoder-dependent           |
| AIFF               | PCM / compressed variants | High-quality audio      | Decoder-dependent           |
| WMA                | WMA family                | Legacy Windows audio    | Decoder-dependent           |
| APE                | Monkey's Audio            | Lossless audio          | Decoder-dependent           |
| MKA                | Multiple codecs           | Matroska audio          | Decoder-dependent           |

The actual supported set must be determined by the selected platform audio backend.

---

# 6. MP3

MP3 is a common lossy audio format.

The system should support, where the backend allows:

- Playback
- Metadata
- Embedded artwork
- Duration
- Bitrate
- Sample rate
- Channel information
- Seeking

Possible metadata:

```text
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
Artwork
```

---

# 7. FLAC

FLAC is a lossless audio format.

Where supported, the application should expose:

- Lossless playback
- Sample rate
- Bit depth
- Channels
- Duration
- Embedded artwork
- Metadata
- Compression information where available

Technical information should be clearly separated from user-facing metadata.

---

# 8. WAV

WAV is a container commonly containing PCM audio.

The system should inspect:

- Sample rate
- Bit depth
- Channels
- Codec/subformat
- Duration

The application must not assume every WAV file is identical.

A WAV container can contain different audio encodings.

---

# 9. M4A / MP4

M4A and MP4 are containers that may contain different codecs.

Possible codecs include:

- AAC
- ALAC
- Other compatible audio streams

The system must identify the actual codec before declaring playback capability.

---

# 10. AAC

AAC is a codec rather than a single container format.

The application should identify:

- AAC profile where available
- Sample rate
- Channels
- Bitrate
- Container

Do not confuse an `.aac` file with AAC audio stored inside `.m4a`.

---

# 11. OGG

OGG is a container.

It may contain codecs such as:

- Vorbis
- Opus

The application must inspect the stream codec.

Example:

```text
OGG
 ├── Vorbis
 └── Opus
```

---

# 12. OPUS

Opus is a modern audio codec.

It may appear inside:

- Ogg containers
- Other supported containers

The application should identify the codec independently of the extension.

---

# 13. AIFF

AIFF is a container commonly associated with high-quality audio.

The application should inspect:

- PCM encoding
- Sample rate
- Bit depth
- Channels
- Duration

Do not assume all AIFF files are identical.

---

# 14. WMA

WMA is a family of codecs and containers.

Where the platform/backend supports WMA:

- Detect actual codec
- Read metadata
- Play normally

If unavailable:

```text
Detected format: WMA
Playback: Unsupported on this configuration
```

Do not silently ignore the file.

---

# 15. ALAC

ALAC is Apple's lossless audio codec.

It is commonly stored in an MP4/M4A container.

The application should identify:

```text
Container:
M4A / MP4

Codec:
ALAC
```

Playback support depends on the active decoder.

---

# 16. APE

APE is Monkey's Audio, a lossless format.

If supported by the backend, the application should expose:

- Lossless playback
- Technical metadata
- Duration
- Artwork where available

If unsupported, the file should still be indexed as an unsupported format rather than disappearing from the library.

---

# 17. MATROSKA AUDIO

MKA is an audio-oriented Matroska container.

Because Matroska can contain multiple codecs, the system must inspect the actual audio stream.

The application should not use the `.mka` extension as the sole capability decision.

---

# 18. LOSSLESS VS LOSSY

The library should optionally identify whether a track is:

```text
Lossless
Lossy
Uncompressed
Unknown
```

Examples:

```text
FLAC → Lossless
ALAC → Lossless
APE → Lossless
MP3 → Lossy
AAC → Lossy
Opus → Lossy
WAV PCM → Uncompressed
```

This classification should be based on actual codec information.

---

# 19. AUDIO QUALITY INFORMATION

Where available, the application should expose:

- Bitrate
- Sample rate
- Bit depth
- Channels
- Codec
- Container
- Duration
- File size

Example:

```text
FLAC
24-bit
96 kHz
Stereo
Lossless
```

Do not display technical values that were not actually detected.

---

# 20. SAMPLE RATE

Common sample rates include:

```text
44.1 kHz
48 kHz
88.2 kHz
96 kHz
176.4 kHz
192 kHz
```

The application should display the actual detected value.

Do not artificially label audio as "Hi-Res" solely because the UI wants to show a premium badge.

---

# 21. BIT DEPTH

Possible values include:

```text
16-bit
20-bit
24-bit
32-bit
```

The UI should report the source audio properties accurately.

If the decoder converts internally to another representation, distinguish source properties from processing representation.

---

# 22. CHANNEL CONFIGURATION

The system should identify:

- Mono
- Stereo
- Multi-channel

Where possible, provide actual channel count.

Example:

```text
Channels: 2
Layout: Stereo
```

Do not claim surround support unless the audio backend actually supports the stream.

---

# 23. BITRATE

For compressed formats, expose bitrate where meaningful.

Possible types:

```text
Constant Bitrate
Variable Bitrate
Average Bitrate
Unknown
```

Do not assume all compressed files have a constant bitrate.

---

# 24. VARIABLE BITRATE

For VBR formats, metadata should clearly indicate VBR when detected.

Playback duration must be calculated accurately.

Seeking should use the decoder's supported seek mechanism rather than simplistic bitrate-based calculations.

---

# 25. CONTAINER VS CODEC

This distinction is mandatory.

Example:

```text
M4A
 ↓
Container

AAC
 ↓
Codec
```

Another:

```text
OGG
 ↓
Container

Opus
 ↓
Codec
```

The UI should expose these independently where useful.

---

# 26. METADATA SUPPORT

The application should support common metadata fields.

Core:

```text
Title
Artist
Album
Album Artist
Genre
Year
Track Number
Disc Number
```

Extended:

```text
Composer
Conductor
Comment
Grouping
Copyright
Publisher
Lyrics
Compilation
Sort Artist
Sort Album
```

Only fields actually present should be displayed as populated.

---

# 27. METADATA NORMALIZATION

Different files may use different metadata conventions.

The library layer should normalize them into a consistent internal model.

Example:

```text
"ARTIST"
"Artist"
"artist"
```

may map to:

```text
Artist
```

Normalization must not automatically rewrite the source file.

---

# 28. EMBEDDED ARTWORK

The application should detect embedded artwork where supported.

Possible image types:

- JPEG
- PNG
- Other supported embedded formats

Artwork extraction should happen during library processing, not during every playback event.

---

# 29. EXTERNAL ARTWORK

If the product supports external artwork files, it may inspect common patterns.

Examples:

```text
cover.jpg
folder.jpg
album.jpg
front.jpg
```

The exact priority order should be deterministic.

External artwork should not overwrite embedded artwork automatically unless explicitly configured.

---

# 30. ARTWORK CACHE

Extracted artwork should be cached.

Conceptual flow:

```text
Audio File
    ↓
Artwork Extractor
    ↓
Artwork Cache
    ↓
Library UI
    ↓
Now Playing
    ↓
Galaxy
```

The same artwork must not be repeatedly decoded from the original file.

---

# 31. FORMAT CAPABILITY SERVICE

The application should have a central capability layer.

Conceptually:

```text
Format Capability Service
│
├── Detect Format
├── Detect Codec
├── Detect Container
├── Check Decoder
├── Check Metadata
├── Check Artwork
└── Return Capability
```

UI components should query this service instead of implementing format detection themselves.

---

# 32. CAPABILITY RESULT

A conceptual result:

```text
FormatCapability
├── extension
├── container
├── codec
├── playable
├── metadataSupported
├── artworkSupported
├── seekingSupported
├── gaplessSupported
├── lossless
└── limitations[]
```

This is an architectural model, not a mandatory programming-language structure.

---

# 33. PLAYBACK CAPABILITY

Before attempting playback, the application may verify:

```text
File Exists
    ↓
Format Detected
    ↓
Codec Detected
    ↓
Decoder Available
    ↓
Playback Attempt
```

The final authority remains the actual audio engine.

A capability check must not guarantee that a specific damaged file will successfully decode.

---

# 34. FORMAT INDEXING

The database should record detected format information.

Possible indexed fields:

```text
Extension
Container
Codec
Lossless
Sample Rate
Bit Depth
Channels
Bitrate
```

This allows the Format Explorer to operate without rescanning files.

---

# 35. FORMAT FILTERING

The user should be able to filter their library by format.

Examples:

```text
FLAC
MP3
AAC
ALAC
WAV
OPUS
```

The filter should use normalized database data.

---

# 36. FORMAT STATISTICS

The application may calculate:

```text
MP3
983 tracks

FLAC
142 tracks

AAC
214 tracks
```

Statistics must be generated from actual library records.

---

# 37. UNSUPPORTED FORMAT HANDLING

Unsupported files should remain visible when appropriate.

Example:

```text
Track Name
Artist
Format: WMA
Status: Unsupported
```

The user can inspect why playback is unavailable.

Do not silently discard unsupported files from scan results.

---

# 38. CORRUPT FILE HANDLING

A corrupt file may be classified separately:

```text
Detected
But unreadable
```

The library should retain useful metadata if it was successfully extracted.

Playback should provide an understandable error.

---

# 39. MISSING FILE HANDLING

If a previously indexed file disappears:

```text
Existing Record
      ↓
File Missing
      ↓
Mark Missing
      ↓
Library Synchronization
```

Do not immediately destroy the database record without following the library synchronization policy.

---

# 40. FILE RENAMING / MOVING

The system should attempt to detect moved files where practical.

Possible identity signals:

- File metadata
- Size
- Modification information
- Content hash where justified

Do not perform expensive full-file hashing on every scan unless necessary.

---

# 41. DUPLICATE DETECTION

Duplicate candidates may be identified using:

- File identity
- Metadata similarity
- File size
- Duration
- Content fingerprint where justified

Duplicates must not be automatically deleted.

---

# 42. MULTIPLE VERSIONS OF SAME TRACK

Users may intentionally have:

```text
Track.flac
Track.mp3
Track.ogg
```

These should not automatically be treated as unwanted duplicates.

The library may represent them as separate files or versions while grouping them logically where appropriate.

---

# 43. HIGH-RESOLUTION AUDIO

The application may encounter:

- 24-bit audio
- 96 kHz
- 192 kHz
- Other high-resolution formats

The system should preserve source information accurately.

However:

> A high sample rate does not automatically mean that the entire playback path is bit-perfect.

The UI should avoid unsupported marketing claims.

---

# 44. BIT-PERFECT AUDIO

Bit-perfect playback is highly platform-dependent.

The application should only advertise bit-perfect behavior when the complete playback path supports and verifies it.

Possible limitations include:

- OS mixer
- Audio driver
- DSP
- Volume processing
- Equalizer
- Resampling
- Output device

The application must distinguish source quality from actual output path.

---

# 45. DSP AND FORMAT INTERACTION

If DSP is enabled:

```text
Source Audio
    ↓
Decoder
    ↓
DSP
    ↓
Output
```

The application should not claim bit-perfect output when DSP modifies the signal.

---

# 46. RESAMPLING

If the output device requires a different sample rate, the audio pipeline may resample.

The UI may display:

```text
Source:
96 kHz

Output:
48 kHz
```

where reliable information is available.

Do not hide important processing information in advanced audio diagnostics.

---

# 47. MULTI-CHANNEL AUDIO

If supported, the audio engine should identify channel layout correctly.

Possible configurations:

- Mono
- Stereo
- 5.1
- 7.1
- Other supported layouts

The UI should not imply that all output devices support the original channel configuration.

---

# 48. FORMAT PREVIEW

When viewing Audio Info, the application may show:

```text
Format
FLAC

Codec
FLAC

Compression
Lossless

Sample Rate
96 kHz

Bit Depth
24-bit

Channels
Stereo

Duration
04:32
```

The values must come from actual inspection.

---

# 49. FILE EXTENSION MISMATCH

If:

```text
Filename:
song.mp3

Detected:
FLAC
```

the application should prioritize actual format detection.

It may optionally warn the user.

Do not automatically rename the file.

---

# 50. INVALID EXTENSION

If a valid audio file has an unusual extension:

```text
Actual Format:
Supported

Extension:
Unknown
```

The system may still index it if the detector can confidently identify it.

---

# 51. FORMAT ERROR MESSAGES

Errors should be specific when possible.

Examples:

```text
Unsupported codec
```

```text
Audio container could not be parsed
```

```text
File appears to be corrupted
```

```text
Decoder initialization failed
```

Avoid vague messages such as:

```text
Something went wrong.
```

unless no better information is available.

---

# 52. FORMAT SUPPORT UI

The Settings/About area may include a format support overview.

Example:

```text
Audio Support

MP3       Supported
FLAC      Supported
WAV       Supported
AAC       Supported
OPUS      Supported
WMA       Limited
APE       Limited
```

These statuses must be generated from the actual runtime capability where practical.

Do not hard-code inaccurate universal claims.

---

# 53. PLATFORM DIFFERENCES

Different platforms may have different decoder capabilities.

The architecture should therefore separate:

```text
Common Application Format Model
```

from:

```text
Platform Audio Backend
```

Example:

```text
Application
     ↓
Audio Backend Interface
     ↓
Platform Decoder
```

---

# 54. FORMAT COMPATIBILITY MATRIX

The system should be able to produce a runtime matrix:

| Capability | Format | Supported |
| ---------- | ------ | --------- |
| Detection  | FLAC   | Yes/No    |
| Playback   | FLAC   | Yes/No    |
| Metadata   | FLAC   | Yes/No    |
| Artwork    | FLAC   | Yes/No    |
| Seeking    | FLAC   | Yes/No    |
| Gapless    | FLAC   | Yes/No    |

The actual values must come from the implementation.

---

# 55. FORMAT TEST SUITE

Every supported format should have representative test files.

Tests should cover:

- Normal file
- Long file
- Short file
- Metadata-rich file
- Missing metadata
- Artwork
- No artwork
- VBR where applicable
- High-resolution audio where applicable
- Corrupt file
- Wrong extension
- Seeking
- Pause/resume
- Track completion

---

# 56. PLAYBACK TESTING

For each supported codec/container combination, verify:

```text
Load
 ↓
Decode
 ↓
Play
 ↓
Pause
 ↓
Resume
 ↓
Seek
 ↓
Stop
 ↓
Next Track
```

A format should not be considered fully supported simply because it can open.

---

# 57. GAPLESS TESTING

Where gapless playback is claimed, test with suitable consecutive tracks.

Verify:

- No unintended gap
- No overlap
- Correct track transition
- Stable metadata transition

Do not claim universal gapless behavior for every format.

---

# 58. SEEK TESTING

Test seeking:

- Near beginning
- Middle
- Near end
- Repeated seeking
- Forward
- Backward

Verify actual audio position rather than only UI position.

---

# 59. LARGE FILE TESTING

Test large files and long recordings.

The application should avoid:

- Loading entire files into memory
- Blocking the UI
- Excessive memory growth

Streaming/decoded buffering should be controlled by the audio engine.

---

# 60. FORMAT SCANNING PERFORMANCE

Library scanning should process files incrementally.

Do not load all audio files into memory.

Preferred:

```text
File 1
 ↓
Inspect
 ↓
Store
 ↓
Release

File 2
 ↓
Inspect
 ↓
Store
 ↓
Release
```

---

# 61. FORMAT DETECTION PERFORMANCE

Format detection should be lightweight.

Use only enough file data to confidently identify the format where possible.

Avoid unnecessary full-file analysis.

---

# 62. METADATA PERFORMANCE

Metadata extraction should happen in background processing.

It must not block:

- UI rendering
- Current playback
- User navigation

---

# 63. ARTWORK PERFORMANCE

Artwork extraction is potentially expensive.

Use:

- Background processing
- Cache
- Deduplication
- Size limits
- Lazy decoding

The same artwork should not be repeatedly processed.

---

# 64. MEMORY MANAGEMENT

Large artwork and audio metadata objects must be released when no longer needed.

Avoid keeping:

```text
Thousands of full-resolution artwork images
```

in memory simultaneously.

---

# 65. SECURITY

Audio file processing must be defensive.

The application should safely handle:

- Malformed containers
- Invalid metadata
- Corrupt files
- Unexpected file sizes
- Unsupported codecs

A malformed audio file must not crash the application.

---

# 66. FILESYSTEM SAFETY

Format processing must remain read-only by default.

Scanning must not:

- Rename files
- Move files
- Delete files
- Rewrite metadata
- Convert audio

unless the user explicitly invokes a separate editing operation.

---

# 67. NO AUTOMATIC CONVERSION

The Music Player is primarily a playback and library application.

It must not silently convert:

```text
FLAC → MP3
WAV → AAC
ALAC → FLAC
```

or any other format.

Conversion, if ever implemented, must be a separate explicit feature.

---

# 68. FORMAT-BASED HOME INSIGHTS

The application may optionally surface useful local statistics.

Example:

```text
Your Library

62% Lossless
31% MP3
7% Other
```

These statistics should be optional and should not turn the application into a technical benchmark dashboard.

---

# 69. FORMAT INFORMATION CONSISTENCY

The same format information should be used across:

- Library
- Format Explorer
- Audio Info
- Search filters
- Galaxy filters
- Diagnostics

There must be one normalized representation.

---

# 70. NO FAKE FORMAT BADGES

Never display:

```text
HI-RES
LOSSLESS
HQ
MASTER
```

unless the underlying data supports the classification.

A file extension alone is insufficient.

---

# 71. AUDIO FORMAT ARCHITECTURE

Final conceptual architecture:

```text
                    AUDIO FILE
                         │
                         ▼
                 FORMAT DETECTOR
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
         CONTAINER                 CODEC
             │                       │
             └───────────┬───────────┘
                         ▼
                 CAPABILITY SERVICE
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          METADATA     ARTWORK    PLAYBACK
              │          │          │
              └────┬─────┘          │
                   ▼                ▼
                DATABASE       AUDIO ENGINE
                   │                │
                   └───────┬────────┘
                           ▼
                         PLAYER
```

---

# 72. FINAL FORMAT SUPPORT RULES

The following rules are mandatory:

1. File extensions are hints, not proof.
2. Container and codec must be distinguished.
3. Actual decoder capability determines playback support.
4. Unsupported files should not silently disappear.
5. Corrupt files must be handled safely.
6. Metadata should be normalized.
7. Artwork should be cached.
8. Format information should be stored in the local database.
9. Format detection should be incremental.
10. Large audio files must not be loaded completely into memory.
11. Format scanning must not block playback.
12. Metadata extraction must run outside the real-time audio path.
13. No automatic file modification.
14. No automatic format conversion.
15. No fake quality badges.
16. High-resolution audio information must be reported accurately.
17. Bit-perfect claims require actual verification.
18. DSP processing must be distinguished from source audio quality.
19. Platform differences must be supported through backend abstraction.
20. Every claimed supported format must be tested with real files.
21. Playback support means more than opening a file; decode, pause, resume, seek, and completion must work.
22. Format capability must be centralized.
23. UI components must not implement independent format detection.
24. Security must be considered when parsing untrusted audio files.
25. The user's original audio files remain untouched by default.

---

# 73. FINAL FORMAT EXPERIENCE

The intended user experience is:

```text
                    USER'S MUSIC
                         │
                         ▼
                  FORMAT DETECTION
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           METADATA   ARTWORK    CODEC
              │          │          │
              └──────────┼──────────┘
                         ▼
                    LOCAL LIBRARY
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       LIBRARY        FORMAT INFO     SEARCH
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                    AUDIO ENGINE
                         │
                         ▼
                      PLAYBACK
```

The application should provide broad format compatibility while remaining honest about platform limitations.

The fundamental rule is:

> **Detect what the file actually is, verify what the audio backend can actually do, and only then present that capability to the user.**
