const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const entries = ['index.html', '_headers', 'assets'];
const maxFileBytes = 25 * 1024 * 1024;
const maxFileCount = 20000;
const files = [];

function inspect(directory, relative) {
  const source = path.join(directory, relative);
  const stat = fs.lstatSync(source);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(source)) inspect(directory, path.join(relative, name));
  } else if (stat.isFile()) {
    if (stat.size > maxFileBytes) {
      throw new Error(`${relative}: ${(stat.size / 1024 / 1024).toFixed(2)} MiB exceeds the Cloudflare Pages 25 MiB file limit. Split embedded model textures into local files before deploying.`);
    }
    files.push({ relative, size: stat.size });
  } else {
    throw new Error(`Unsupported publish entry (must be a regular file or directory): ${relative}`);
  }
}

// 按依赖顺序生成内容指纹：模型/刚体模块 → 场景 → 应用 → HTML。
// 入口和模块内部必须引用同一个场景 URL，否则浏览器会初始化两套场景。
const readText = relative => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
function replaceRequired(source, pattern, replacement) {
  if (!source.match(pattern)) throw new Error(`Missing publish reference: ${pattern}`);
  return source.replace(pattern, () => replacement);
}
function fingerprint(relative, content) {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const ext = path.extname(relative);
  const versioned = relative.slice(0, -ext.length) + '.' + hash + ext;
  fs.writeFileSync(path.join(output, versioned), content);
  fs.unlinkSync(path.join(output, relative));
  return versioned;
}

try {
  for (const entry of entries) inspect(root, entry);
  if (files.length > maxFileCount) {
    throw new Error(`${files.length} files exceed the Cloudflare Pages Free plan limit of ${maxFileCount}.`);
  }

  // 仅重建项目根目录下的 dist；拒绝符号链接，避免清理到工作区以外。
  if (path.dirname(output) !== fs.realpathSync(root)) {
    throw new Error('Build output must remain inside the project root.');
  }
  if (fs.existsSync(output) && !fs.lstatSync(output).isDirectory()) {
    throw new Error('dist must be a regular directory, not a file or symbolic link.');
  }
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output);
  for (const entry of entries) {
    fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
  }

  const model = fingerprint('assets/models/gba.glb', fs.readFileSync(path.join(root, 'assets/models/gba.glb')));
  const rigid = fingerprint('assets/js/rigid-buttons.js', readText('assets/js/rigid-buttons.js'));
  let scene = replaceRequired(readText('assets/js/scene.js'), /'\.\/rigid-buttons\.js'/, `'./${path.basename(rigid)}'`);
  scene = replaceRequired(scene, /'\.\/assets\/models\/gba\.glb(?:\?[^']*)?'/, `'./${model}'`);
  const scenePath = fingerprint('assets/js/scene.js', scene);
  const app = replaceRequired(readText('assets/js/app.js'), /'\.\/scene\.js'/, `'./${path.basename(scenePath)}'`);
  const appPath = fingerprint('assets/js/app.js', app);
  let html = replaceRequired(readText('index.html'), /src="\.\/assets\/js\/scene\.js"/, `src="./${scenePath}"`);
  html = replaceRequired(html, /src="\.\/assets\/js\/app\.js"/, `src="./${appPath}"`);
  fs.writeFileSync(path.join(output, 'index.html'), html);

  files.length = 0;
  for (const entry of entries) inspect(output, entry);
  const largest = files.reduce((a, b) => a.size > b.size ? a : b);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  console.log(`Built dist: ${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB total.`);
  console.log(`Largest asset: ${largest.relative} (${(largest.size / 1024 / 1024).toFixed(2)} MiB / 25 MiB).`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
