import { brotliCompressSync, gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const files = collectFiles(distDir)
  .filter((file) => !file.endsWith(".br") && !file.endsWith(".gz"))
  .filter((file) => !file.split(/[\\/]/).some((part) => part.startsWith(".")))
  .map((file) => {
    const bytes = readFileSync(file);
    return {
      file: relative(distDir, file).replaceAll("\\", "/"),
      raw: bytes.byteLength,
      gzip: gzipSync(bytes, { level: 9 }).byteLength,
      brotli: brotliCompressSync(bytes).byteLength,
    };
  })
  .sort((a, b) => b.raw - a.raw);

const totals = files.reduce((accumulator, file) => ({
  raw: accumulator.raw + file.raw,
  gzip: accumulator.gzip + file.gzip,
  brotli: accumulator.brotli + file.brotli,
}), { raw: 0, gzip: 0, brotli: 0 });

console.log("Dist bundle report");
console.log("");
console.log("| File | Raw | Gzip | Brotli |");
console.log("| --- | ---: | ---: | ---: |");

for (const file of files) {
  console.log(`| ${file.file} | ${formatBytes(file.raw)} | ${formatBytes(file.gzip)} | ${formatBytes(file.brotli)} |`);
}

console.log(`| Total | ${formatBytes(totals.raw)} | ${formatBytes(totals.gzip)} | ${formatBytes(totals.brotli)} |`);

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
