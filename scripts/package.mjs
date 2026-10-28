/**
 * 將 src/ 打包為 dist/front-end-glossary.zip（根目錄為 front-end-glossary/，WordPress 更新時會依此覆蓋原資料夾）。
 *
 * 用法：
 *   node scripts/package.mjs                 打包
 *   node scripts/package.mjs --check 1.2.3   檢查外掛標頭的版本號是否為 1.2.3（CI 用）
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const SLUG = "front-end-glossary";

const version = readFileSync(join(SRC, `${SLUG}.php`), "utf8").match(/^\s*\*\s*Version:\s*(.+)$/m)?.[1].trim();

if(process.argv[2] === "--check") {
	const expected = process.argv[3];
	if(version !== expected) {
		console.error(`外掛標頭的版本號（${version}）與 tag（${expected}）不一致`);
		process.exit(1);
	}
	console.log(`版本號一致：${expected}`);
	process.exit(0);
}

/** @type {Record<string, Uint8Array>} */
const files = {};
function add(path) {
	if(statSync(path).isDirectory()) {
		for(const name of readdirSync(path)) add(join(path, name));
	} else {
		files[`${SLUG}/${relative(SRC, path).split(sep).join("/")}`] = readFileSync(path);
	}
}
add(SRC);

const zip = zipSync(files, { level: 9 });
mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist", `${SLUG}.zip`), zip);
console.log(`dist/${SLUG}.zip：v${version}，${Object.keys(files).length} 個檔案，${(zip.length / 1024).toFixed(0)} KB`);
