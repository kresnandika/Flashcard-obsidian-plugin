import { describe, expect, it } from "vitest";
import { buildCardDocument, stripScripts } from "../../src/rendering/cardDocument";
import { collectMediaReferences, extractSounds, mimeType, rewriteMediaUrls, toDataUri } from "../../src/rendering/media";
import { renderTypeComparison } from "../../src/rendering/typeAnswer";

describe("extractSounds", () => {
	it("replaces sound tags with replay buttons and lists the files", () => {
		const { html, sounds } = extractSounds("a [sound:x.mp3] b [sound:y &amp; z.mp3]", 2);
		expect(sounds).toEqual(["x.mp3", "y & z.mp3"]);
		expect(html).toContain('data-fc-sound="2"');
		expect(html).toContain('data-fc-sound="3"');
		expect(html).not.toContain("[sound:");
	});
});

describe("rewriteMediaUrls", () => {
	const resolve = (name: string) => (name === "猫.jpg" || name === "font.ttf" ? `app://m/${name}` : null);

	it("rewrites relative src attributes and CSS urls", () => {
		expect(rewriteMediaUrls('<img src="猫.jpg">', resolve)).toBe('<img src="app://m/猫.jpg">');
		expect(rewriteMediaUrls("<img src='%E7%8C%AB.jpg'>", resolve)).toBe("<img src='app://m/猫.jpg'>");
		expect(rewriteMediaUrls("@font-face { src: url('font.ttf'); }", resolve)).toBe("@font-face { src: url('app://m/font.ttf'); }");
	});

	it("leaves absolute and unknown URLs alone", () => {
		expect(rewriteMediaUrls('<img src="https://x/y.png">', resolve)).toBe('<img src="https://x/y.png">');
		expect(rewriteMediaUrls('<img src="data:image/png;base64,AA">', resolve)).toBe('<img src="data:image/png;base64,AA">');
		expect(rewriteMediaUrls('<img src="missing.png">', resolve)).toBe('<img src="missing.png">');
	});
});

describe("buildCardDocument", () => {
	const base = {
		html: '<div onclick="x()">hi</div><script>alert(1)</script>',
		css: ".card { color: red }",
		ord: 1,
		theme: { dark: true, textColor: "#ddd", ground: "#1e1e1e", muted: "#aaa", faint: "#777", accent: "#d4604f", font: "system-ui" },
		resolveMedia: () => null,
		token: "t",
		storage: {},
		focusEditable: false,
	};

	it("adds Anki's body classes and night mode", () => {
		const doc = buildCardDocument({ ...base, runDeckScripts: true });
		expect(doc).toContain('<body class="card card2 nightMode night_mode">');
		expect(doc).toContain(".card { color: red }");
		expect(doc).toContain("alert(1)");
	});

	it("strips deck scripts when they're disabled, keeping the bridge", () => {
		const doc = buildCardDocument({ ...base, runDeckScripts: false });
		expect(doc).not.toContain("alert(1)");
		expect(doc).not.toContain("onclick");
		expect(doc).toContain("flashcard-srs-card");
	});

	it("stripScripts removes inline handlers", () => {
		expect(stripScripts('<a href="#" onmouseover=\'go()\'>x</a>')).toBe('<a href="#">x</a>');
	});
});

describe("renderTypeComparison", () => {
	it("marks extra and missing characters", () => {
		const html = renderTypeComparison("nihoa", "nihao");
		expect(html).toContain('class="typeGood">nih<');
		expect(html).toContain("&darr;");
	});
});

describe("media inlining helpers", () => {
	it("collects every relative reference from HTML and CSS", () => {
		const refs = collectMediaReferences('<img src="a.jpg"><img src="https://x/y.png"><style>@font-face{src:url(f.ttf)}</style>');
		expect(refs).toContain("a.jpg");
		expect(refs).toContain("f.ttf");
		expect(refs.some((ref) => ref.startsWith("https"))).toBe(false);
	});

	it("encodes bytes as a data URI with the right type", () => {
		expect(mimeType("photo.JPEG")).toBe("image/jpeg");
		expect(mimeType("noext")).toBe("application/octet-stream");
		expect(toDataUri(new Uint8Array([104, 105]), "a.png")).toBe("data:image/png;base64,aGk=");
	});
});
