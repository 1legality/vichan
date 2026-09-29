# Attachment carousel and media viewer design QA

Date: 2026-09-29
Branch: `feat/seasonal-events-carousel`

## Visual target and evidence

- Selected target: option 1, the filmstrip design.
- Source: `/Users/mlandry/.codex/generated_images/01a0eab1-7dce-7700-9b6c-77c0dc597049/exec-4a621621-a9da-4c2d-9272-4b429b61f578.png` (1122 × 1402 pixels).
- Desktop evidence: `local-instances/apple/design/carousel/02-desktop.png` (1433 × 1198 pixels; reported CSS viewport 1490 × 1198).
- Mobile evidence: `local-instances/apple/design/carousel/03-mobile.png` (382 × 827 pixels; requested CSS viewport 390 × 844).
- Implementation: `http://127.0.0.1:9080/sdm/#reply_2072`, first attachment, Cyberpunk theme.
- Additional interaction fixtures: ignored `local-instances/apple/www/carousel-check.html` and `carousel-check-no-icons.html`.

The two carousel captures above document the initial filmstrip review, before the subsequent removal of its green selection checkmark. Current media-viewer captures are listed below.

The source and mobile evidence were opened together for the final comparison. The source is an enlarged component concept with a landscape sample; the implementation uses the restored post's portrait image at its existing thumbnail resolution. The browser's screenshot raster differs slightly from its reported CSS viewport. Comparison therefore uses component hierarchy and measured CSS sizes, not pixel-perfect image alignment. No screenshots were rescaled, stretched, or substituted. Full viewport captures preserve post context; experimental clipped captures were rejected because the browser cropped the wrong region.

## Required fidelity surfaces

- Typography: retains the site's Rajdhani / Share Tech Mono typography. Attachment count and navigation are clearer than the secondary file metadata; counters use tabular numbers and remain on one line.
- Spacing and layout: preserves the selected sequence of count, media, arrows/counter, thumbnails, then file details. The gallery is intentionally capped at 360px for imageboard density. A 255px thumbnail stage keeps navigation stable across aspect ratios. Full-size expansion remains available.
- Colors: uses Cyberpunk's dark surface, lavender/purple controls and an emphasized selected-thumbnail outline. The gray image frame is removed only from the enhanced gallery.
- Images: original media and download links remain intact. Existing thumbnails are reused without upscaling or eagerly loading full-size files. Spoiler, document and deleted-file placeholders remain recognizable. GIF rail previews are static.
- Copy: concise English labels (`5 attachments`, `Show all`, `Show one`, `1 of 5`) match the selected concept and repository convention. Original post content and filenames are preserved.

Both full-view captures and focused DOM measurements were reviewed. Controls measured at least 44 CSS pixels high and remained within the gallery. Fine typography and selected-state details were also inspected in the mobile screenshot.

## Comparison history

1. Initial implementation: navigation text wrapped at 320px, including the counter (P2). Replaced visible captions with the selected design's chevrons when Font Awesome is available, retained accessible names and text fallback, and prevented counter wrapping. Subsequent 320px capture showed one-line counters and 44px controls.
2. Responsive review: Show all could inherit legacy thumbnail margins (P2). Applied responsive box sizing and margin constraints in that mode. The 320px fixture passed with zero horizontal overflow; the real 390px gallery stayed inside the viewport in both modes.
3. Motion review: GIF previews could bypass the existing frozen-GIF behavior (P2). Added static rail previews and redraw of cloned frozen canvases. Browser checks confirmed PNG rail previews, hidden animated originals, and nonblank original/cloned canvases.
4. Final paired visual review: no actionable P0/P1/P2 differences within the requested carousel scope. Compact width, portrait letterboxing, and original metadata are intentional production adaptations of the selected concept.

Follow-up: removed the green selection checkmark at the user's request. The selected outline and `aria-current` remain.

## Interaction checks

Passed in the Codex in-app browser:

- Previous/Next, wrap-around, direct thumbnail selection, Left/Right, Home/End, and focus retention.
- Overflowing ten-item rail keeps keyboard selection visible without scrolling the page horizontally.
- Show all / Show one retains the selected file and expansion state.
- Legacy inline expansion carried to the next image without automatically opening documents during the initial review. The normal click path now uses the modal described below; the legacy path remains a fallback.
- Single-file posts stay unenhanced; initial and dynamically added opening-post siblings initialize.
- Cloned enhanced/expanded replies get exactly one control set and reset stale expansion without altering the original.
- Newly added replies initialize through `new_post`.
- Visible silent video/audio can play; switching away pauses them; delayed hidden playback is paused again.
- Spoiler thumbnails retain their placeholder URL; deleted files and documents remain selectable.
- Frozen GIF clones retain a hidden animated original and a nonblank canvas; rail previews use PNG data URLs.
- With the icon stylesheet absent, visible Previous/Next text works at 320px without overflow.
- No captured browser console errors on the restored board or fixture.

Validation: `node --check js/attachment-carousel.js`, PHP lint for `inc/config.php`, `git diff --check`, and local board/JavaScript rebuild passed. Rebuild still emits known legacy PHP deprecations.

## Media viewer initial review

Reference: the media viewer in the user-provided `4chan-home-gruvbox-safari.user.js`. Its dark overlay, fitted media, navigation, caption, zoom, and close behavior informed the implementation; its source file was not changed. This is an adaptation to Cyberpunk, not a pixel reproduction of the userscript.

Initial modal evidence, before the autoplay and simplified-controls follow-up below, inspected at native screenshot dimensions:

- Desktop: `local-instances/apple/design/carousel/04-media-dialog-desktop.png` (1436 × 1198 pixels; reported CSS viewport 1493 × 1198).
- Mobile: `local-instances/apple/design/carousel/05-media-dialog-mobile.png` (390 × 844 pixels; matching CSS viewport).
- Both captures show the first original attachment of restored post 2072, with a dark backdrop, fitted portrait, purple controls, readable counter/filename, and no inline expansion.

Passed in the Codex in-app browser:

- Original image opens in a native modal, including single-file posts. Its original dimensions are available after load.
- Previous/Next and keyboard navigation update the modal and the underlying carousel. Escape and Close remove the media, release the scroll lock, and return focus to the selected media anchor. The real post remained unexpanded after dismissal.
- Native modal status and sequential keyboard focus between dialog controls were confirmed. Browser chrome can still receive focus at a tab boundary; background page controls remain inert.
- Zoom displays the original image dimensions. Its focused, labeled viewport scrolls horizontally with the arrow key without changing attachments; Fit restores the fitted view.
- A video starts paused with native controls and its loop flag retained. Explicit keyboard playback works; navigating to an image removes the video. Saved-volume handling was code-reviewed, not tested with audible output.
- A missing original shows a useful error and keeps Open original available. Reopening another attachment succeeds.
- View all media collects the fixture's 24 supported media items; the per-post viewer contains only that post's media.
- At 320px and 390px, controls remain within the dialog. All visible buttons and links have at least 44px outer height. Without Font Awesome at 320px, controls use two rows of visible text without overlap.
- The selected carousel thumbnail has its border and `aria-current`, with no green checkmark.

Review fixes: preserved existing video volume/loop preferences, added keyboard panning for zoomed images, and corrected overlapping text controls when icons are unavailable on narrow screens. No actionable P0/P1/P2 visual issues remained in the inspected views.

Final validation: syntax checks for both JavaScript files, PHP lint, `git diff --check`, full local rebuild, and `./tools/dev.sh check` passed. MySQL, Redis, PHP requirements, nginx configuration, and local HTTP were healthy. No restored database content or uploaded media was changed.

## Autoplay and simplified controls

At the user's request, the modal now starts the selected video automatically and has no separate zoom button. A mouse click toggles the image between fitted and original size; a second click fits it again. Enter/Space on the focusable image offers the same action, and Enter/Space on the zoomed viewport returns to fit. Native mobile pinch remains enabled through the viewport and touch-action settings; touch activation does not trigger the mouse zoom toggle.

- Current desktop evidence: `local-instances/apple/design/carousel/06-media-dialog-simple-controls.png`. Inspected the actual restored post with Close, Previous, Next and Open original, and no Zoom control.
- The silent fixture video reported `autoplay=true`, `paused=false`, and advancing `currentTime` on selection. Returning to it from the next image also started playback. Navigation and dismissal removed the prior video and released the modal scroll lock.
- Mouse zoom/fit and keyboard Enter/fit passed. The image still supports arrow-key panning when zoomed.
- The 320px fixture without icons has one row of visible Previous, Next and Open original controls, all within the panel and at least 44px high.
- Saved volume and looping remain in use. If the browser rejects audible autoplay, a guarded, single muted retry is attempted; native controls remain available. The blocked-autoplay fallback was code-reviewed, not forced in the browser.
- JavaScript syntax, PHP lint, diff whitespace checks, and the full local rebuild passed. Resource version is 10. Native physical-device pinch was not tested.

## Filename download follow-up

The filename in the modal footer is now a native download link; the counter stays plain text. Its URL and download filename update synchronously with every media selection. A subtle underline and hover color indicate the action, and the link has a keyboard focus outline and a 44px target height.

- Clicking `timeline.png` in the fixture downloaded `/Users/mlandry/Downloads/timeline.png`. Its SHA-256 matched the original repository asset exactly; the dialog stayed open.
- Switching to the video updated the link to the original `.mp4`, not `player.php`, with `download="silent-video.mp4"`.
- At 320px, the filename and counter remained inside the dialog. The link measured 44px high.
- Current rendered evidence: `local-instances/apple/design/carousel/07-media-filename-download.png`.
- JavaScript syntax, PHP lint, diff whitespace checks, and the full local rebuild passed. Resource version is 11.

## Centered thumbnail rows and spoiler containment

The thumbnail area now wraps into centered rows of at most five square buttons. It is capped at the five-button footprint even when a legacy inline image expands the post. Incomplete rows are independently centered. Preview images use `contain` with scoped margin, padding, float and sizing resets, keeping the complete spoiler graphic inside its frame. The obsolete horizontal-scroll adjustment was removed; Left/Right and Home/End keep their existing selection order.

- Tested every attachment count from two through ten on the fixture. Counts six through ten produced `5+1`, `5+2`, `5+3`, `5+4`, and `5+5` rows.
- At 320px, all rows measured zero horizontal centering offset and every thumbnail was 44 × 44px. No horizontal page overflow was introduced. Desktop thumbnails remain capped at 64px.
- On restored post 1996 on `/sdm/3.html`, all four spoiler previews used `contain`; their full image boxes stayed inside their square buttons with padding. The row was centered beneath the main image. Show all / Show one preserved a single working set of controls.
- The ten-item fixture retained focus and selected `10 of 10` through Home/End without horizontal rail scrolling.
- Evidence: `local-instances/apple/design/carousel/08-spoilers-centered.png` (actual post) and `09-thumbnail-rows-mobile.png` (ten-item mobile fixture).
- JavaScript syntax, PHP lint, diff whitespace checks, and full local rebuild passed. No browser console errors were captured. Resource version is 12.

## Thumbnail navigation inside the dialog

The dialog now repeats the directly selectable previews above its filename and actions. The centered rail uses the existing purple controls and selected outline, with no selection checkmark. Desktop previews are 64px square; mobile previews are 44px square. Up to ten items remain visible in two rows of five. Larger collections scroll locally, and short landscape viewports show one scrollable row to preserve the main media area. Single-item viewers omit the rail.

Rendered evidence inspected at native dimensions:

- Before: `local-instances/apple/design/carousel/10-dialog-before-thumbnails.png` (1490 × 1198), restored post 2073 at its first image.
- Desktop after: `local-instances/apple/design/carousel/11-dialog-with-thumbnails-desktop.png` (1490 × 1198), the same post and selection.
- Mobile after: `local-instances/apple/design/carousel/12-dialog-with-thumbnails-mobile.png` (390 × 844), the same five-media post.
- Ten-media fixture: `local-instances/apple/design/carousel/13-dialog-ten-thumbnails-mobile.png` (320 × 740), selected item ten with two rows of five.
- Short landscape fixture: `local-instances/apple/design/carousel/14-dialog-thumbnails-landscape.png` (568 × 320), selected item ten revealed within the rail.

Paired review of the before and desktop-after images, followed by the mobile capture, passed. Header and close placement, typography, purple palette, fitted media proportions, and filename/action hierarchy remain consistent. The new footer deliberately reserves space for previews, reducing the fitted image area without cropping it. No actionable P0/P1/P2 visual issues remained in the inspected views.

Interaction and layout checks passed in the Codex in-app browser:

- Direct selection and Left/Right/Home/End synchronize the original, filename download, counter, inline carousel, selected border, and keyboard focus. The rail has exactly one tab stop.
- Selecting the current thumbnail preserves image zoom and video playback position. Selecting a video starts playback; leaving it removes the previous video.
- At 390px, all five previews fit in one centered row. At 320px, ten previews form two rows of five, with no hidden items and a 435px main stage.
- At 568 × 320, the main stage retains 131px of height, all footer actions remain visible, and Home/End scroll only the thumbnail rail. Review found that the focus outline could reach the scrollport edge (P2); selection reveal now includes the rail's padding. The selected item's bottom remains 6px inside the scrollport after the fix.
- A 78-item bulk collection reaches its last item through End without changing page scroll position.
- Single-item viewers hide the rail. Frozen GIF previews use PNG snapshots. Real post previews reuse thumbnail URLs rather than original media URLs.
- No browser console errors were captured during these checks. Physical touch gestures and other browser engines remain outside this verification.

Final validation: both JavaScript syntax checks, PHP lint, diff whitespace checks, and the local rebuild passed. The original browser tab was refreshed and reopened at the same media, with five thumbnails and resource version 13 confirmed.

## Simplified single-row dialog footer

The user's next refinement replaces the dialog's wrapping rail with a single horizontal strip between Previous and Next. A small, underlined filename download sits above it. The visible counter and Open original control are removed; ordinal information remains in the thumbnails' accessible labels. The entire navigation row is hidden for a single attachment. The inline post carousel retains its separate wrapping layout.

- Paired visual review compared `11-dialog-with-thumbnails-desktop.png` with `15-dialog-single-row-desktop.png` at 1490 × 1198, on the same post and first image. `16-dialog-single-row-mobile.png` shows the corresponding 390 × 844 view. Header, theme, close control, and fitted image proportions remain consistent; all requested footer changes are visible. No P0/P1/P2 findings remained.
- At 390px, all five 44px previews fit without horizontal overflow. The filename uses 12px type and retains a 44px link target above the navigation.
- The ten-item fixture stays on one row at 320 × 740; Home/End reveals the first/last preview with 6px padding for the selected outline. No dialog overflow was introduced. Evidence: `17-dialog-single-row-ten-mobile.png`.
- At 568 × 320, the ten-item row remains 56px high, all footer controls stay within the viewport, and the main stage retains 143px of height.
- Selecting the real post's video updates the download filename to its `.mp4`. The singleton hides its whole navigation row. Without icons at 320px, visible text controls remain within the dialog and Next selects the next item.
- JavaScript syntax, PHP lint, diff whitespace checks, and the full local rebuild passed. Browser console checks captured no errors. Resource version is 14.

## Filename in the dialog header

The filename download now occupies the top-left header in place of the visible Media viewer label. The footer contains only thumbnail navigation. The dialog retains its accessible name, the filename's polite announcement and download behavior, and the Close button on the right. Loading-error guidance now refers to the filename above.

- Desktop evidence: `18-dialog-filename-header-desktop.png` (1490 × 1198, the same first image as `15-dialog-single-row-desktop.png`). Mobile evidence: `19-dialog-filename-header-mobile.png` (320 × 740, second image).
- Paired desktop comparison and mobile visual review passed with no P0/P1/P2 findings; the header and footer changes match the requested refinement.
- Previous/Next updates the header text and original download filename together. No footer caption remains.
- The header link retains its 44px target. At 320px, long filenames truncate with an ellipsis and the Close button remains fully visible. An initial intrinsic grid-width overflow was corrected with a shrinkable panel column and header; the final dialog has zero horizontal overflow.
- JavaScript syntax, PHP lint, diff whitespace checks, and generated-page/JavaScript rebuild passed. No browser console errors were captured. Resource version is 15.

## Remaining limits

- Mobile sizes 320px and 390px were tested through viewport overrides, not on a physical touch device. Touch swipes/pinch, screen-reader announcements, and other browser engines were not manually tested.
- The restored board has a pre-existing 4px mobile overflow from the posting textarea (`#body`). The carousel remains within the viewport; the unrelated form was not changed.
- This is a local implementation. No commit, push, deployment, or change to restored posts/media was performed.

final result: passed
