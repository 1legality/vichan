# Attachment carousel

`js/attachment-carousel.js` is registered through `additional_javascript`; `templates/header.html` loads its scoped CSS whenever that script is registered, including when scripts are compiled into `main.js`. Remove that script from the configured asset list to disable the carousel independently of seasonal decorations.

Only `.files` groups with two or more direct `.file` children are enhanced. Each group gets Previous, Next, a counter, and a reversible Show all / Show one button. Navigation wraps and never rotates automatically. All files remain accessible when JavaScript is disabled. Single-file posts retain their original presentation.

Each carousel preserves the current image's expanded or thumbnail mode when navigating. Only the selected image is expanded through the existing inline handler; navigation never starts a video or opens a document. Gallery mode keeps its own image handling. Show all does not expand every attachment.

Buttons support keyboard Tab, Enter, and Space. With focus in the carousel controls, Left/Right and Home/End select attachments. These keys are not captured in media controls, comment fields, or elsewhere on the page. Controls use compact brackets, with a minimum 24px target on desktop and 44px on touch devices. Cyberpunk controls share the theme's link and hover colors. Show one restores the selected attachment after Show all.

Files remain in their original order and DOM locations, including opening-post attachments outside `.post.op`. `data-file-index` records Twig's original `loop.index0`; moderation URLs still use that same original index. Media anchors, filenames, dimensions, download links, spoilers, file icons, and deleted placeholders remain intact. Uploads and storage are unchanged.

Initialization is idempotent and uses `new_post`. A small mutation observer also handles hover previews cloned without that hook. Inactive videos/audio are paused, including delayed playback events, and are never automatically resumed by navigation. The carousel does not assign full-size media URLs or preload attachments. Inline expansion and Expand all skip inactive files. Show all makes them available to Expand all. Gallery navigation selects the corresponding attachment, skips document/deleted icons, and pauses old video playback; switching gallery mode off restores the normal link handlers.

For installation, rebuild and cache steps, see [Seasonal decorations](seasonal-events.md#configuration-and-rebuilding). Both features can be tested on a temporary local page without publishing or activating the application.
