/*
 * Progressive enhancement for .files > .file; links and file order stay intact.
 * Register through additional_javascript. No carousel or hidden files without JS.
 */
(function() {
	'use strict';
	if (window.VichanAttachmentCarousel) return;
	var groups = new WeakMap();

	function pause(file) {
		file.querySelectorAll('video, audio').forEach(function(media) { media.pause(); });
	}

	function frozenFrame(image) {
		if (!image.naturalWidth || !image.naturalHeight) return null;
		try {
			var canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			canvas.getContext('2d').drawImage(image, 0, 0);
			return canvas;
		} catch (e) {
			return null;
		}
	}

	function restoreFrozenThumbnail(thumb) {
		var link = thumb.parentNode;
		// Cloning a canvas copies its dimensions, but not its bitmap.
		link.querySelectorAll('canvas.post-image').forEach(function(canvas) { canvas.remove(); });
		thumb.style.display = 'none';
		function restore() {
			if (!thumb.classList.contains('unanimated') || link.querySelector('canvas.post-image, .full-image')) return;
			var canvas = frozenFrame(thumb);
			if (!canvas) return;
			canvas.className = 'post-image';
			canvas.style.width = thumb.style.width;
			canvas.style.height = thumb.style.height;
			link.insertBefore(canvas, link.firstChild);
		}
		if (thumb.complete) restore();
		else thumb.addEventListener('load', restore, { once: true });
	}

	function enhance(group) {
		if (groups.has(group)) return;
		var files = Array.prototype.filter.call(group.children, function(file) { return file.matches('div.file'); });
		if (files.length < 2) return;
		var cloned = group.classList.contains('attachment-carousel');
		// A post preview may clone markup, but not this carousel's state or listeners.
		group.querySelectorAll('[data-carousel-ui], .attachment-carousel-controls').forEach(function(node) { node.remove(); });
		var state = { index: 0, all: false, expanded: false };

		function ui(tag, className) {
			var node = document.createElement(tag);
			node.className = className;
			node.setAttribute('data-carousel-ui', '');
			return node;
		}

		function button(parent, text, label, className, action) {
			var node = ui('button', className);
			node.type = 'button';
			node.textContent = text;
			node.setAttribute('aria-label', label);
			node.addEventListener('click', action);
			parent.appendChild(node);
			return node;
		}

		var header = ui('div', 'attachment-carousel-header');
		var label = ui('span', 'attachment-carousel-label');
		label.textContent = files.length + ' attachments';
		header.appendChild(label);
		var toggle = button(header, 'Show all', 'Show all attachments', 'attachment-carousel-toggle', function() {
			rememberExpansion();
			state.all = !state.all;
			render();
			if (!state.all) restoreExpansion();
		});
		var controls = ui('div', 'attachment-carousel-controls');
		controls.setAttribute('role', 'group');
		controls.setAttribute('aria-label', 'Attachments' + (group.dataset.postId ? ' for post ' + group.dataset.postId : ''));

		function navigation(direction, text, action) {
			var node = button(controls, '', text + ' attachment', 'attachment-carousel-' + direction, action);
			var icon = ui('i', 'fa fa-chevron-' + (direction === 'previous' ? 'left' : 'right'));
			icon.setAttribute('aria-hidden', 'true');
			var caption = ui('span', 'attachment-carousel-navigation-label');
			caption.textContent = text;
			if (direction === 'previous') node.appendChild(icon);
			node.appendChild(caption);
			if (direction === 'next') node.appendChild(icon);
			return node;
		}

		var previous = navigation('previous', 'Previous', function() { move(state.index - 1); });
		var counter = ui('span', 'attachment-carousel-counter');
		counter.setAttribute('role', 'status');
		counter.setAttribute('aria-live', 'polite');
		counter.setAttribute('aria-atomic', 'true');
		controls.appendChild(counter);
		var next = navigation('next', 'Next', function() { move(state.index + 1); });
		var rail = ui('div', 'attachment-carousel-thumbnails');
		rail.setAttribute('role', 'group');
		rail.setAttribute('aria-label', 'Choose attachment');
		var caption = ui('p', 'attachment-carousel-caption');
		var thumbnails = files.map(function(file, index) {
			var thumb = file.querySelector('img.post-image, video.post-image');
			var link = thumb && thumb.parentNode;
			if (cloned) {
				// Expanded clones inherit hidden thumbnails without working media handlers.
				var expandedImages = file.querySelectorAll('.full-image');
				expandedImages.forEach(function(image) { image.remove(); });
				var expandedVideo = false;
				Array.prototype.forEach.call(file.children, function(node) {
					if (node.matches('div') && node.querySelector('video') && node.querySelector('img[title="Collapse video"]')) {
						node.remove();
						expandedVideo = true;
					}
				});
				if (file.hasAttribute('data-carousel-width')) file.style.width = file.getAttribute('data-carousel-width');
				if (thumb && expandedImages.length) {
					thumb.style.display = thumb.classList.contains('unanimated') ? 'none' : '';
					thumb.style.opacity = '';
					thumb.style.filter = '';
				}
				if (link && link.matches('a')) {
					if (expandedVideo) link.style.display = '';
					if (window.jQuery) $(link).removeData('expanded imageLoading width');
				}
				if (thumb && thumb.matches('img.unanimated')) restoreFrozenThumbnail(thumb);
			} else {
				file.setAttribute('data-carousel-width', file.style.width);
			}
			Array.prototype.forEach.call(file.children, function(node) {
				if (node.matches('.post-image') || (node.matches('a') && node.querySelector('.post-image'))) node.classList.add('attachment-carousel-media');
			});
			var info = file.querySelector('.fileinfo');
			if (info) file.appendChild(info);
			var node = button(rail, '', 'Attachment ' + (index + 1) + ' of ' + files.length, 'attachment-carousel-thumbnail', function() { move(index); });
			var previewGeneration = 0, previewSource = null;
			function addPreview(url) {
				var preview = ui('img', 'attachment-carousel-preview');
				preview.alt = '';
				preview.loading = 'lazy';
				preview.draggable = false;
				preview.addEventListener('error', function() { preview.remove(); });
				preview.src = url;
				node.insertBefore(preview, node.firstChild);
			}
			function syncPreview() {
				// The live thumbnail is authoritative, including hide-images.js changes.
				var source = thumb && !thumb.classList.contains('hidden') ? thumb.getAttribute(thumb.tagName === 'VIDEO' ? 'poster' : 'src') : '';
				source = (source || '').trim();
				file.setAttribute('data-carousel-preview-src', source);
				if (source === previewSource) return;
				previewSource = source;
				var token = ++previewGeneration;
				node.querySelectorAll('.attachment-carousel-preview').forEach(function(preview) { preview.remove(); });
				if (!source) return;
				if (/\.gif(?:[?#]|$)/i.test(source)) {
					// Load GIFs off-DOM so the filmstrip never flashes an animated frame.
					var still = new Image();
					still.addEventListener('load', function() {
						if (token !== previewGeneration || thumb.classList.contains('hidden')) return;
						var canvas = frozenFrame(still);
						if (!canvas) return;
						try { addPreview(canvas.toDataURL('image/png')); }
						catch (e) { /* A tainted canvas keeps the numbered fallback. */ }
					}, { once: true });
					still.src = source;
				} else {
					addPreview(source);
				}
			}
			syncPreview();
			if (thumb) new MutationObserver(syncPreview).observe(thumb, { attributes: true, attributeFilter: ['src', 'poster', 'class'] });
			var number = ui('span', 'attachment-carousel-thumbnail-number');
			number.textContent = index + 1;
			number.setAttribute('aria-hidden', 'true');
			node.appendChild(number);
			return node;
		});

		function imageLink(file) {
			if (!window.jQuery) return null;
			var thumb = file.querySelector('a:not(.file) > .post-image');
			var link = thumb && thumb.parentNode;
			// Gallery mode owns its clicks; documents and videos keep their own handlers.
			return link && typeof link.onclick === 'function' && !link.hasAttribute('data-galid') ? link : null;
		}

		function rememberExpansion() {
			var link = imageLink(files[state.index]);
			if (link) state.expanded = !!$(link).data('expanded');
		}

		function restoreExpansion() {
			var link = imageLink(files[state.index]);
			if (link && !!$(link).data('expanded') !== state.expanded) $(link).trigger('click');
			syncExpansion();
		}

		function syncExpansion() {
			group.classList.toggle('attachment-carousel-expanded', !!files[state.index].querySelector('.full-image'));
		}

		function updateCaption(file) {
			var info = file.querySelector('.fileinfo');
			var source = info && (info.querySelector('a[download]') || info.querySelector('span:first-child > a[href]:not(.hide-image-link):not(.show-image-link)'));
			caption.textContent = '';
			if (!source) {
				caption.textContent = file.querySelector('.post-image.deleted') ? 'Attachment deleted' : 'Attachment ' + (state.index + 1);
				return;
			}
			// Keep original metadata and its links intact for other enhancements and Show all.
			var filename = ui('a', 'attachment-carousel-filename');
			['href', 'download', 'target', 'rel'].forEach(function(attribute) {
				if (source.hasAttribute(attribute)) filename.setAttribute(attribute, source.getAttribute(attribute));
			});
			var spoiler = file.querySelector('[data-seasonal-photo="spoiler"]');
			filename.textContent = (!spoiler && source.getAttribute('download')) || source.textContent.trim();
			filename.title = filename.textContent;
			caption.appendChild(filename);
		}

		function render() {
			var focused = document.activeElement;
			var keepFocus = controls.contains(focused) || rail.contains(focused);
			group.classList.toggle('attachment-carousel-all', state.all);
			syncExpansion();
			files.forEach(function(file, index) {
				var inactive = !state.all && index !== state.index;
				file.classList.toggle('attachment-carousel-inactive', inactive);
				file.hidden = inactive;
				if (inactive) pause(file);
				thumbnails[index].tabIndex = index === state.index ? 0 : -1;
				if (index === state.index) thumbnails[index].setAttribute('aria-current', 'true');
				else thumbnails[index].removeAttribute('aria-current');
			});
			var active = files[state.index];
			if (controls.parentNode !== active) {
				var info = active.querySelector('.fileinfo');
				active.insertBefore(controls, info);
				active.insertBefore(rail, info);
				active.insertBefore(caption, info);
			}
			updateCaption(active);
			controls.hidden = rail.hidden = caption.hidden = state.all;
			counter.textContent = (state.index + 1) + ' of ' + files.length;
			previous.disabled = next.disabled = state.all;
			toggle.textContent = state.all ? 'Show one' : 'Show all';
			toggle.setAttribute('aria-label', state.all ? 'Show one attachment' : 'Show all attachments');
			toggle.setAttribute('aria-pressed', String(state.all));
			if (!state.all) {
				if (keepFocus && focused !== document.activeElement) focused.focus({ preventScroll: true });
			}
		}

		function move(index, options) {
			var expand = !options || options.expand !== false;
			if (expand) rememberExpansion();
			else state.expanded = false;
			state.index = (index + files.length) % files.length;
			render();
			if (!state.all && expand) restoreExpansion();
		}

		function keyboard(e, focusThumbnail) {
			if (state.all || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
			if (e.key === 'ArrowLeft') move(state.index - 1);
			else if (e.key === 'ArrowRight') move(state.index + 1);
			else if (e.key === 'Home') move(0);
			else if (e.key === 'End') move(files.length - 1);
			else return;
			if (focusThumbnail) thumbnails[state.index].focus({ preventScroll: true });
			e.preventDefault();
			e.stopPropagation();
		}
		controls.addEventListener('keydown', function(e) { keyboard(e, false); });
		rail.addEventListener('keydown', function(e) { keyboard(e, true); });
		group.addEventListener('click', function(e) {
			if (!e.target.closest('[data-carousel-ui]')) {
				rememberExpansion();
				syncExpansion();
			}
		});
		groups.set(group, { select: function(file, options) {
			var index = files.indexOf(file);
			if (index !== -1) move(index, options);
		} });
		group.classList.add('attachment-carousel');
		group.insertBefore(header, group.firstChild);
		render();
		// Styles can only be resolved after the controls are in the document.
		var iconStyle = getComputedStyle(previous.querySelector('.fa'), '::before');
		group.classList.toggle('attachment-carousel-icons', iconStyle.content !== 'none' && iconStyle.content !== 'normal' && iconStyle.fontFamily.indexOf('FontAwesome') !== -1);
	}

	function init(root) {
		if (root.matches && root.matches('.files')) enhance(root);
		root.querySelectorAll('.files').forEach(enhance);
		// An OP's attachments are siblings before .post.op, not its descendants.
		if (root.matches && root.matches('.post.op')) {
			var files = root.previousElementSibling;
			if (files && files.matches('.files')) enhance(files);
		}
	}

	function selectAttachment(link, options) {
		var file = link.closest('.files > .file');
		if (!file) return;
		var state = groups.get(file.parentNode);
		if (state) state.select(file, options);
	}

	window.VichanAttachmentCarousel = { init: init, select: selectAttachment };
	function ready() {
		init(document);
		// Catch delayed autoplay/loadedmetadata after switching away from a video.
		document.addEventListener('play', function(e) {
			if (e.target.closest('.attachment-carousel-inactive')) e.target.pause();
		}, true);
		if (window.jQuery) $(document).on('new_post.attachmentCarousel', function(e, post) {
			$(post).each(function() { init(this); });
		});
		// Hover previews clone existing markup without emitting new_post.
		var observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				mutation.addedNodes.forEach(function(node) {
					if (node.nodeType === 1) init(node);
				});
			});
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
	else ready();
})();
