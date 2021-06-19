(async function() {
	if(location.href.includes("trp-edit-translation")) return;

	let script = document.currentScript || Array.prototype.slice.call(document.getElementsByTagName('script')).pop();
	let response = await fetch(script.dataset.url, {
		cache: 'force-cache'
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
			if(e.p) return new RegExp(`\\b(${e.s}|${e.p})\\b`, "i")
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

	await new Promise(resolve => {
		setTimeout(() => resolve(), 500);
	});
	await new Promise(resolve => {
		let int = setInterval(() => {
			if(typeof jQuery !== "undefined " && jQuery.fn.popover) {
				clearInterval(int);
				resolve();
			}
		}, 10);
	});
	const $ = jQuery;

	function visit(node, found, reg, key, title, cross) {
		if(node instanceof Text) {
			const text = node.wholeText;
			let result = reg.exec(text);
			if(result) {
				let match = result[0];
				let i = result.index;
				let before = text.substring(0, i);
				let after = text.substr(i + match.length);
				let html;
				if(cross) {
					if(cross == key || found) {
						html = `<span>${before}</span><a>${match}</a><span>${after}</span>`;
					} else {
						html = `<span>${before}</span><a class="feg" href="#${key}">${match}</a><span>${after}</span>`;
					}
				} else {
					if(found) {
						html = `<span>${before}</span><a>${match}</a><span>${after}</span>`;
					} else {
						let url = `https://origami.abstreamace.com/${isEN ? "" : "zh/"}origami-glossary/#${key}`;
						let content = `${title}<br><a href='${url}'>&gt;&gt;${isEN ? "Origami glossary" : "摺紙詞彙表"}</a>`;
						html = `<span>${before}</span><span class="feg" data-toggle="popover"
							data-content="${content}">${match}</span><span>${after}</span>`;
					}
				}
				$(node).replaceWith(html);
				return true;
			}
			return false;
		} else {
			let tag = node.tagName?.toLowerCase();
			if(tag == "header" || tag == "h1" || tag == "a") return false;
			if(node.classList?.contains("feg")) return false;
			for(let c of node.childNodes) {
				found = visit(c, found, reg, key, title, cross) || found;
			}
			return found;
		}
	}

	let article = [...document.querySelectorAll("article.post")].map(a => [a, a.innerText]);
	let cross = [...document.querySelectorAll(".cross-ref")].map(c => [c, c.innerText]);
	for(let e of json) {
		let title = desc(e).replace(/"/g, "&quot;");
		let key = 'glossary-' + e.s.replace(/ /g, '-');
		for(let [c, text] of cross) {
			if(!text.match(e.reg)) continue;
			let id = $(c).siblings('a').first().attr('id');
			visit(c, false, e.reg, key, null, id);
		}
		for(let [a, text] of article) {
			if(!text.match(e.reg)) continue;
			if(visit(a, false, e.reg, key, title, null)) break;
		}
	}

	let previous;
	$('[data-toggle="popover"]').popover({ trigger: "manual", html: true, placement: "top" })
		.on('show.bs.popover', function() {
			if(previous) $(previous).popover("hide");
			previous = this;
		})
		.on("mouseenter", function() {
			let self = this;
			$(this).popover("show");
			clearInterval(this.int);
			$(".popover").on("mouseleave", function() {
				$(self).popover('hide');
			});
		}).on("mouseleave", function() {
			let self = this;
			this.int = setInterval(function() {
				if(!$(".popover:hover").length) {
					clearInterval(self.int);
					$(self).popover("hide");
				}
			}, 300);
		});

})();