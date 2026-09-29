/*
 * Annual, cosmetic decorations. Register through additional_javascript.
 * Optional overrides: tb_settings['seasonal-events'].events (see docs/seasonal-events.md).
 * Local preview: VichanSeasonal.preview('2026-10-31'); clear with preview(null).
 */
(function() {
	'use strict';
	if (window.VichanSeasonal) return;

	var settings = new script_settings('seasonal-events');
	var events = settings.get('events', [
		{ id: 'birthday', dates: ['10-12'], accent: 'party', bannerImage: 'party', banner: 'Bonne fête /sdm/!' },
		{ id: 'halloween', dates: ['10-31'], bannerImage: 'witch', banner: 'Poste une histoire de peur sur ton ex pour Halloween!!', title: '🎃' },
		{ id: 'christmas', dates: ['12-25'], bannerImage: 'santa', banner: 'Joyeux Noël!', title: '✦', motion: 'snow' },
		{ id: 'new-year', dates: ['12-31', '01-01'], bannerImage: 'champagne', banner: 'Joyeuse nouvelle année!.', motion: 'confetti' },
		{ id: 'april-fools', dates: ['04-01'], bannerImage: 'jester', banner: 'Les commentaires racistes seront envoyés à la SQ pour le premier avril.' },
		{ id: '420', dates: ['04-20'], bannerImage: 'sober', banner: 'Les utilisateurs qui sont drogués seront bannis sans préavis.' },
		{ id: 'quebec', dates: ['06-24'], bannerImage: 'fleur', banner: 'Les utilisateurs qui écrivent en anglais seront bannis jusqu\'au 1er juillet.', title: '⚜', bunting: true }
	]);
	var preferenceKey = 'vichan.seasonal.preference';
	var previewKey = 'vichan.seasonal.preview';
	var preference = read('localStorage', preferenceKey) || 'automatic';
	var preview = read('sessionStorage', previewKey);
	var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	var formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit'
	});
	var current = null, state = '', timer, motionTimer, particles, select;
	var seen = {};
	var hats = {
		party: { scale: 0.48, max: 110, ratio: 352 / 512, inset: 0.12, overlap: 0.12 }
	};
	var photoFrame, photoObserver, photoResize;
	var observedPhotos = new Set();

	function read(storage, key) {
		try { return window[storage].getItem(key); } catch (e) { return null; }
	}

	function write(storage, key, value) {
		try {
			if (value === null) window[storage].removeItem(key);
			else window[storage].setItem(key, value);
		} catch (e) { /* Preferences still work for this page when storage is blocked. */ }
	}

	function validDate(value) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
		var date = new Date(value + 'T12:00:00Z');
		return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
	}

	function torontoDate(date) {
		var parts = {};
		formatter.formatToParts(date).forEach(function(part) { parts[part.type] = part.value; });
		return parts.year + '-' + parts.month + '-' + parts.day;
	}

	function decoration(className, text) {
		var node = document.createElement('span');
		node.className = 'seasonal-decoration ' + className;
		node.textContent = text || '';
		node.setAttribute('aria-hidden', 'true');
		return node;
	}

	function schedulePhotos() {
		if (current && hats[current.accent] && !photoFrame) photoFrame = requestAnimationFrame(positionPhotos);
	}

	function photoStyle(node, property, value) {
		if (node.style.getPropertyValue(property) !== value) node.style.setProperty(property, value);
	}

	function visiblePhoto(link) {
		for (var i = link.children.length - 1; i >= 0; i--) {
			var photo = link.children[i];
			if (!photo.matches('img.post-image, canvas.post-image, img.full-image') || photo.matches('.hidden, .deleted')) continue;
			if (link.dataset.seasonalPhoto === 'spoiler' && !photo.classList.contains('full-image')) continue;
			if (photo.tagName === 'IMG' && (!photo.complete || !photo.naturalWidth)) continue;
			if (photo.getClientRects().length && getComputedStyle(photo).visibility === 'visible') return photo;
		}
		return null;
	}

	function photoBox(photo) {
		var rect = photo.getBoundingClientRect(), css = getComputedStyle(photo);
		var left = parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft);
		var top = parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop);
		var width = rect.width - left - parseFloat(css.borderRightWidth) - parseFloat(css.paddingRight);
		var height = rect.height - top - parseFloat(css.borderBottomWidth) - parseFloat(css.paddingBottom);
		// Carousel thumbnails can keep their inline height while max-width shrinks them.
		if (css.objectFit === 'contain' || css.objectFit === 'scale-down') {
			var naturalWidth = photo.naturalWidth || photo.width, naturalHeight = photo.naturalHeight || photo.height;
			var scale = Math.min(width / naturalWidth, height / naturalHeight, css.objectFit === 'scale-down' ? 1 : Infinity);
			left += (width - naturalWidth * scale) / 2;
			top += (height - naturalHeight * scale) / 2;
			width = naturalWidth * scale;
			height = naturalHeight * scale;
		}
		return { left: rect.left + left, top: rect.top + top, width: width, height: height };
	}

	function positionPhotos() {
		photoFrame = null;
		var hat = current && hats[current.accent];
		if (!hat) return;
		var photos = new Set();
		document.querySelectorAll('.files > .file > a[data-seasonal-photo]').forEach(function(link) {
			var file = link.parentNode;
			var accent = file.querySelector('.seasonal-photo-hat');
			var photo = visiblePhoto(link);
			if (!photo) {
				if (accent) accent.remove();
				if (file.classList.contains('seasonal-photo-file')) file.classList.remove('seasonal-photo-file');
				if (link.classList.contains('seasonal-photo-link')) link.classList.remove('seasonal-photo-link');
				link.style.removeProperty('--seasonal-hat-space');
				return;
			}
			photos.add(photo);
			var box = photoBox(photo);
			var width = Math.min(box.width * hat.scale, hat.max), height = width / hat.ratio;
			if (!accent) {
				accent = decoration('seasonal-photo-hat seasonal-' + current.accent);
				file.appendChild(accent);
			} else if (accent.className !== 'seasonal-decoration seasonal-photo-hat seasonal-' + current.accent) {
				accent.className = 'seasonal-decoration seasonal-photo-hat seasonal-' + current.accent;
			}
			if (!file.classList.contains('seasonal-photo-file')) file.classList.add('seasonal-photo-file');
			if (!link.classList.contains('seasonal-photo-link')) link.classList.add('seasonal-photo-link');
			// Keep the whole hat below the metadata, without changing the link's children.
			photoStyle(link, '--seasonal-hat-space', Math.ceil(height * (1 - hat.overlap) + width * 0.12 + 8) + 'px');
			box = photoBox(photo);
			var origin = file.getBoundingClientRect();
			photoStyle(accent, 'width', width.toFixed(2) + 'px');
			photoStyle(accent, 'height', height.toFixed(2) + 'px');
			photoStyle(accent, 'left', (box.left - origin.left - file.clientLeft + box.width * hat.inset).toFixed(2) + 'px');
			photoStyle(accent, 'top', (box.top - origin.top - file.clientTop - height * (1 - hat.overlap)).toFixed(2) + 'px');
		});
		if (photoResize) {
			observedPhotos.forEach(function(photo) { if (!photos.has(photo)) photoResize.unobserve(photo); });
			photos.forEach(function(photo) { if (!observedPhotos.has(photo)) photoResize.observe(photo); });
		}
		observedPhotos = photos;
	}

	function watchPhotos() {
		cancelAnimationFrame(photoFrame);
		photoFrame = null;
		if (photoObserver) photoObserver.disconnect();
		if (photoResize) photoResize.disconnect();
		observedPhotos.clear();
		document.querySelectorAll('.seasonal-photo-file').forEach(function(file) { file.classList.remove('seasonal-photo-file'); });
		document.querySelectorAll('.seasonal-photo-link').forEach(function(link) {
			link.classList.remove('seasonal-photo-link');
			link.style.removeProperty('--seasonal-hat-space');
		});
		if (!current || !hats[current.accent]) return;
		if (!photoObserver) photoObserver = new MutationObserver(function(mutations) {
			if (mutations.some(function(mutation) { return !mutation.target.closest('.seasonal-decoration, .seasonal-particles'); })) schedulePhotos();
		});
		photoObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'src'] });
		if (window.ResizeObserver) {
			if (!photoResize) photoResize = new ResizeObserver(schedulePhotos);
			photoResize.observe(document.body);
		}
	}

	function stopMotion() {
		clearTimeout(motionTimer);
		if (particles) particles.remove();
		particles = null;
	}

	function updateMotion() {
		if (!current || !current.motion || preference !== 'automatic' || reduced.matches || document.hidden) {
			stopMotion();
			return;
		}
		if (particles) return;
		var confetti = current.motion === 'confetti';
		var key = 'vichan.seasonal.confetti.' + current.id;
		if (confetti && (seen[key] || read('sessionStorage', key))) return;
		if (confetti) {
			seen[key] = true;
			write('sessionStorage', key, '1');
		}
		particles = document.createElement('div');
		particles.className = 'seasonal-particles seasonal-' + current.motion;
		particles.setAttribute('aria-hidden', 'true');
		for (var i = 0; i < (confetti ? 16 : 8); i++) {
			var particle = document.createElement('i');
			particle.style.setProperty('--particle', i);
			particles.appendChild(particle);
		}
		document.body.appendChild(particles);
		if (confetti) motionTimer = setTimeout(stopMotion, 5000);
	}

	function refresh() {
		clearTimeout(timer);
		var date = validDate(preview) ? preview : torontoDate(new Date());
		var event = preference === 'off' ? null : events.filter(function(event) {
			return event.dates.indexOf(date.slice(5)) !== -1;
		})[0] || null;
		var nextState = date + ':' + (event ? event.id : '') + ':' + preference;
		if (nextState !== state) {
			state = nextState;
			current = event;
			stopMotion();
			document.querySelectorAll('.seasonal-decoration').forEach(function(node) { node.remove(); });
			watchPhotos();
			var header = document.querySelector('body > header');
			var title = header && header.querySelector('h1');
			if (event && title && event.title) title.appendChild(decoration('seasonal-title-accent', event.title));
			if (event && header && event.banner) {
				var banner = document.createElement('div');
				banner.className = 'seasonal-decoration seasonal-banner';
				banner.textContent = event.banner;
				if (event.bannerImage) {
					banner.classList.add('seasonal-banner-illustrated');
					banner.insertBefore(decoration('seasonal-banner-image seasonal-' + event.bannerImage), banner.firstChild);
				}
				header.appendChild(banner);
			}
			if (event && header && event.bunting) header.appendChild(decoration('seasonal-bunting'));
			schedulePhotos();
		}
		if (select) select.value = preference;
		updateMotion();
		// Align with the next minute, including Toronto midnight; never assume a 24-hour DST day.
		timer = setTimeout(refresh, 60000 - Date.now() % 60000 + 25);
	}

	function setPreference(value) {
		preference = ['automatic', 'static', 'off'].indexOf(value) === -1 ? 'automatic' : value;
		write('localStorage', preferenceKey, preference);
		refresh();
	}

	function addOptions() {
		var content = document.createElement('div');
		content.className = 'seasonal-options';
		var label = document.createElement('label');
		label.textContent = 'Seasonal decorations: ';
		select = document.createElement('select');
		[['automatic', 'Automatic'], ['static', 'Static only'], ['off', 'Off']].forEach(function(option) {
			select.add(new Option(option[1], option[0]));
		});
		select.value = preference;
		select.addEventListener('change', function() { setPreference(select.value); });
		label.appendChild(select);
		content.appendChild(label);
		if (window.Options) {
			var tab = Options.get_tab('general') || Options.add_tab('seasonal', 'calendar', 'Seasonal');
			tab.content.append(content);
		} else {
			var details = document.createElement('details');
			details.className = 'seasonal-settings';
			var summary = document.createElement('summary');
			summary.textContent = 'Seasonal settings';
			details.appendChild(summary);
			details.appendChild(content);
			(document.querySelector('footer') || document.body).appendChild(details);
		}
	}

	window.VichanSeasonal = {
		preview: function(value) {
			if (value !== null && !validDate(value)) throw new Error('Use YYYY-MM-DD or null.');
			preview = value;
			write('sessionStorage', previewKey, value);
			refresh();
		}
	};

	function init() {
		if (!document.querySelector('body.active-index, body.active-thread, body.active-ukko, .thread, .post')) return;
		if (['automatic', 'static', 'off'].indexOf(preference) === -1) preference = 'automatic';
		addOptions();
		refresh();
		document.addEventListener('load', schedulePhotos, true);
		window.addEventListener('resize', schedulePhotos);
		if (window.jQuery) $(document).on('new_post.seasonal', schedulePhotos);
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('focus', refresh);
		window.addEventListener('pageshow', refresh);
		window.addEventListener('storage', function(e) {
			if (e.key === preferenceKey || e.key === null) {
				preference = read('localStorage', preferenceKey) || 'automatic';
				refresh();
			}
		});
		if (reduced.addEventListener) reduced.addEventListener('change', refresh);
		else reduced.addListener(refresh);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
