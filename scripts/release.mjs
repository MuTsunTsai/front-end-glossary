/**
 * 發佈新版本：更新版本號、commit、建立 tag 並推送；之後由 GitHub Actions 打包並發佈 Release。
 *
 * 用法：pnpm release [patch|minor|major|x.y.z]（預設 patch）
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const run = cmd => execSync(cmd, { cwd: ROOT, stdio: "inherit" });

if(execSync("git status --porcelain", { cwd: ROOT }).toString().trim()) {
	console.error("工作目錄有尚未 commit 的變更，請先處理後再發佈。");
	process.exit(1);
}

const pkgPath = join(ROOT, "package.json");
const mainPath = join(ROOT, "src", "front-end-glossary.php");
const pkg = readFileSync(pkgPath, "utf8");
const current = JSON.parse(pkg).version;

const arg = process.argv[2] ?? "patch";
let next;
if(/^\d+\.\d+\.\d+$/.test(arg)) {
	next = arg;
} else {
	const [major, minor, patch] = current.split(".").map(Number);
	next = {
		major: `${major + 1}.0.0`,
		minor: `${major}.${minor + 1}.0`,
		patch: `${major}.${minor}.${patch + 1}`,
	}[arg];
}
if(!next) {
	console.error(`無法辨識的版本參數：${arg}`);
	process.exit(1);
}

// 指定與目前相同的版本（例如首次發佈）時，只建立 tag
if(next !== current) {
	writeFileSync(pkgPath, pkg.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`));
	writeFileSync(mainPath, readFileSync(mainPath, "utf8").replace(/^(\s*\*\s*Version:\s*).+$/m, `$1${next}`));
	run("git add package.json src/front-end-glossary.php");
	run(`git commit -m "release: v${next}"`);
}
run(`git tag v${next}`);
run("git push");
run(`git push origin v${next}`);
console.log(`\n已推送 v${next}，GitHub Actions 完成打包後，WordPress 後台即可看到更新。`);
