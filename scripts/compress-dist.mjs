import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const compressibleExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".txt",
  ".wasm",
]);

const files = collectFiles(distDir)
  .filter((file) => compressibleExtensions.has(extname(file)))
  .filter((file) => !file.endsWith(".br") && !file.endsWith(".gz"));

let rawBytes = 0;
let gzipBytes = 0;
let brotliBytes = 0;

for (const file of files) {
  const input = readFileSync(file);
  const gzip = gzipSync(input, { level: 9 });
  const brotli = brotliCompressSync(input, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
    },
  });

  writeFileSync(`${file}.gz`, gzip);
  writeFileSync(`${file}.br`, brotli);

  rawBytes += input.byteLength;
  gzipBytes += gzip.byteLength;
  brotliBytes += brotli.byteLength;
}

console.log(`Compressed ${files.length} dist files.`);
console.log(`raw ${formatBytes(rawBytes)} | gzip ${formatBytes(gzipBytes)} | brotli ${formatBytes(brotliBytes)}`);

function collectFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : fullPath;
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} kB`;
}
