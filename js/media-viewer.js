/*
 * Open original post images and videos in a shared, keyboard-accessible dialog.
 * Native media links remain available when the dialog API is unavailable.
 */
(function() {
	'use strict';
	if (window.VichanMediaViewer) return;
	var supported = typeof document.createElement('dialog').showModal === 'function';
	var dialog, stage, message, filename, previous, next, close, thumbnails;
	var items = [], index = 0, media = null, generation = 0;
	var thumbnailButtons = [], thumbnailCleanups = [], thumbnailGeneration = 0;
	var origin = null, priorFocus = null, scroll = null, backdropStart = null, swipeStart = null;
	var historyEntry = null, historySerial = 0, pendingHistoryBack = false, queuedOpen = null;
	var keyboardFocus = true, pointerOpened = false, pointerFocusTarget = null;

	function httpURL(value, base) {
		try {
			var url = new URL(value, base || document.baseURI);
			return /^https?:$/.test(url.protocol) ? url : null;
		} catch (e) {
			return null;
		}
	}

	function attachment(link) {
		if (!link || !link.matches('a[href]') || link.hasAttribute('download') || link.hasAttribute('data-galid')) return null;
		var file = link.parentElement;
		if (!file || !file.matches('.file') || !file.parentElement || !file.parentElement.matches('.files')) return null;
		var thumb = link.querySelector('img.post-image, canvas.post-image, video.post-image');
		if (!thumb || thumb.classList.contains('deleted')) return null;
		var declaredType = link.getAttribute('data-media-type');
		if (declaredType && declaredType !== 'image' && declaredType !== 'video') return null;
		var url = httpURL(link.getAttribute('href').trim(), link.baseURI);
		if (!url) return null;
		var type = null, loop = true;
		if (/\/player\.php$/i.test(url.pathname) && url.searchParams.has('v')) {
			var loopValue = url.searchParams.get('loop');
			loop = loopValue !== null && loopValue !== '' && loopValue !== '0';
			url = httpURL(url.searchParams.get('v'), link.baseURI);
			if (url && /\.(webm|mp4|ogv)$/i.test(url.pathname)) type = 'video';
		} else if (/\.(webm|mp4|ogv)$/i.test(url.pathname) && (declaredType === 'video' || link.classList.contains('file') || thumb.tagName === 'VIDEO')) {
			type = 'video';
		} else if (declaredType === 'image' || /^(true|spoiler)$/.test(link.getAttribute('data-seasonal-photo')) ||
			(!link.classList.contains('file') && /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(url.pathname))) {
			type = 'image';
		}
		if (!type || !url) return null;
		var download = file.querySelector('.fileinfo a[download]');
		var label = download && download.getAttribute('download');
		if (!label) {
			label = url.pathname.split('/').pop();
			try { label = decodeURIComponent(label); } catch (e) { /* Keep malformed filenames readable. */ }
		}
		return { link: link, group: file.parentElement, url: url.href, type: type, loop: loop, label: label || 'Attachment' };
	}

	function collect(group) {
		var found = [];
		Array.prototype.forEach.call(group.children, function(file) {
			if (!file.matches('.file')) return;
			Array.prototype.forEach.call(file.children, function(link) {
				var item = attachment(link);
				if (item) found.push(item);
			});
		});
		return found;
	}

	function collectAll() {
		var found = [];
		document.querySelectorAll('.files').forEach(function(group) {
			if (visible(group) && !group.closest('.post-hover, dialog')) found = found.concat(collect(group));
		});
		return found;
	}

	function viewerState(state) {
		return state && state.__vichanMediaViewer;
	}

	function rememberHistorySelection() {
		if (!historyEntry || !items[index]) return;
		var current = viewerState(history.state);
		if (!current || current.id !== historyEntry.id) return;
		var item = items[index];
		var postId = item.group.getAttribute('data-post-id');
		var fileIndex = item.link.parentElement.getAttribute('data-file-index');
		if (historyEntry.url === item.url && historyEntry.postId === postId && historyEntry.fileIndex === fileIndex) return;
		historyEntry.url = item.url;
		historyEntry.postId = postId;
		historyEntry.fileIndex = fileIndex;
		try { history.replaceState({ __vichanMediaViewer: historyEntry }, '', location.href); }
		catch (e) { /* The viewer still works when session history is unavailable. */ }
	}

	function findHistoryLink(entry) {
		var groups = document.querySelectorAll('.files');
		for (var i = 0; i < groups.length; i++) {
			if (entry.postId && groups[i].getAttribute('data-post-id') !== entry.postId) continue;
			var found = collect(groups[i]);
			for (var j = 0; j < found.length; j++) {
				if (found[j].url === entry.url && (entry.fileIndex === null ||
					found[j].link.parentElement.getAttribute('data-file-index') === entry.fileIndex)) return found[j].link;
			}
		}
		return null;
	}

	function restoreHistory(entry) {
		if (!entry || !entry.url) return false;
		var link = findHistoryLink(entry);
		if (!link) return false;
		var selection = entry.all ? collectAll() : null;
		if (selection && !selection.some(function(item) { return item.link === link; })) selection = null;
		return open(link, selection, entry);
	}

	function element(tag, className, text) {
		var node = document.createElement(tag);
		node.className = className;
		if (text) node.textContent = text;
		return node;
	}

	function control(parent, tag, name, text, icon, action) {
		var node = element(tag, 'media-viewer-' + name);
		if (tag === 'button') node.type = 'button';
		node.setAttribute('aria-label', text);
		node.title = text;
		var symbol = element('i', 'fa fa-' + icon);
		symbol.setAttribute('aria-hidden', 'true');
		node.appendChild(symbol);
		node.appendChild(element('span', 'media-viewer-control-label', text));
		if (action) node.addEventListener('click', action);
		parent.appendChild(node);
		return node;
	}

	function clearThumbnails() {
		thumbnailGeneration++;
		thumbnailCleanups.forEach(function(cleanup) { cleanup(); });
		thumbnailCleanups = [];
		thumbnailButtons = [];
		while (thumbnails.firstChild) thumbnails.removeChild(thumbnails.firstChild);
		thumbnails.scrollTop = thumbnails.scrollLeft = 0;
	}

	function frozenPreview(image) {
		var width = image.naturalWidth || image.width;
		var height = image.naturalHeight || image.height;
		if (!width || !height) return null;
		try {
			var canvas = document.createElement('canvas');
			var scale = Math.min(1, 200 / Math.max(width, height));
			canvas.width = Math.max(1, Math.round(width * scale));
			canvas.height = Math.max(1, Math.round(height * scale));
			canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
			return canvas.toDataURL('image/png');
		} catch (e) {
			// Cross-origin thumbnails keep their numbered fallback when canvas is tainted.
			return null;
		}
	}

	function thumbnailSource(item) {
		var file = item.link.parentElement;
		var thumb = item.link.querySelector('img.post-image, video.post-image');
		// A cached carousel preview must never reveal a hidden attachment.
		if (thumb && thumb.classList.contains('hidden')) return { url: null };
		var files = Array.prototype.filter.call(item.group.children, function(node) { return node.matches('.file'); });
		var carousel = item.group.querySelector('.attachment-carousel-thumbnails');
		var button = carousel && carousel.children[files.indexOf(file)];
		var preview = button && button.querySelector('img.attachment-carousel-preview');
		if (preview) return { url: preview.getAttribute('src'), image: preview };
		var canvas = item.link.querySelector('canvas.post-image');
		if (canvas) {
			var frozen = frozenPreview(canvas);
			if (frozen) return { url: frozen };
		}
		var source = thumb && thumb.getAttribute(thumb.tagName === 'VIDEO' ? 'poster' : 'src');
		return { url: source, image: thumb && thumb.tagName === 'IMG' ? thumb : null };
	}

	function addThumbnailPreview(button, item, token) {
		var source = thumbnailSource(item);
		if (!source.url) return;
		var url = source.url.trim();
		var remote = httpURL(url, item.link.baseURI);
		if (remote) {
			// A thumbnail configured as the original must not trigger a full-media preload.
			if (remote.href === item.url) return;
			url = remote.href;
		} else if (!/^data:image\/(png|jpe?g|gif|webp|avif|bmp);/i.test(url)) {
			return;
		}
		function current() { return token === thumbnailGeneration && button.isConnected && dialog.open; }
		function append(previewURL) {
			if (!previewURL || !current() || item.link.querySelector('.post-image.hidden')) return;
			var preview = element('img', 'media-viewer-preview');
			preview.alt = '';
			preview.draggable = false;
			preview.loading = 'lazy';
			preview.onerror = function() { if (current()) preview.remove(); };
			thumbnailCleanups.push(function() { preview.onerror = null; });
			preview.src = previewURL;
			button.insertBefore(preview, button.firstChild);
		}
		if (/\.gif(?:[?#]|$)|^data:image\/gif;/i.test(url)) {
			// Reuse a loaded GIF frame, or load only its thumbnail off-DOM before freezing it.
			if (source.image && source.image.complete && source.image.naturalWidth) {
				append(frozenPreview(source.image));
				return;
			}
			var still = new Image();
			still.onload = function() { if (current()) append(frozenPreview(still)); };
			thumbnailCleanups.push(function() {
				still.onload = null;
				still.removeAttribute('src');
			});
			still.src = url;
		} else {
			append(url);
		}
	}

	function buildThumbnails() {
		clearThumbnails();
		thumbnails.hidden = items.length < 2;
		if (thumbnails.hidden) return;
		var token = thumbnailGeneration;
		thumbnailButtons = items.map(function(item, position) {
			var button = element('button', 'media-viewer-thumbnail');
			button.type = 'button';
			button.tabIndex = -1;
			var label = 'Media ' + (position + 1) + ' of ' + items.length + ': ' + item.label + (item.type === 'video' ? ' (video)' : '');
			button.setAttribute('aria-label', label);
			button.title = label;
			button.addEventListener('click', function() {
				// Re-selecting the current media preserves playback and image zoom.
				if (position !== index) show(position);
				button.focus({ preventScroll: true });
			});
			var number = element('span', 'media-viewer-thumbnail-number', String(position + 1));
			number.setAttribute('aria-hidden', 'true');
			button.appendChild(number);
			if (item.type === 'video' && dialog.classList.contains('media-viewer-icons')) {
				var video = element('i', 'fa fa-play media-viewer-thumbnail-video');
				video.setAttribute('aria-hidden', 'true');
				button.appendChild(video);
			}
			thumbnails.appendChild(button);
			addThumbnailPreview(button, item, token);
			return button;
		});
	}

	function selectThumbnail() {
		thumbnailButtons.forEach(function(button, position) {
			button.tabIndex = position === index ? 0 : -1;
			if (position === index) button.setAttribute('aria-current', 'true');
			else button.removeAttribute('aria-current');
		});
		var button = thumbnailButtons[index];
		if (!button) return;
		var selected = button.getBoundingClientRect();
		var bounds = thumbnails.getBoundingClientRect();
		var padding = getComputedStyle(thumbnails);
		var left = bounds.left + thumbnails.clientLeft + (parseFloat(padding.paddingLeft) || 0);
		var right = bounds.left + thumbnails.clientLeft + thumbnails.clientWidth - (parseFloat(padding.paddingRight) || 0);
		// Keep the selected border and keyboard focus ring inside the scrollport.
		if (selected.left < left) thumbnails.scrollLeft -= left - selected.left;
		else if (selected.right > right) thumbnails.scrollLeft += selected.right - right;
	}

	function clearMedia() {
		generation++;
		if (media) {
			media.onload = media.onerror = media.onloadedmetadata = null;
			if (media.tagName === 'VIDEO') media.pause();
			media.removeAttribute('src');
			if (media.tagName === 'VIDEO') media.load();
			media.remove();
			media = null;
		}
		swipeStart = null;
		dialog.classList.remove('media-viewer-zoomed');
		stage.removeAttribute('tabindex');
		stage.removeAttribute('role');
		stage.removeAttribute('aria-label');
		stage.scrollTop = stage.scrollLeft = 0;
	}

	function pauseGroup(group) {
		group.querySelectorAll('video, audio').forEach(function(node) { node.pause(); });
	}

	function videoVolume() {
		try {
			var value = typeof window.setting === 'function' ? window.setting('videovolume') : 1;
			if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return 1;
			var volume = Number(value);
			return isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
		} catch (e) {
			// Private browsing or invalid stored settings must not prevent opening media.
			return 1;
		}
	}

	function show(number) {
		var restoreFocus = media && (media.contains(document.activeElement) || document.activeElement === stage);
		clearMedia();
		index = (number + items.length) % items.length;
		var item = items[index];
		previous.hidden = next.hidden = items.length < 2;
		previous.parentElement.hidden = items.length < 2;
		selectThumbnail();
		// The old media is removed; keep keyboard navigation inside the dialog while loading.
		if (restoreFocus) (thumbnailButtons[index] || close).focus({ preventScroll: true });
		var token = generation;
		pauseGroup(item.group);
		if (window.VichanAttachmentCarousel) window.VichanAttachmentCarousel.select(item.link, { expand: false });
		rememberHistorySelection();
		filename.textContent = item.label;
		filename.href = item.url;
		var sameOrigin = new URL(item.url).origin === window.location.origin;
		if (sameOrigin) filename.download = item.label;
		else filename.removeAttribute('download');
		var filenameAction = (sameOrigin ? 'Download ' : 'Open original: ') + item.label;
		filename.title = filenameAction;
		filename.setAttribute('aria-label', filenameAction);
		message.textContent = 'Loading ' + item.type + '…';
		message.hidden = false;
		stage.setAttribute('aria-busy', 'true');
		var node = element(item.type === 'image' ? 'img' : 'video', 'media-viewer-' + item.type);
		media = node;
		function current() { return token === generation && media === node && dialog.open; }
		function loaded() {
			if (!current()) return;
			node.hidden = false;
			message.hidden = true;
			stage.setAttribute('aria-busy', 'false');
			updateZoomAvailability();
		}
		node.onerror = function() {
			if (!current()) return;
			node.hidden = true;
			message.textContent = 'This media could not be loaded. Select the filename above to ' +
				(sameOrigin ? 'download it.' : 'open the original in a new tab.');
			message.hidden = false;
			stage.setAttribute('aria-busy', 'false');
		};
		if (item.type === 'image') {
			node.alt = item.label;
			node.draggable = false;
			node.hidden = true;
			node.onload = loaded;
			var pointerStart = null;
			node.addEventListener('pointerdown', function(e) {
				pointerStart = e.pointerType === 'mouse' && e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
			});
			node.addEventListener('pointercancel', function() { pointerStart = null; });
			node.addEventListener('click', function(e) {
				// Touch gestures keep the browser's native pinch zoom and image panning.
				var start = pointerStart;
				pointerStart = null;
				if (e.pointerType === 'touch' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
				if (e.detail === 0 || (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8)) toggleZoom();
			});
			node.addEventListener('keydown', function(e) {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				e.stopPropagation();
				toggleZoom();
			});
		} else {
			var volume = videoVolume();
			node.controls = true;
			node.playsInline = true;
			node.autoplay = true;
			node.loop = item.loop;
			node.volume = volume;
			node.muted = volume === 0;
			node.preload = 'metadata';
			node.tabIndex = 0;
			node.setAttribute('aria-label', item.label);
			node.onloadedmetadata = loaded;
		}
		stage.insertBefore(node, message);
		// Fetch only the selected original, including explicitly selected spoilers.
		node.src = item.url;
		if (item.type === 'video') {
			var playback = node.play();
			if (playback && typeof playback.catch === 'function') playback.catch(function(error) {
				if (!current() || error.name !== 'NotAllowedError' || node.muted) return;
				// Preserve automatic playback when the browser permits only muted video.
				node.muted = true;
				var retry = node.play();
				if (retry && typeof retry.catch === 'function') retry.catch(function() {
					// Native controls remain available if the browser still blocks playback.
				});
			});
		}
	}

	function canZoom() {
		if (!media || media.tagName !== 'IMG' || media.hidden || !media.naturalWidth) return false;
		var style = window.getComputedStyle(stage);
		var width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
		var height = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
		return media.naturalWidth > width + 1 || media.naturalHeight > height + 1;
	}

	function updateZoomAvailability() {
		if (!media || media.tagName !== 'IMG' || media.hidden) return;
		var zoomable = !!canZoom();
		media.classList.toggle('media-viewer-zoomable', zoomable);
		if (zoomable) {
			var expanded = dialog.classList.contains('media-viewer-zoomed');
			media.tabIndex = 0;
			media.setAttribute('role', 'button');
			media.setAttribute('aria-pressed', String(expanded));
			media.setAttribute('aria-label', (expanded ? 'Fit image to screen: ' : 'View at original size: ') + media.alt);
		} else {
			// A resize can make a previously enlarged image fit at its original size.
			if (dialog.classList.contains('media-viewer-zoomed')) toggleZoom();
			if (document.activeElement === media) (thumbnailButtons[index] || close).focus({ preventScroll: true });
			media.removeAttribute('tabindex');
			media.removeAttribute('role');
			media.removeAttribute('aria-pressed');
			media.removeAttribute('aria-label');
		}
	}

	function toggleZoom() {
		if (!media || media.tagName !== 'IMG' || media.hidden || !media.naturalWidth) return;
		if (!dialog.classList.contains('media-viewer-zoomed') && !canZoom()) return;
		var expanded = dialog.classList.toggle('media-viewer-zoomed');
		media.setAttribute('aria-pressed', String(expanded));
		media.setAttribute('aria-label', (expanded ? 'Fit image to screen: ' : 'View at original size: ') + media.alt);
		stage.scrollTop = stage.scrollLeft = 0;
		if (expanded) {
			stage.tabIndex = 0;
			stage.setAttribute('role', 'region');
			stage.setAttribute('aria-label', 'Full-size image. Use arrow keys to scroll, Enter to fit.');
			stage.focus({ preventScroll: true });
		} else {
			stage.removeAttribute('tabindex');
			stage.removeAttribute('role');
			stage.removeAttribute('aria-label');
			if (document.activeElement === stage) media.focus({ preventScroll: true });
		}
	}

	function visible(node) {
		return node && node.isConnected && node.getClientRects().length;
	}

	function clearPointerFocus() {
		if (!pointerFocusTarget) return;
		pointerFocusTarget.classList.remove('media-viewer-pointer-return');
		pointerFocusTarget.removeEventListener('blur', clearPointerFocus);
		pointerFocusTarget = null;
	}

	function restoreFocus(target, hideRing) {
		clearPointerFocus();
		if (!visible(target) || typeof target.focus !== 'function') return;
		// Keep the return position without inheriting a dialog's keyboard focus ring.
		if (hideRing) {
			pointerFocusTarget = target;
			target.classList.add('media-viewer-pointer-return');
			target.addEventListener('blur', clearPointerFocus);
		}
		target.focus({ preventScroll: true });
		if (document.activeElement !== target) clearPointerFocus();
	}

	function finish() {
		// A deferred close event can arrive after the viewer has reopened.
		if (dialog.open) return;
		var current = viewerState(history.state);
		var returnToPage = historyEntry && current && current.id === historyEntry.id;
		var item = items[index];
		var selected = item && item.link;
		var group = item && item.group;
		var focusTarget = group && group.querySelector('.attachment-carousel-thumbnail[aria-current="true"]');
		if (!visible(focusTarget)) focusTarget = group && group.querySelector('.attachment-carousel-caption a');
		if (!visible(focusTarget)) focusTarget = group && group.querySelector('.attachment-carousel-toggle');
		var target = visible(focusTarget) ? focusTarget : (visible(selected) ? selected : (visible(origin) ? origin : priorFocus));
		clearMedia();
		clearThumbnails();
		items = [];
		backdropStart = null;
		document.documentElement.classList.remove('media-viewer-open');
		restoreFocus(target, pointerOpened || !keyboardFocus);
		if (scroll) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
		origin = priorFocus = scroll = null;
		pointerOpened = false;
		historyEntry = null;
		if (returnToPage) {
			pendingHistoryBack = true;
			history.back();
		}
	}

	function build() {
		dialog = element('dialog', 'media-viewer');
		dialog.id = 'vichan-media-viewer';
		dialog.setAttribute('aria-label', 'Media viewer');
		var panel = element('div', 'media-viewer-panel');
		var header = element('div', 'media-viewer-header');
		var caption = element('span', 'media-viewer-caption');
		caption.setAttribute('role', 'status');
		caption.setAttribute('aria-live', 'polite');
		caption.setAttribute('aria-atomic', 'true');
		filename = element('a', 'media-viewer-download');
		filename.target = '_blank';
		filename.rel = 'noopener';
		caption.appendChild(filename);
		header.appendChild(caption);
		close = control(header, 'button', 'close', 'Close', 'times', function() { dialog.close(); });
		panel.appendChild(header);
		stage = element('div', 'media-viewer-stage');
		message = element('p', 'media-viewer-message');
		message.setAttribute('role', 'status');
		stage.appendChild(message);
		panel.appendChild(stage);
		// Recalculate after viewport, orientation, or dialog layout changes.
		if (window.ResizeObserver) new ResizeObserver(updateZoomAvailability).observe(stage);
		else window.addEventListener('resize', updateZoomAvailability);
		var footer = element('footer', 'media-viewer-footer');
		var toolbar = element('div', 'media-viewer-toolbar');
		previous = control(toolbar, 'button', 'previous', 'Previous', 'chevron-left', function() { show(index - 1); });
		thumbnails = element('div', 'media-viewer-thumbnails');
		thumbnails.setAttribute('role', 'group');
		thumbnails.setAttribute('aria-label', 'Choose media');
		toolbar.appendChild(thumbnails);
		next = control(toolbar, 'button', 'next', 'Next', 'chevron-right', function() { show(index + 1); });
		footer.appendChild(toolbar);
		panel.appendChild(footer);
		dialog.appendChild(panel);
		dialog.addEventListener('close', finish);
		dialog.addEventListener('keydown', function(e) {
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest('video, audio')) return;
			// The focusable full-size viewport keeps native keyboard scrolling.
			if (e.target === stage && dialog.classList.contains('media-viewer-zoomed')) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleZoom();
				}
				return;
			}
			if (e.key === 'ArrowLeft') show(index - 1);
			else if (e.key === 'ArrowRight') show(index + 1);
			else if (e.key === 'Home') show(0);
			else if (e.key === 'End') show(items.length - 1);
			else return;
			if (items.length > 1 && thumbnailButtons[index]) thumbnailButtons[index].focus({ preventScroll: true });
			e.preventDefault();
			e.stopPropagation();
		});
		dialog.addEventListener('pointerdown', function(e) {
			backdropStart = e.target === dialog && e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
		});
		dialog.addEventListener('pointercancel', function() { backdropStart = null; });
		dialog.addEventListener('click', function(e) {
			var start = backdropStart;
			backdropStart = null;
			if (start && e.target === dialog && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) dialog.close();
		});
		stage.addEventListener('touchstart', function(e) {
			var touch = e.touches[0];
			swipeStart = e.touches.length === 1 && media && media.tagName === 'IMG' && !dialog.classList.contains('media-viewer-zoomed') &&
				(!window.visualViewport || window.visualViewport.scale <= 1)
				? { x: touch.clientX, y: touch.clientY, time: Date.now() } : null;
		}, { passive: true });
		stage.addEventListener('touchcancel', function() { swipeStart = null; }, { passive: true });
		stage.addEventListener('touchend', function(e) {
			var start = swipeStart;
			swipeStart = null;
			if (!start || e.touches.length || e.changedTouches.length !== 1 || items.length < 2 ||
				(window.visualViewport && window.visualViewport.scale > 1)) return;
			var touch = e.changedTouches[0];
			var x = touch.clientX - start.x, y = touch.clientY - start.y;
			if (Date.now() - start.time < 700 && Math.abs(x) >= 60 && Math.abs(x) > Math.abs(y) * 1.5) show(index + (x < 0 ? 1 : -1));
		}, { passive: true });
		document.body.appendChild(dialog);
		var iconStyle = getComputedStyle(previous.querySelector('.fa'), '::before');
		dialog.classList.toggle('media-viewer-icons', iconStyle.content !== 'none' && iconStyle.content !== 'normal' && iconStyle.fontFamily.indexOf('FontAwesome') !== -1);
	}

	function open(link, selection, restoredEntry) {
		if (!supported) return false;
		var selected = attachment(link);
		if (!selected) return false;
		if (pendingHistoryBack) {
			queuedOpen = { link: link, selection: selection };
			return true;
		}
		var found = selection || collect(selected.group);
		var position = found.findIndex(function(item) { return item.link === link; });
		if (position === -1) return false;
		if (!dialog) build();
		if (!dialog.open) {
			origin = link;
			priorFocus = document.activeElement;
			scroll = { x: window.scrollX, y: window.scrollY };
			pointerOpened = !keyboardFocus;
			try { dialog.showModal(); } catch (e) { return false; }
			document.documentElement.classList.add('media-viewer-open');
		}
		items = found;
		historyEntry = restoredEntry || null;
		buildThumbnails();
		show(position);
		if (!restoredEntry) {
			var item = items[index];
			var entry = {
				id: Date.now() + '-' + ++historySerial,
				url: item.url,
				postId: item.group.getAttribute('data-post-id'),
				fileIndex: item.link.parentElement.getAttribute('data-file-index'),
				all: !!selection
			};
			try {
				history.pushState({ __vichanMediaViewer: entry }, '', location.href);
				historyEntry = entry;
			} catch (e) { historyEntry = null; }
		}
		close.focus({ preventScroll: true });
		return true;
	}

	function openAll() {
		var found = collectAll();
		return found.length ? open(found[0].link, found) : false;
	}

	window.VichanMediaViewer = { open: open, openAll: openAll };
	if (!supported) return;
	document.addEventListener('pointerdown', function() { keyboardFocus = false; }, true);
	document.addEventListener('keydown', function(e) {
		if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
		keyboardFocus = true;
		clearPointerFocus();
	}, true);
	window.addEventListener('popstate', function(e) {
		pendingHistoryBack = false;
		if (!restoreHistory(viewerState(e.state)) && dialog && dialog.open) {
			dialog.close();
		}
		if (queuedOpen) {
			var queued = queuedOpen;
			queuedOpen = null;
			open(queued.link, queued.selection);
		}
	});
	// Capture before the legacy inline-expansion handlers. Modified clicks keep native behavior.
	document.addEventListener('click', function(e) {
		if (e.button !== 0 || !e.target.closest) return;
		var link = e.target.closest('a');
		if (!link) return;
		if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
			// Some older expansion scripts only recognize Ctrl, not Command or Shift.
			if (attachment(link)) e.stopImmediatePropagation();
			return;
		}
		// Keyboard and assistive-technology activations can arrive without a keydown.
		if (e.detail === 0) keyboardFocus = true;
		var opened = link.matches('#expand-all-images a') ? openAll() : open(link);
		if (!opened) return;
		e.preventDefault();
		e.stopImmediatePropagation();
	}, true);
	document.addEventListener('play', function(e) {
		if (!dialog || !dialog.open || dialog.contains(e.target)) return;
		// A pending hover/autoplay callback must not restart the media behind the dialog.
		if (items.some(function(item) { return item.group.contains(e.target); })) e.target.pause();
	}, true);

	function updateBulkControl() {
		var expand = document.querySelector('#expand-all-images a');
		if (expand && expand.textContent !== 'View all media') expand.textContent = 'View all media';
		var shrink = document.getElementById('shrink-all-images');
		if (shrink) shrink.hidden = true;
	}

	function ready() {
		updateBulkControl();
		restoreHistory(viewerState(history.state));
		// The legacy control may be added after this script or by a refreshed thread.
		new MutationObserver(function(mutations) {
			if (mutations.some(function(mutation) { return mutation.addedNodes.length; })) updateBulkControl();
		}).observe(document.body, { childList: true, subtree: true });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
	else ready();
})();
