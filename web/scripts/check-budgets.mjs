import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const chunkRoot = join(root, ".next", "static", "chunks");
const dataRoot = join(root, "src", "data");
const chunkFiles = walk(chunkRoot).filter((path) => path.endsWith(".js"));
const gzipSizes = chunkFiles.map((path) => gzipSync(readFileSync(path)).length);
const largestChunk = Math.max(...gzipSizes);
const totalChunks = gzipSizes.reduce((sum, size) => sum + size, 0);
const dataBytes = walk(dataRoot).reduce((sum, path) => sum + statSync(path).size, 0);

const budgets = {
  largestChunk: 220_000,
  totalChunks: 900_000,
  bundledData: 400_000,
};

const results = { largestChunk, totalChunks, dataBytes };
console.log(JSON.stringify({ budgets, results }, null, 2));
if (largestChunk > budgets.largestChunk || totalChunks > budgets.totalChunks || dataBytes > budgets.bundledData) {
  process.exitCode = 1;
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
