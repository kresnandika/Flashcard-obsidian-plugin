/**
 * Script injected into every card frame. Cards run in a sandboxed iframe
 * without same-origin access, so this is the only channel to the plugin:
 *  - forwards key presses (Space, 1–4, …) unless the user is typing,
 *  - reports clicks on replay buttons and what's typed into {{type:}} inputs,
 *  - shims sessionStorage/localStorage (blocked in sandboxed frames) so deck
 *    scripts that carry state from the front to the back still work,
 *  - toggles {{hint:}} fields and runs Anki's onShownHook callbacks.
 *
 * It's written as plain ES5 inside a string because it runs in the card
 * document, not in the plugin bundle.
 */
export interface BridgeOptions {
	token: string;
	storage: Record<string, string>;
	focusEditable: boolean;
}

export const BRIDGE_MESSAGE_SOURCE = "flashcard-srs-card";

export function bridgeScript(options: BridgeOptions): string {
	const config = JSON.stringify({ token: options.token, storage: options.storage, focus: options.focusEditable, source: BRIDGE_MESSAGE_SOURCE }).replace(/</g, "\\u003c");
	return `(function () {
	var config = ${config};
	var store = config.storage || {};
	function post(message) {
		message.source = config.source;
		message.token = config.token;
		window.parent.postMessage(message, "*");
	}
	var shim = {
		getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
		setItem: function (key, value) { store[key] = String(value); post({ type: "storage", key: String(key), value: String(value) }); },
		removeItem: function (key) { delete store[key]; post({ type: "storage", key: String(key), value: null }); },
		clear: function () { for (var key in store) { post({ type: "storage", key: key, value: null }); } store = {}; },
		key: function (index) { return Object.keys(store)[index] || null; }
	};
	Object.defineProperty(shim, "length", { get: function () { return Object.keys(store).length; } });
	["sessionStorage", "localStorage"].forEach(function (name) {
		try { Object.defineProperty(window, name, { value: shim, configurable: true }); } catch (e) { /* keep the native one */ }
	});
	window.pycmd = function () {};
	window.ankiPlatform = "desktop";
	window.onUpdateHook = [];
	window.onShownHook = [];

	function isEditable(target) {
		return target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
	}
	document.addEventListener("keydown", function (event) {
		if (event.isComposing || event.keyCode === 229) return;
		var editable = isEditable(event.target);
		if (editable) {
			if (event.key === "Escape") { event.target.blur(); return; }
			if (event.key !== "Enter" || event.shiftKey) return;
		}
		if (event.key === " " || event.key === "Enter") event.preventDefault();
		post({ type: "key", key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, altKey: event.altKey });
	}, true);
	document.addEventListener("click", function (event) {
		var target = event.target;
		while (target && target !== document) {
			if (target.getAttribute && target.getAttribute("data-fc-sound") !== null) {
				event.preventDefault();
				post({ type: "sound", index: Number(target.getAttribute("data-fc-sound")) });
				return;
			}
			if (target.getAttribute && target.getAttribute("data-fc-hint")) {
				event.preventDefault();
				var hint = document.getElementById(target.getAttribute("data-fc-hint"));
				if (hint) { hint.style.display = "block"; target.style.display = "none"; }
				return;
			}
			target = target.parentNode;
		}
	});
	document.addEventListener("input", function (event) {
		if (event.target && event.target.id === "typeans") post({ type: "typed", value: event.target.value });
	});
	window.addEventListener("load", function () {
		window.onShownHook.forEach(function (hook) { try { hook(); } catch (e) { console.error(e); } });
		if (config.focus && !isEditable(document.activeElement)) {
			var first = document.querySelector("#typeans, textarea, input[type=text]");
			if (first) first.focus();
		}
	});
})();`;
}
