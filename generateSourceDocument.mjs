import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const includePaths = [
  "package.json",
  "railway.json",
  "RAILWAY.md",
  "backend/.env.example",
  "backend/package.json",
  "backend/src",
  "frontend/.env.example",
  "frontend/index.html",
  "frontend/package.json",
  "frontend/vite.config.js",
  "frontend/public/env.js",
  "frontend/src",
  "public/js",
  "scripts/copyFrontendDist.mjs"
];

const allowedExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".md",
  ".html",
  ".css",
  ".example"
]);

const ignoredSegments = new Set([
  ".git",
  "node_modules",
  "dist",
  "client-dist"
]);

const outputRtfPath = path.join(rootDir, "SnapQueue-Complete-Source-Code.rtf");
const outputHtmlPath = path.join(rootDir, "SnapQueue-Complete-Source-Code.html");

function shouldIncludeFile(relativePath) {
  if (!relativePath) return false;
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.endsWith("package-lock.json")) return false;

  const segments = normalized.split("/");
  if (segments.some((segment) => ignoredSegments.has(segment))) return false;

  const extension = path.extname(normalized);
  if (extension === ".example") return true;
  return allowedExtensions.has(extension);
}

function collectFiles(targetPath) {
  const absolutePath = path.join(rootDir, targetPath);
  if (!fs.existsSync(absolutePath)) return [];

  const stats = fs.statSync(absolutePath);
  if (stats.isFile()) {
    return shouldIncludeFile(targetPath) ? [targetPath.replace(/\\/g, "/")] : [];
  }

  const output = [];
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    const childRelative = path.join(targetPath, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (ignoredSegments.has(entry.name)) continue;
      output.push(...collectFiles(childRelative));
      continue;
    }
    if (shouldIncludeFile(childRelative)) {
      output.push(childRelative);
    }
  }
  return output;
}

function uniqueSortedFiles(paths) {
  return Array.from(new Set(paths.flatMap((item) => collectFiles(item)))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function escapeRtf(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\t/g, "\\tab ")
    .replace(/\r?\n/g, "\\line\n");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toAnchorId(relativePath) {
  return `file-${String(relativePath)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function getCategoryLabel(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  if (normalized.startsWith("backend/src/modules/")) return "Backend Module";
  if (normalized.startsWith("backend/src/shared/models/")) return "Backend Model";
  if (normalized.startsWith("backend/src/shared/utils/")) return "Backend Utility";
  if (normalized.startsWith("backend/src/core/")) return "Backend Core";
  if (normalized.startsWith("backend/src/scripts/")) return "Backend Script";
  if (normalized.startsWith("backend/")) return "Backend Config";
  if (normalized.startsWith("frontend/src/features/admin/")) return "Frontend Admin";
  if (normalized.startsWith("frontend/src/features/user/")) return "Frontend User";
  if (normalized.startsWith("frontend/src/features/public/")) return "Frontend Public";
  if (normalized.startsWith("frontend/src/shared/")) return "Frontend Shared";
  if (normalized.startsWith("frontend/src/")) return "Frontend Source";
  if (normalized.startsWith("frontend/")) return "Frontend Config";
  if (normalized.startsWith("public/")) return "Public Asset Script";
  if (normalized.startsWith("scripts/")) return "Project Script";
  return "Project File";
}

function buildRtf(files) {
  const parts = [];
  parts.push("{\\rtf1\\ansi\\deff0");
  parts.push("{\\fonttbl{\\f0 Consolas;}{\\f1 Arial;}}");
  parts.push("\\viewkind4\\uc1");
  parts.push("\\pard\\sa200\\sl276\\slmult1\\f1\\b\\fs32 SnapQueue Complete Source Code\\par");
  parts.push("\\pard\\sa160\\sl240\\slmult1\\f1\\fs20");
  parts.push(`Generated from ${files.length} source files.\\par`);
  parts.push(`Project root: ${escapeRtf(rootDir)}\\par`);
  parts.push("\\par");

  for (const relativePath of files) {
    const absolutePath = path.join(rootDir, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    parts.push(`\\pard\\sa180\\sl240\\slmult1\\f1\\b\\fs24 File: ${escapeRtf(relativePath)}\\par`);
    parts.push("\\pard\\sa80\\sl220\\slmult1\\f0\\fs18");
    parts.push(`${escapeRtf(content)}\\par`);
    parts.push("\\par");
  }

  parts.push("}");
  return parts.join("\n");
}

function buildHtml(files) {
  const tocItems = files.map((relativePath, index) => {
    const anchorId = toAnchorId(relativePath);
    return `
      <li>
        <a href="#${anchorId}">
          <span class="toc-path">${escapeHtml(relativePath)}</span>
        </a>
      </li>
    `;
  });

  const sections = files.map((relativePath, index) => {
    const absolutePath = path.join(rootDir, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const anchorId = toAnchorId(relativePath);
    const categoryLabel = getCategoryLabel(relativePath);
    return `
      <section class="file-block" id="${anchorId}">
        <div class="file-header">
          <div class="file-badges">
            <span class="badge">${index + 1}</span>
            <span class="badge badge-muted">${escapeHtml(categoryLabel)}</span>
          </div>
          <h2>${escapeHtml(relativePath)}</h2>
          <p class="file-meta">Source file ${index + 1} of ${files.length}</p>
        </div>
        <pre><code>${escapeHtml(content)}</code></pre>
      </section>
    `;
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SnapQueue Complete Source Code</title>
  <style>
    :root {
      color-scheme: light;
    }
    body {
      margin: 0;
      padding: 32px;
      font-family: Arial, sans-serif;
      background: #f5f7fb;
      color: #111827;
      overflow-x: hidden;
    }
    .page-shell {
      max-width: 1200px;
      margin: 0 auto;
    }
    .hero {
      margin-bottom: 24px;
      padding: 24px 28px;
      border-radius: 18px;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: #f8fafc;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 32px;
    }
    p {
      margin: 0 0 12px;
      color: #374151;
    }
    .hero p {
      color: #cbd5e1;
    }
    .toc {
      margin: 0 0 28px;
      padding: 20px 24px;
      border: 1px solid #d1d5db;
      border-radius: 16px;
      background: #ffffff;
    }
    .toolbar {
      position: sticky;
      top: 16px;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 20px;
      padding: 16px 18px;
      border: 1px solid #d1d5db;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(10px);
    }
    .toolbar label {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
    }
    .toolbar input {
      flex: 1;
      min-width: 220px;
      padding: 12px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      font-size: 14px;
      color: #0f172a;
      background: #ffffff;
      outline: none;
    }
    .toolbar input:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.18);
    }
    .toolbar .result-count {
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      white-space: nowrap;
    }
    .toc h2 {
      margin: 0 0 12px;
      font-size: 22px;
      color: #0f172a;
    }
    .toc ol {
      margin: 0;
      padding-left: 22px;
      columns: 2;
      column-gap: 28px;
    }
    .toc li {
      margin: 0 0 8px;
      break-inside: avoid;
    }
    .toc a {
      color: #1d4ed8;
      text-decoration: none;
    }
    .toc a:hover {
      text-decoration: underline;
    }
    .toc-path {
      word-break: break-all;
    }
    .file-block {
      margin: 24px 0;
      padding: 20px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      background: #ffffff;
      page-break-inside: avoid;
      box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06);
    }
    .file-header {
      margin-bottom: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .file-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 700;
    }
    .badge-muted {
      background: #e2e8f0;
      color: #334155;
    }
    .file-block h2 {
      margin: 0 0 12px;
      font-size: 20px;
      color: #0f172a;
      word-break: break-all;
    }
    .file-meta {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .file-block.is-hidden {
      display: none;
    }
    .empty-state {
      display: none;
      margin: 24px 0;
      padding: 24px;
      border: 1px dashed #94a3b8;
      border-radius: 16px;
      background: #ffffff;
      color: #475569;
      text-align: center;
      font-size: 15px;
      font-weight: 600;
    }
    .empty-state.is-visible {
      display: block;
    }
    .back-to-top {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 30;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border: none;
      border-radius: 999px;
      background: #0f172a;
      color: #f8fafc;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.24);
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .back-to-top.is-visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    pre {
      margin: 0;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font: 13px/1.5 Consolas, "Courier New", monospace;
      background: #0f172a;
      color: #e5e7eb;
      padding: 16px;
      border-radius: 10px;
      -webkit-overflow-scrolling: touch;
    }
    @media (max-width: 900px) {
      body {
        padding: 20px;
      }
      .toc ol {
        columns: 1;
      }
    }
    @media (max-width: 640px) {
      body {
        padding: 12px;
      }
      .hero {
        margin-bottom: 16px;
        padding: 18px 16px;
        border-radius: 14px;
      }
      h1 {
        font-size: 24px;
        line-height: 1.2;
      }
      .hero p {
        font-size: 14px;
        line-height: 1.5;
      }
      .toolbar {
        top: 8px;
        align-items: stretch;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 16px;
        padding: 14px;
        border-radius: 14px;
      }
      .toolbar label {
        white-space: normal;
      }
      .toolbar input {
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
        font-size: 16px;
      }
      .toolbar .result-count {
        white-space: normal;
      }
      .toc {
        margin-bottom: 18px;
        padding: 16px 14px;
        border-radius: 14px;
      }
      .toc h2 {
        font-size: 18px;
      }
      .toc ol {
        padding-left: 18px;
      }
      .toc li {
        margin-bottom: 10px;
      }
      .file-block {
        margin: 16px 0;
        padding: 14px;
        border-radius: 14px;
      }
      .file-header {
        margin-bottom: 12px;
        padding-bottom: 12px;
      }
      .file-block h2 {
        font-size: 16px;
        line-height: 1.35;
        margin-bottom: 8px;
      }
      .file-meta {
        font-size: 12px;
      }
      .badge {
        min-width: 28px;
        padding: 5px 9px;
        font-size: 11px;
      }
      pre {
        padding: 12px;
        border-radius: 8px;
        font-size: 11px;
        line-height: 1.45;
      }
      .empty-state {
        margin: 18px 0;
        padding: 18px 14px;
        border-radius: 14px;
        font-size: 14px;
      }
      .back-to-top {
        right: 12px;
        bottom: 12px;
        padding: 11px 14px;
        font-size: 13px;
      }
    }
    @media (max-width: 420px) {
      body {
        padding: 10px;
      }
      .hero,
      .toolbar,
      .toc,
      .file-block,
      .empty-state {
        border-radius: 12px;
      }
      h1 {
        font-size: 22px;
      }
      .file-badges {
        gap: 6px;
      }
      pre {
        font-size: 10px;
      }
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .hero {
        background: #ffffff;
        color: #000000;
        box-shadow: none;
        border: 1px solid #d1d5db;
      }
      .hero p {
        color: #374151;
      }
      .toc {
        border: 1px solid #d1d5db;
        box-shadow: none;
      }
      .toolbar {
        position: static;
        box-shadow: none;
        backdrop-filter: none;
      }
      .toc ol {
        columns: 1;
      }
      .file-block {
        border: 1px solid #d1d5db;
        border-radius: 0;
        padding: 0 0 8px;
        box-shadow: none;
      }
      pre {
        background: #ffffff;
        color: #000000;
        border: 1px solid #d1d5db;
      }
      .back-to-top {
        display: none;
      }
    }
  </style>
</head>
<body id="top">
  <div class="page-shell">
    <section class="hero">
      <h1>SnapQueue Complete Source Code</h1>
      <p>Generated from ${files.length} source files.</p>
      <p>Project root: ${escapeHtml(rootDir)}</p>
    </section>
    <section class="toolbar">
      <label for="file-search">Search files</label>
      <input id="file-search" type="search" placeholder="Type a file path, folder, or keyword..." autocomplete="off" />
      <span class="result-count" id="result-count">${files.length} files</span>
    </section>
    <section class="toc">
      <h2>Table of Contents</h2>
      <ol>
        ${tocItems.join("\n")}
      </ol>
    </section>
    <section class="empty-state" id="empty-state">No source files match your search.</section>
    ${sections.join("\n")}
  </div>
  <button type="button" class="back-to-top" id="back-to-top" aria-label="Back to top">Back to Top</button>
  <script>
    (function () {
      const searchInput = document.getElementById("file-search");
      const resultCount = document.getElementById("result-count");
      const emptyState = document.getElementById("empty-state");
      const fileBlocks = Array.from(document.querySelectorAll(".file-block"));
      const tocLinks = Array.from(document.querySelectorAll(".toc a"));
      const backToTopButton = document.getElementById("back-to-top");
      const totalCount = fileBlocks.length;

      const normalize = (value) => String(value || "").toLowerCase().trim();

      function updateSearch() {
        const query = normalize(searchInput.value);
        let visibleCount = 0;

        fileBlocks.forEach((block) => {
          const title = normalize(block.querySelector("h2")?.textContent);
          const meta = normalize(block.querySelector(".badge-muted")?.textContent);
          const matches = !query || title.includes(query) || meta.includes(query);
          block.classList.toggle("is-hidden", !matches);
          if (matches) visibleCount += 1;
        });

        tocLinks.forEach((link) => {
          const target = document.querySelector(link.getAttribute("href"));
          const visible = target && !target.classList.contains("is-hidden");
          const item = link.closest("li");
          if (item) item.style.display = visible ? "" : "none";
        });

        resultCount.textContent = query
          ? visibleCount + (visibleCount === 1 ? " file match" : " file matches")
          : totalCount + (totalCount === 1 ? " file" : " files");

        emptyState.classList.toggle("is-visible", visibleCount === 0);
      }

      function updateBackToTop() {
        const show = window.scrollY > 500;
        backToTopButton.classList.toggle("is-visible", show);
      }

      searchInput.addEventListener("input", updateSearch);
      backToTopButton.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      window.addEventListener("scroll", updateBackToTop, { passive: true });

      updateSearch();
      updateBackToTop();
    })();
  </script>
</body>
</html>`;
}

const files = uniqueSortedFiles(includePaths);
const rtf = buildRtf(files);
const html = buildHtml(files);

fs.writeFileSync(outputRtfPath, rtf, "utf8");
fs.writeFileSync(outputHtmlPath, html, "utf8");

console.log(`Generated ${files.length} files into:`);
console.log(`- ${outputRtfPath}`);
console.log(`- ${outputHtmlPath}`);
