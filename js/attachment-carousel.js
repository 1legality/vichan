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

	function enhance(group) {
		if (groups.has(group)) return;
		var files = Array.prototype.filter.call(group.children, function(file) { return file.matches('div.file'); });
		if (files.length < 2) return;
		// A post preview may be a DOM clone of an already enhanced post.
		Array.prototype.filter.call(group.children, function(node) {
			return node.classList.contains('attachment-carousel-controls');
		}).forEach(function(node) { node.remove(); });
		var state = { index: 0, all: false, expanded: false };
		var controls = document.createElement('div');
		controls.className = 'attachment-carousel-controls';
		controls.setAttribute('role', 'group');
		controls.setAttribute('aria-label', 'Attachments' + (group.dataset.postId ? ' for post ' + group.dataset.postId : ''));

		function button(text, label, action) {
			var node = document.createElement('button');
			node.type = 'button';
			node.textContent = text;
			node.setAttribute('aria-label', label);
			node.addEventListener('click', action);
			controls.appendChild(node);
			return node;
		}

		var previous = button('‹', 'Previous attachment', function() { move(state.index - 1); });
		var counter = document.createElement('span');
		counter.setAttribute('role', 'status');
		counter.setAttribute('aria-live', 'polite');
		counter.setAttribute('aria-atomic', 'true');
		controls.appendChild(counter);
		var next = button('›', 'Next attachment', function() { move(state.index + 1); });
		var toggle = button('Show all', 'Show all attachments', function() {
			rememberExpansion();
			state.all = !state.all;
			render();
			if (!state.all) restoreExpansion();
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
		}

		function render() {
			files.forEach(function(file, index) {
				var inactive = !state.all && index !== state.index;
				file.classList.toggle('attachment-carousel-inactive', inactive);
				file.hidden = inactive;
				if (inactive) pause(file);
			});
			counter.textContent = state.all ? 'All ' + files.length + ' attachments' : (state.index + 1) + ' / ' + files.length;
			previous.disabled = next.disabled = state.all;
			toggle.textContent = state.all ? 'Show one' : 'Show all';
			toggle.setAttribute('aria-label', state.all ? 'Show one attachment' : 'Show all attachments');
			toggle.setAttribute('aria-pressed', String(state.all));
		}

		function move(index) {
			rememberExpansion();
			state.index = (index + files.length) % files.length;
			render();
			if (!state.all) restoreExpansion();
		}

		controls.addEventListener('keydown', function(e) {
			if (state.all || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
			if (e.key === 'ArrowLeft') move(state.index - 1);
			else if (e.key === 'ArrowRight') move(state.index + 1);
			else if (e.key === 'Home') move(0);
			else if (e.key === 'End') move(files.length - 1);
			else return;
			e.preventDefault();
			e.stopPropagation();
		});
		groups.set(group, { select: function(file) { move(files.indexOf(file)); } });
		group.classList.add('attachment-carousel');
		group.insertBefore(controls, group.firstChild);
		render();
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

	function selectAttachment(link) {
		var file = link.closest('.files > .file');
		if (!file) return;
		var state = groups.get(file.parentNode);
		if (state) state.select(file);
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
