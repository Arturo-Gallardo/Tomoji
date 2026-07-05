## 2026-07-05 14:08 -07:00

- Refreshed cached desktop monitor bounds when dragging a Tomoji outside the known virtual desktop so newly connected monitors work without reloading.

## 2026-07-05 13:56 -07:00

- Restored velocity-based dragged/grabbed pose selection for Shimeji graph imports so drag direction picks left/neutral/right frames like legacy Tomojis.
- Fixed drag lean transitions so quick direction changes can reach the opposite extreme pose instead of stepping only to light lean first.

## 2026-07-05 13:45 -07:00

- Persisted the companion background debug mode globally so newly imported/spawned Tomojis match the current gray/clear toggle.

## 2026-07-05 13:30 -07:00

- Fixed runtime Tomoji scaling so the sprite image fills the scaled companion frame instead of only resizing the transparent window box.

## 2026-07-03 16:04 -07:00

- Changed Jump menu action to use target picker, then jump toward selected X position instead of playing in place.
- Allowed pickup/drag to interrupt jump and emote animations.

## 2026-07-03 16:11 -07:00

- Changed targeted jump movement from flat horizontal slide to airborne arc, landing at selected location.

## 2026-07-03 19:20 -07:00

- Removed jumping entirely from runtime behavior, companion menu, target picker, animation categories, and Shimeji import mapping.

## 2026-07-03 19:33 -07:00

- Doubled runtime movement speed multiplier so 1x movement speed is twice as fast as before.

## 2026-07-03 19:35 -07:00

- Raised Tomoji size slider max from 2x to 4x and movement speed slider max from 3x to 8x.
- Raised import wizard scale max from 2x to 4x and base speed max from 6 to 12 px/tick.

## 2026-07-03 19:54 -07:00

- Added import/editor support for PNG, JPG/JPEG, GIF, WebP, and BMP Shimeji frames while keeping PNG recommended in UI copy.
- Preserved original frame extensions when copying assigned sprites and writing manifest frame paths.

## 2026-07-03 19:58 -07:00

- Removed GIF from supported import formats because animated files conflict with Tomoji frame timing.

## 2026-07-03 20:05 -07:00

- Added per-Tomoji toggles for random walking, sitting, wall climbing, ceiling crawling, and dialogue.
- Stopped auto-assigning classic Shimeji jump frame `shime22` as an emote during imports.

## 2026-07-03 20:12 -07:00

- Added per-Tomoji random sitting variant controls for primary, alt 1, and alt 2 sit animations.

## 2026-07-03 20:31 -07:00

- Hid random sitting variant controls unless a Tomoji has multiple assigned floor sit animations.

## 2026-07-03 21:12 -07:00

- Reworked the random behavior settings UI into a cleaner Autonomy panel with compact sit style pills.

## 2026-07-03 21:36 -07:00

- Added floor crawl as a real runtime action with Shimeji Creep import mapping, context-menu targeting, random behavior controls, and editor frequency settings.

## 2026-07-04 12:45 -07:00

- Normalized imported sprite frames onto the largest assigned frame canvas without scaling original pixels.
- Kept runtime sprite images contained/bottom-anchored so mixed-size frames do not stretch.

## 2026-07-04 12:54 -07:00

- Fixed imported Tomojis spawning while saved as Off; disabled instances now stay hidden until toggled on.

## 2026-07-04 13:00 -07:00

- Cropped transparent padding from dashboard Tomoji previews/cards so imported sprites render larger and centered.

## 2026-07-04 13:03 -07:00

- Cached animation registries for dashboard Tomoji previews so switching between companions no longer rebuilds sprite metadata every time.

## 2026-07-04 13:07 -07:00

- Fixed Shimeji imports named from a plain `img` sprite folder by using the parent folder name instead.

## 2026-07-04 13:12 -07:00

- Compacted imported emote slots and menu labels so visible emotes count up without skipped numbers.

## 2026-07-04 13:58 -07:00

- Added per-autonomy frequency sliders for walking, floor crawling, sitting, wall climbing, ceiling crawling, and talking, with a compact settings layout.

## 2026-07-04 14:19 -07:00

- Reduced default/legacy floor crawl frequency from 25% weight to 10% weight so walking stays dominant.

## 2026-07-04 14:21 -07:00

- Clarified autonomy sliders by showing floor action sliders as relative weights/chances instead of misleading raw percentages.

## 2026-07-04 14:27 -07:00

- Reworked autonomy settings into timing, floor mix, and attached action sections so rate controls are separated from relative action mix.

## 2026-07-04 14:47 -07:00

- Fixed imported Shimeji title-bar sit resolution so top-of-window sitting uses imported bar sit/dangle frames before floor sit fallback.
- Scoped Shimeji auto-import sources to the chosen img sprite folder and updated UI copy to tell users to choose the img sprite folder, not the outer Shimeji folder.

## 2026-07-04 14:53 -07:00

- Fixed Shimeji imports chosen from nested img character folders by finding the nearest parent actions.xml instead of falling back to filename guesses.
- Cleaned Shimeji auto-mapping so floor sits, title-bar sits, and menu emotes do not reuse the wrong pose groups; classic fallback walk now imports the full 1-2-1-3 loop.

## 2026-07-04 15:42 -07:00

- Fixed Shimeji import failures caused by denied parent-folder scans when only an img sprite folder is selected.
- Updated Shimeji import copy to prefer the folder containing conf/actions.xml plus img when actions.xml is outside the sprite folder.

## 2026-07-04 15:44 -07:00

- Added an optional actions.xml picker to Shimeji import so users can choose a sprite folder and its exact animation XML separately.

## 2026-07-04 15:51 -07:00

- Added a Shimeji import scan panel that reports found sprite frames, found/missing actions.xml, and blocks import until both required inputs are present.
- Hardened parent-folder scanning so reaching a drive root no longer throws "path does not have a parent".

## 2026-07-04 15:55 -07:00

- Resolved Shimeji ActionReference sequences during import so behavior-level actions like SitAndSpinHead and SitWhileDanglingLegs import as full animation loops instead of one primitive frame.
- Updated sit/emote mapping to prefer behavior-level Shimeji sequence actions before primitive pose actions.

## 2026-07-04 16:02 -07:00

- Added behaviors.xml parsing to Shimeji import so emote slots come from visible/linked behaviors instead of guessed primitive actions.
- Import scan now reports behaviors.xml when present and warns when missing.

## 2026-07-04 16:09 -07:00

- Added an explicit behaviors.xml picker to Shimeji import and passed the chosen file through scan/import alongside actions.xml.

## 2026-07-04 16:27 -07:00

- Stopped Shimeji import from filling emote slots with title-bar dangle, movement, falling, crawl, jump, throw, split, pull-up, or IE/window sequences.
- Reduced classic emote fallback to the one safe spin-head loop so bad single-frame pseudo-emotes do not appear in the context menu.

## 2026-07-04 16:33 -07:00

- Trimmed imported emote loops so normal sit/start/end poses are removed from behavior emotes.
- Removed single-frame sitAlt variants when they duplicate primary sit frames or frames already used by an imported emote.

## 2026-07-04 16:45 -07:00

- Expanded safe Shimeji emote import allow-list to include face-mouse/hat-off style behaviors and multi-frame throw/hit primitive actions while still excluding falling/window/movement sequences.


## 2026-07-04 21:55 - Shimeji graph import v2
- Added Shimeji-native graph manifest/import path preserving actions, behaviors, pose durations, velocities, and anchors.
- Updated runtime registry to play Shimeji graph imports through existing movement, context menu, drag, and dialogue layers.
- Updated Shimeji folder import screen to use graph import diagnostics instead of slot assignment.

## 2026-07-04 22:08 - Shimeji graph size/editor fixes
- Fixed graph import default scale so large anchor-preserving canvases shrink to a 128px target instead of rendering huge.
- Patched current local gir import scale in app data from 1 to 0.621 for the 206x168 graph canvas.
- Added graph-aware editor for Shimeji imports with default action mapping and context-menu action selection.

## 2026-07-04 22:18 - Shimeji-first UI and scale repair
- Added registry repair that shrinks stale graph-import instances stuck at scale 1 when their manifest default scale is smaller.
- Removed old manual frame assignment path from the Add Tomoji modal so Shimeji graph import is the primary creation path.
- Kept Tomoji folder import as the secondary path.

## 2026-07-04 22:30 - V1-sized Shimeji graph frames
- Changed graph importer canvas sizing back to v1-style 128px visual boxes instead of expanding canvas to every extreme Shimeji anchor.
- Removed automatic scale repair that overwrote user size changes.
- Patched current local gir import sprites/manifest/instance back to 128x128 at scale 1.

## 2026-07-04 22:36 - Stop graph import auto-downscale
- Changed Shimeji graph imports to default to scale 1, matching v1 behavior even when source frames exceed 128px.
- Patched current Gojo graph manifest/library/instance from auto scale 0.815 to 1.

## 2026-07-04 22:45 - Trim transparent sprite padding
- Graph importer now measures visible alpha bounds instead of full transparent source image bounds.
- Normalized graph frames crop transparent padding before placing poses in the shared canvas.
- Rebuilt current Gojo/Gir local graph sprites; Gojo canvas dropped from 145x157 to 128x129.

## 2026-07-04 22:55 - Safer graph menu action import
- Tightened default context-menu action selection to expression/face/spin-style actions only.
- Excluded actions and referenced sequences involving fall, bounce, trip, get-up, jump, movement, wall/ceiling, drag, split, pull, and IE/window actions.
- Cleaned current Gojo/Hornet graph menu actions to remove tripping/chase/fall-related entries.

## 2026-07-04 22:41 - Ceiling crawl anchor offset
- Fixed Shimeji graph ceiling actions to use the ceiling grab anchor instead of the floor anchor, so crawlers hang below window undersides instead of floating inside the window.

## 2026-07-04 22:55 - Wall climb and ceiling nudge
- Nudged underside crawl anchors 2px upward so ceiling crawlers overlap the window bottom slightly.
- Fixed graph-import wall climb velocity fallback when mixed up/down Shimeji poses averaged to zero, so wall climbing moves instead of animating in place.

## 2026-07-04 23:01 - Ceiling crawl visual nudge
- Raised underside crawl anchor from 2px to 5px so ceiling crawlers sit a bit farther north against the window bottom.
