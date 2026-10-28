(async function() {
	if(location.href.includes("trp-edit-translation")) return;

	let script = document.currentScript || Array.prototype.slice.call(document.getElementsByTagName("script")).pop();
	let response = await fetch(script.dataset.url, {
		cache: "force-cache"
	});
	let json = JSON.parse(await response.json()), key, find, desc;
	let isEN = document.documentElement.lang == "en-US";

	function abbr(e) {
		return e.p ? new RegExp(`\\b(${e.s}|${e.p})\\b`) : new RegExp(`\\b${e.s}\\b`);
	}
	if(isEN) {
		key = e => e.s;
		find = e => {
			if(!e.s) return null;
			if(e.a) return abbr(e);
			if(e.p) return new RegExp(`\\b(${e.s}|${e.p})\\b`, "i");
			return new RegExp(`\\b${e.s}\\b`, "i");
		};
		desc = e => e.d;
	} else {
		key = e => e.c;
		find = e => e.a ? abbr(e) : e.c && new RegExp(e.c);
		desc = e => e.t;
	}
	for(let e of json) e.reg = find(e);
	json = json.filter(e => e.reg);
	json.sort((e1, e2) => key(e2).length - key(e1).length); // longer key goes first

	// 不處理的元素；程式碼與數學式會由佈景主題另外渲染，不能先被拆開
	const SKIP = new Set(["header", "h1", "a", "code", "pre", "kbd", "script", "style", "textarea"]);

	/** 把 text 中第一個符合 reg 的部分換成 wrapper，傳回剩下的文字節點 */
	function split(text, reg, wrapper) {
		let result = reg.exec(text.data);
		if(!result) return null;
		let match = text.splitText(result.index);
		let after = match.splitText(result[0].length);
		wrapper.append(match.data);
		match.replaceWith(wrapper);
		return after;
	}

	/**
	 * 在 node 底下尋找詞彙；第一次出現的地方加上浮動說明（或交叉參照連結），
	 * 之後出現的地方只做標記，避免較短的詞彙再比對到其中的文字。
	 */
	function visit(node, found, reg, key, index, cross) {
		if(node instanceof Text) {
			let matched = false, rest = node;
			while(rest) {
				let wrapper;
				if(cross ? cross == key || found : found) {
					wrapper = document.createElement("span");
					wrapper.className = "feg-seen";
				} else if(cross) {
					wrapper = document.createElement("a");
					wrapper.className = "feg";
					wrapper.href = "#" + key;
				} else {
					wrapper = document.createElement("span");
					wrapper.className = "feg";
					wrapper.dataset.feg = index;
					wrapper.tabIndex = 0;
				}
				rest = split(rest, reg, wrapper);
				if(rest) matched = found = true;
			}
			return matched;
		} else {
			let tag = node.tagName?.toLowerCase();
			if(SKIP.has(tag)) return false;
			if(node.classList?.contains("feg") || node.classList?.contains("feg-seen") || node.classList?.contains("katex")) return false;
			for(let c of [...node.childNodes]) {
				found = visit(c, found, reg, key, index, cross) || found;
			}
			return found;
		}
	}

	let article = [...document.querySelectorAll("article.post")].map(a => [a, a.innerText]);
	let cross = [...document.querySelectorAll(".cross-ref")].map(c => [c, c.innerText]);
	json.forEach((e, index) => {
		let key = "glossary-" + e.s.replace(/ /g, "-");
		for(let [c, text] of cross) {
			if(!text.match(e.reg)) continue;
			let id = [...c.parentElement.children].find(s => s != c && s.tagName == "A")?.id;
			visit(c, false, e.reg, key, index, id);
		}
		for(let [a, text] of article) {
			if(!text.match(e.reg)) continue;
			if(visit(a, false, e.reg, key, index, null)) break;
		}
	});

	let terms = document.querySelectorAll(".feg[data-feg]");
	if(!terms.length) return;

	/////////////////////////////////////////////////////////////////////////////////////////////
	// 浮動說明（以 Popper 定位）
	/////////////////////////////////////////////////////////////////////////////////////////////

	const tip = document.createElement("div");
	tip.className = "feg-popover";
	tip.id = "feg-popover";
	tip.setAttribute("role", "tooltip");
	tip.hidden = true;
	document.body.append(tip);

	let current = null, popper = null, timer;

	function show(term) {
		clearTimeout(timer);
		if(current == term) return;
		hide();
		let e = json[term.dataset.feg];
		let url = `https://origami.abstreamace.com/${isEN ? "" : "zh/"}origami-glossary/#glossary-${e.s.replace(/ /g, "-")}`;
		let title = document.createElement("span");
		title.className = "feg-popover__title";
		title.textContent = key(e);
		let body = document.createElement("div");
		body.className = "feg-popover__body";
		body.innerHTML = desc(e); // 描述可以含有 HTML
		let more = document.createElement("a");
		more.className = "feg-popover__more";
		more.href = url;
		more.textContent = isEN ? "Origami glossary »" : "摺紙詞彙表 »";
		tip.replaceChildren(title, body, more);
		tip.hidden = false;
		term.setAttribute("aria-describedby", tip.id);
		current = term;
		popper = Popper.createPopper(term, tip, {
			placement: "top",
			modifiers: [
				{ name: "offset", options: { offset: [0, 8] } },
				{ name: "preventOverflow", options: { padding: 8 } },
			],
		});
	}

	function hide() {
		clearTimeout(timer);
		if(!current) return;
		current.removeAttribute("aria-describedby");
		current = null;
		popper.destroy();
		popper = null;
		tip.hidden = true;
	}

	// 延遲關閉，讓滑鼠可以移進浮動說明（例如點裡面的連結）
	function hideLater() {
		clearTimeout(timer);
		timer = setTimeout(hide, 300);
	}

	for(let term of terms) {
		term.addEventListener("mouseenter", () => show(term));
		term.addEventListener("mouseleave", hideLater);
		term.addEventListener("focus", () => show(term));
		term.addEventListener("blur", hideLater);
		term.addEventListener("click", () => show(term)); // 觸控裝置
	}
	tip.addEventListener("mouseenter", () => clearTimeout(timer));
	tip.addEventListener("mouseleave", hideLater);
	tip.addEventListener("focusin", () => clearTimeout(timer));
	tip.addEventListener("focusout", hideLater);
	document.addEventListener("click", event => {
		if(!tip.contains(event.target) && !event.target.closest?.(".feg[data-feg]")) hide();
	});
	document.addEventListener("keydown", event => {
		if(event.key == "Escape") hide();
	});
})();
