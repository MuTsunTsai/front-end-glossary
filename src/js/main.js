(async function() {
	if(location.href.includes("trp-edit-translation")) return;

	let script = document.currentScript || Array.prototype.slice.call(document.getElementsByTagName('script')).pop();
	let response = await fetch(script.dataset.url, {
		cache: 'force-cache'
	});
	let json = JSON.parse(await response.json()), key, find, desc;

	if(document.documentElement.lang == "en-US") {
		key = e => e.s;
		find = e => {
			if(!e.s) return null;
			if(e.p) return new RegExp(`\\b(${e.s}|${e.p})\\b`, "i")
			return new RegExp(`\\b${e.s}\\b`, "i");
		};
		desc = e => e.d;
	} else {
		key = e => e.c;
		find = e => e.c && new RegExp(e.c);
		desc = e => e.t;
	}
	for(let e of json) e.reg = find(e);
	json = json.filter(e => e.reg);
	json.sort((e1, e2) => key(e2).length - key(e1).length); // longer key goes first

	await new Promise(resolve => {
		setTimeout(() => resolve(), 500);
	});

	function visit(reg, title, node) {
		if(node instanceof Text) {
			const text = node.wholeText;
			let result = reg.exec(text);
			if(result) {
				let found = result[0];
				let i = result.index;
				let before = text.substring(0, i);
				let after = text.substr(i + found.length);
				let html = `<span>${before}</span><span class="feg" data-toggle="tooltip" title="${title}">${found}</span><span>${after}</span>`;
				jQuery(node).replaceWith(html);
				return true;
			}
			return false;
		} else {
			let tag = node.tagName?.toLowerCase();
			if(tag == "header" || tag == "h1" || tag == "a") return false;
			if(node.classList?.contains("feg")) return false;
			for(let c of node.childNodes) if(visit(reg, title, c)) return true;
			return false;
		}
	}

	let article = document.querySelectorAll("article.post");
	for(let e of json) {
		let title = desc(e).replace(/"/g, "&quot;");
		for(let a of article) if(visit(e.reg, title, a)) break;
	}
	jQuery('[data-toggle="tooltip"]').tooltip();
})();