const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const entries = ['index.html', '_headers', 'assets'];
const maxFileBytes = 25 * 1024 * 1024;
const maxFileCount = 20000;
const files = [];

function inspect(relative) {
  const source = path.join(root, relative);
  const stat = fs.lstatSync(source);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(source)) inspect(path.join(relative, name));
  } else if (stat.isFile()) {
    if (stat.size > maxFileBytes) {
      throw new Error(`${relative}: ${(stat.size / 1024 / 1024).toFixed(2)} MiB exceeds the Cloudflare Pages 25 MiB file limit. Split embedded model textures into local files before deploying.`);
    }
    files.push({ relative, size: stat.size });
  } else {
    throw new Error(`Unsupported publish entry (must be a regular file or directory): ${relative}`);
  }
}

try {
  for (const entry of entries) inspect(entry);
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

  const largest = files.reduce((a, b) => a.size > b.size ? a : b);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  console.log(`Built dist: ${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB total.`);
  console.log(`Largest asset: ${largest.relative} (${(largest.size / 1024 / 1024).toFixed(2)} MiB / 25 MiB).`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
