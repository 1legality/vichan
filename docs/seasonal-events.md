# Seasonal decorations

`js/seasonal-events.js` is registered in `inc/config.php`. Its single `events` registry contains annual `MM-DD` dates, an optional post `accent`, title symbol, banner, bunting, and motion. Dates are evaluated in **America/Toronto** in the browser. The minute-aligned timer and focus, visibility, and page-resume handlers update already-open pages; no scheduled page rebuild is needed for holidays.

The decorations preserve the selected stylesheet. Events with a photo accent place a locally served transparent PNG decoration over the upper edge of visible photos, with individual size, position, overlap, and rotation. Only the site birthday (October 12) uses a party hat on photos. Every event has a humorous page banner with a small local transparent PNG illustration. Halloween, Christmas, New Year, April Fools, and Quebec Day have no photo decorations. April 20 displays its anti-cannabis illustration only in the page banner, with “Les utilisateurs qui sont drogués seront bannis sans préavis.”; it adds nothing to post photos and does not change moderation behavior. Sources, authors, licenses, and PNG optimization details are in `CREDITS.md`. No uploaded media is changed. Banners occupy normal page flow. Snow is limited to eight slow flakes at the viewport edges; confetti ends after five seconds and runs once per tab session, including across December 31–January 1. Decorative images and page effects ignore pointer input and are hidden from screen readers; banner text remains accessible. Text-only posts, generic files, videos, deleted or hidden images, and unrevealed spoilers receive no hat.

`templates/post/image.html` marks eligible media links. The hat is a sibling of the link, never a child: `inline-expanding.js` retains its direct thumbnail/full-image children. Positioning follows the visible image content, excluding theme padding and any `object-fit: contain` letterboxing. Space above the photo keeps metadata readable; the decoration can overflow without carousel clipping. OPs, replies, AJAX posts, cloned previews, carousel navigation, Show all, inline expansion, and resizing share the same positioning pass. A revealed spoiler receives a hat only while its full image is visible. Mutation and resize observation run only during an active hat event.

Options → General (or the Seasonal tab if General is absent) offers **Automatic**, **Static only**, and **Off**. Without Options, a small “Seasonal settings” disclosure appears in the footer. The preference persists locally. Reduced motion always disables snow and confetti, even in Automatic. Hidden tabs stop effects. If browser storage is blocked, preferences and the confetti guard still work for the current page.

## Local preview

In the browser console:

```js
VichanSeasonal.preview('2026-10-12');
VichanSeasonal.preview('2026-10-31');
VichanSeasonal.preview('2026-12-25');
VichanSeasonal.preview('2026-12-31');
VichanSeasonal.preview('2027-01-01');
VichanSeasonal.preview('2026-04-01');
VichanSeasonal.preview('2026-04-20');
VichanSeasonal.preview('2026-06-24');
VichanSeasonal.preview(null); // Restore the real Toronto date.
```

The override is stored only in this browser tab's `sessionStorage`; it does not change server dates or other visitors' pages. Preferences and reduced motion still apply. To repeat the New Year animation during testing, remove `sessionStorage['vichan.seasonal.confetti.new-year']` and reload. Invalid calendar dates are rejected.

## Configuration and rebuilding

To replace the registry, load an instance settings script before `js/seasonal-events.js` through `$config['additional_javascript']`, following `js/settings.js`:

```js
var tb_settings = window.tb_settings || {};
tb_settings['seasonal-events'] = {
	events: [
		{ id: 'birthday', dates: ['10-12'], accent: 'party', bannerImage: 'party', banner: 'Les utilisateurs qui ne souhaitent pas joyeux anniversaire au site seront bannis pour ingratitude aggravée.' },
		{ id: 'new-year', dates: ['12-31', '01-01'], bannerImage: 'champagne', banner: 'Les utilisateurs qui sortent ce soir seront bannis pour abandon de poste.', motion: 'confetti' }
	]
};
```

This replaces the entire registry. The only photo accent is `party`, reserved for the site birthday; motion is `snow` or `confetti`. Entries may also have `title` (plain text), `banner` (plain text), `bannerImage` (`party`, `witch`, `santa`, `champagne`, `jester`, `sober`, or `fleur`, for the local party hat, witch hat, Santa hat, champagne glasses, jester hat, anti-cannabis sign, or fleur-de-lys PNG respectively; requires a banner), and `bunting: true`. Use unique IDs. The first matching event wins. Remove the seasonal script from the configured asset list to disable this feature independently of the carousel; the header then omits its stylesheet too.

When installing these source changes, increment the instance's `$config['resource_version']` and, as the application user from the runtime web root, run `php tools/rebuild.php`. This clears Twig's cache and regenerates JavaScript, themes, board indexes, and existing threads. Do not use `--quick`: old thread HTML also needs the header and file markup changes. Update the published JS/CSS assets and purge cached HTML, `main.js`, and affected assets from any reverse proxy/CDN as necessary. Hard-refresh the browser afterward. Instances replacing the entire `additional_javascript` array must explicitly register the new scripts. These steps are installation instructions, not an automatic deployment.
