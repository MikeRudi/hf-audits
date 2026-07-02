#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LEADS_CSV = path.join(ROOT, "data", "leads_to_audit.csv");
const AUDITS_DIR = path.join(ROOT, "audits");
const LIGHTHOUSE_DIR = path.join(ROOT, "lighthouse-results");
const DATE = "June 23, 2026";

fs.mkdirSync(AUDITS_DIR, { recursive: true });
fs.mkdirSync(LIGHTHOUSE_DIR, { recursive: true });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"' && inQuotes && n === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && n === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim())) rows.push(row);
  }

  const [headers, ...data] = rows;
  return data.map((r) => Object.fromEntries(headers.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractPage(html) {
  const title = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const metaDescription =
    (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || [])[1] ||
    (html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i) || [])[1] ||
    "";

  const headings = [];
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = stripHtml(m[2]);
    if (text) headings.push({ level: Number(m[1]), text });
  }

  const links = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripHtml(m[2]);
    const href = m[1];
    if (text || href) links.push({ text, href });
  }

  const scripts = [];
  for (const m of html.matchAll(/<script\b[^>]*src=["']([^"']*)["']/gi)) scripts.push(m[1]);

  const images = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const alt = (tag.match(/\salt=["']([^"']*)["']/i) || [])[1] || "";
    const src = (tag.match(/\ssrc=["']([^"']*)["']/i) || tag.match(/\sdata-src=["']([^"']*)["']/i) || [])[1] || "";
    images.push({ src, alt });
  }

  const body = stripHtml((html.match(/<body[\s\S]*?<\/body>/i) || [html])[0]);
  return { title, metaDescription, headings, links, scripts, images, body };
}

async function fetchText(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 audit bot" },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, finalUrl: response.url, text };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, text: "", error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs || 150000);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function runLighthouse(lead, slug) {
  const outBase = path.join(LIGHTHOUSE_DIR, `${slug}-lighthouse`);
  const reportJson = `${outBase}.report.json`;
  const reportHtml = `${outBase}.report.html`;
  const exactJson = `${outBase}.json`;
  const exactHtml = `${outBase}.html`;

  if (fs.existsSync(exactJson)) {
    try {
      return { ok: true, data: JSON.parse(fs.readFileSync(exactJson, "utf8")), reused: true };
    } catch {
      // Fall through and rerun.
    }
  }

  const args = [
    "lighthouse",
    lead.Website,
    "--quiet",
    "--output=json",
    "--output=html",
    `--output-path=${outBase}`,
    "--chrome-flags=--headless",
    "--max-wait-for-load=45000",
  ];
  const result = await run("npx", args, { timeoutMs: 150000 });

  if (fs.existsSync(reportJson)) fs.copyFileSync(reportJson, exactJson);
  if (fs.existsSync(reportHtml)) fs.copyFileSync(reportHtml, exactHtml);

  if (fs.existsSync(exactJson)) {
    return { ok: true, data: JSON.parse(fs.readFileSync(exactJson, "utf8")), stderr: result.stderr };
  }
  return { ok: false, stderr: result.stderr || result.stdout || `Lighthouse exited with ${result.code || result.signal}` };
}

function score(data, id) {
  const s = data?.categories?.[id]?.score;
  return typeof s === "number" ? Math.round(s * 100) : null;
}

function audit(data, id) {
  return data?.audits?.[id] || {};
}

function secondsFromDisplay(value) {
  if (!value) return null;
  const s = String(value).replace(/\u00a0/g, " ");
  const n = Number((s.match(/[\d.]+/) || [])[0]);
  if (!Number.isFinite(n)) return null;
  return s.includes("ms") ? n / 1000 : n;
}

function numberFromDisplay(value) {
  if (!value) return null;
  const n = Number(String(value || "").replace(/,/g, "").match(/[\d.]+/)?.[0]);
  return Number.isFinite(n) ? n : null;
}

function label(value, low, high, lowerIsBetter = true) {
  if (value == null) return "Needs review";
  if (lowerIsBetter) {
    if (value <= low) return "Low";
    if (value <= high) return "Medium";
    return "High";
  }
  if (value >= high) return "High";
  if (value >= low) return "Medium";
  return "Low";
}

function speedLabel(value, fast, medium) {
  if (value == null) return "Needs review";
  if (value <= fast) return "Fast";
  if (value <= medium) return "Medium";
  return "Slow";
}

function messagingModel(page) {
  const text = page.body.toLowerCase();
  const productSignals = ["app", "platform", "software", "solution", "technology", "dashboard", "ai"];
  const problemSignals = ["problem", "pain", "risk", "challenge", "reduce", "avoid", "save"];
  const serviceSignals = ["services", "solutions", "partners", "drivers", "customers", "industries"];
  const p = productSignals.filter((w) => text.includes(w)).length;
  const pr = problemSignals.filter((w) => text.includes(w)).length;
  const s = serviceSignals.filter((w) => text.includes(w)).length;
  if (s >= 3 || p >= 3) return "Platform-Led";
  if (pr >= 3) return "Problem-Led";
  return "Product-Led";
}

function issueLine(id, text) {
  return `[${id}] ${text}`;
}

function cleanList(items) {
  return unique(items).slice(0, 9);
}

function auditFailed(data, id) {
  const score = data?.audits?.[id]?.score;
  return typeof score === "number" && score < 1;
}

function auditItems(data, id) {
  return data?.audits?.[id]?.details?.items || [];
}

function hasResource(data, resourceType) {
  const items = auditItems(data, "resource-summary");
  return items.some((item) => item.resourceType === resourceType && item.requestCount > 0);
}

function hasVideoEvidence(data, rawHtml) {
  const requests = auditItems(data, "network-requests");
  return (
    /<video\b/i.test(rawHtml || "") ||
    hasResource(data, "media") ||
    requests.some((item) => /video|\.mp4|\.webm|mpegts|m3u8|youtube|vimeo/i.test(item.url || ""))
  );
}

function hasLikelyCta(page) {
  return page.links.some((link) => /contact|book|demo|get started|download|start|schedule|apply|pricing|buy|try/i.test(`${link.text} ${link.href}`));
}

function buildAudit(lead, slug, page, lighthouse) {
  const data = lighthouse.data;
  const perf = score(data, "performance");
  const acc = score(data, "accessibility");
  const bp = score(data, "best-practices");
  const seo = score(data, "seo");

  const lcp = secondsFromDisplay(audit(data, "largest-contentful-paint").displayValue);
  const tbt = numberFromDisplay(audit(data, "total-blocking-time").displayValue);
  const fcp = secondsFromDisplay(audit(data, "first-contentful-paint").displayValue);
  const cls = numberFromDisplay(audit(data, "cumulative-layout-shift").displayValue);

  const totalHeavy = auditFailed(data, "total-byte-weight");
  const unusedCode = auditFailed(data, "unused-javascript");
  const unusedCss = auditFailed(data, "unused-css-rules");
  const renderBlocking = auditFailed(data, "render-blocking-resources") || auditItems(data, "render-blocking-insight").length > 0;
  const thirdPartyItems = auditItems(data, "third-party-summary");
  const imageDelivery = auditItems(data, "image-delivery-insight").length > 0 || auditFailed(data, "uses-responsive-images") || auditFailed(data, "uses-optimized-images");
  const offscreenImages = auditItems(data, "offscreen-images").length > 0;
  const unsizedImages = auditFailed(data, "unsized-images");
  const consoleErrors = audit(data, "errors-in-console").score === 0;
  const colorContrast = audit(data, "color-contrast").score === 0;
  const headingOrder = audit(data, "heading-order").score === 0;
  const imageAlt = audit(data, "image-alt").score === 0;
  const linkName = audit(data, "link-name").score === 0 || audit(data, "button-name").score === 0 || audit(data, "link-text").score === 0;
  const formLabel = audit(data, "label").score === 0 || audit(data, "select-name").score === 0;
  const videoCaptions = audit(data, "video-caption").score === 0;
  const docTitleFail = audit(data, "document-title").score === 0;
  const metaDescriptionFail = audit(data, "meta-description").score === 0;
  const crawlFail = audit(data, "is-crawlable").score === 0 || audit(data, "crawlable-anchors").score === 0;
  const hasVideo = hasVideoEvidence(data, page.rawHtml || "");

  const h1Count = page.headings.filter((h) => h.level === 1).length;
  const headingCount = page.headings.length;
  const linkCount = page.links.length;
  const scriptCount = page.scripts.length;
  const imageCount = page.images.length;
  const hasCta = hasLikelyCta(page);
  const hasForms = /<form\b|newsletter|subscribe|contact us|get started/i.test(page.rawHtml || page.body);

  const perfIssues = [];
  if (perf != null && perf < 70) perfIssues.push(issueLine(1, "Performance score is below the recommended target."));
  if (lcp != null && lcp > 4) perfIssues.push(issueLine(2, "The main visible content takes too long to load."));
  if (fcp != null && fcp > 3) perfIssues.push(issueLine(3, "The first part of the page takes too long to appear."));
  if (tbt != null && tbt > 300) perfIssues.push(issueLine(4, "Too much code is blocking the page before it feels usable."));
  if (cls != null && cls > 0.1) perfIssues.push(issueLine(5, "The page shifts or jumps while loading."));
  if (totalHeavy || scriptCount > 25 || imageCount > 25) perfIssues.push(issueLine(6, "The page is loading too much before the first view is usable."));
  if (renderBlocking) perfIssues.push(issueLine(7, "Code or styling is delaying the first view of the page."));
  if (totalHeavy) perfIssues.push(issueLine(8, "The total page weight is too high."));
  if (perf != null && perf < 80) perfIssues.push(issueLine(9, "The page feels slower than it should for the amount of content shown."));

  const uxIssues = [];
  if (docTitleFail || metaDescriptionFail) uxIssues.push(issueLine(2, "The page title or description does not explain the site clearly enough."));
  if (headingOrder || (headingCount > 0 && h1Count !== 1)) uxIssues.push(issueLine(3, "The heading structure makes the page harder to scan."));
  if (linkName) uxIssues.push(issueLine(9, "Some links or buttons are not clearly labelled."));
  if (headingCount > 25 || linkCount > 70) uxIssues.push(issueLine(13, "The page structure should be simplified so it is easier to scan."));
  if (!hasCta && linkCount > 0) uxIssues.push(issueLine(15, "Important next-step links are not easy to identify from the public page."));

  const interactionIssues = [];
  if (hasVideo && (lcp == null || lcp > 4 || totalHeavy)) interactionIssues.push(issueLine(5, "Heavy above-the-fold media is loading before the main content is fully usable."));
  if (auditFailed(data, "non-composited-animations")) interactionIssues.push(issueLine(6, "Some animations may be less smooth because of how they render."));
  if ((hasVideo || imageDelivery) && perf != null && perf < 80) interactionIssues.push(issueLine(7, "Visual media is costing too much performance."));
  if (scriptCount > 35 || thirdPartyItems.length > 4) interactionIssues.push(issueLine(6, "Interactions may feel slower because too much code is loading."));

  const codeIssues = [];
  if (unusedCode || scriptCount > 25) codeIssues.push(issueLine(1, "Heavy code is slowing the page down."));
  if (scriptCount > 20 || renderBlocking) codeIssues.push(issueLine(2, "Too much code is running before page load."));
  if (unusedCode) codeIssues.push(issueLine(3, "Unused scripts are being loaded."));
  if (thirdPartyItems.length > 2) codeIssues.push(issueLine(7, "Third-party scripts are impacting load performance."));
  if (consoleErrors) codeIssues.push(issueLine(8, "Console errors are visible."));
  if (renderBlocking) codeIssues.push(issueLine(11, "Code or styling is blocking the first view of the page."));
  if (thirdPartyItems.length > 4) codeIssues.push(issueLine(14, "Third-party tools may not all be needed."));

  const mediaIssues = [];
  if (imageDelivery || imageCount > 18) mediaIssues.push(issueLine(1, "Large images are increasing page weight."));
  if (hasVideo) mediaIssues.push(issueLine(2, "Large videos are increasing page weight."));
  if (imageDelivery || unsizedImages) mediaIssues.push(issueLine(11, "Images are larger than they need to be."));
  if (imageDelivery) mediaIssues.push(issueLine(12, "Media is not compressed enough."));
  if (offscreenImages) mediaIssues.push(issueLine(9, "Below-the-fold media is loading too early."));
  if (hasVideo) mediaIssues.push(issueLine(10, "Background media is delaying the first view."));
  if (imageCount > 25) mediaIssues.push(issueLine(13, "Too many visual assets are loading on the homepage."));
  if ((hasVideo || imageDelivery) && lcp != null && lcp > 4) mediaIssues.push(issueLine(14, "The page relies on heavy above-the-fold media."));

  const seoIssues = [];
  if (docTitleFail || (!docTitleFail && page.title && page.title.length < 15)) seoIssues.push(issueLine(1, "Meta titles are weak or too generic."));
  if (metaDescriptionFail) seoIssues.push(issueLine(2, "Meta descriptions are missing or too thin."));
  if (headingOrder || (headingCount > 0 && h1Count !== 1)) seoIssues.push(issueLine(3, "Heading structure is unclear."));
  if (headingCount > 0 && h1Count > 1) seoIssues.push(issueLine(4, "The page has multiple main headings."));
  if (headingCount > 0 && h1Count === 0) seoIssues.push(issueLine(5, "The page is missing a clear main heading."));
  if (headingOrder) seoIssues.push(issueLine(6, "Supporting headings are not structured properly."));
  if (crawlFail || audit(data, "link-text").score === 0) seoIssues.push(issueLine(8, "Some important links may not be clear enough for search engines."));
  if (linkCount > 0 && linkCount < 5) seoIssues.push(issueLine(9, "Internal linking is weak."));
  if (seoIssues.length === 0 && seo != null && seo < 90) seoIssues.push(issueLine(18, "Search engines may not be seeing the most important content clearly."));

  const standardIssues = [];
  if (linkName) standardIssues.push(issueLine(5, "Some buttons or image links do not have clear labels."));
  if (formLabel || (hasForms && acc != null && acc < 95)) standardIssues.push(issueLine(6, "Some form labels or accessibility details need review."));
  if (imageAlt) standardIssues.push(issueLine(7, "Meaningful images are missing alt text."));
  if (colorContrast) standardIssues.push(issueLine(8, "Colour contrast is too low in some areas."));
  if (headingCount > 25 || uxIssues.some((x) => x.includes("[13]"))) standardIssues.push(issueLine(9, "Page structure is harder to scan than it should be."));
  if (!hasCta && linkCount > 0) standardIssues.push(issueLine(10, "CTAs are unclear."));
  if (linkCount > 70) standardIssues.push(issueLine(13, "Navigation and link structure should be simplified."));
  if (consoleErrors) standardIssues.push(issueLine(3, "Console errors are visible."));
  if (colorContrast || headingOrder || imageAlt || linkName || videoCaptions) standardIssues.push(issueLine(18, "Accessibility basics need improvement."));

  const model = messagingModel(page);
  const modelNote =
    model === "Platform-Led"
      ? `Based on the public page text and navigation, ${lead.Company} appears to include multiple audiences, services, features, or use cases. The website should group those pieces into a clearer complete solution with direct next steps.`
      : model === "Problem-Led"
        ? `Based on the public page text, ${lead.Company} should lead with the problem it solves, then quickly connect that problem to the service and next action.`
        : `Based on the public page text, ${lead.Company} should make the product clear quickly: what it does, who it is for, and what the visitor should do next.`;

  const speedNote = lighthouse.ok
    ? `The speed test shows the homepage is ${perf != null && perf >= 80 ? "in a healthy range" : perf != null && perf >= 60 ? "usable but still heavier than it should be" : "heavy and needs optimisation"}. ${[
        hasVideo ? "Large video or media is one of the main things slowing the first view." : totalHeavy || imageDelivery ? "Heavy page assets are one of the main things slowing the first view." : "",
        unusedCode ? "A high amount of unused code is loading." : "",
        renderBlocking ? "Some styling or code is delaying the first view." : "",
      ].filter(Boolean).join(" ")}`
    : "Speed test could not be completed. Scores need to be added manually.";

  const summaryBits = cleanList([
    perfIssues.length ? "Improve speed and reduce what loads before the first view" : "",
    uxIssues.length ? "Make the message, hierarchy, and CTA path easier to scan" : "",
    codeIssues.length ? "Clean up code and third-party scripts that are not needed right away" : "",
    mediaIssues.length ? (hasVideo ? "Optimise images, video, and other visual assets" : "Optimise images and other visual assets") : "",
    seoIssues.length ? "Improve search structure, page titles, and heading quality" : "",
    standardIssues.length ? "Clean up accessibility and public-facing quality details" : "",
  ]);

  const fallbackIssue = ["No major issue was found in this section from the external checks."];

  function section(title, issues, affects, fixes) {
    const hasIssues = issues.length > 0;
    const issueList = hasIssues ? issues : fallbackIssue;
    return [
      `## ${title}`,
      "",
      "### Main Issues",
      "",
      issueList.join("\n"),
      "",
      "### The Affects",
      "",
      hasIssues ? cleanList(affects).join("\n") : "No specific effect selected from the external checks.",
      "",
      "### The Fixes",
      "",
      hasIssues ? cleanList(fixes).join("\n") : "No specific fix selected from the external checks.",
    ].join("\n");
  }

  const text = [
    `# ${lead.Company} Website Audit`,
    "",
    `Website: ${lead.Website}`,
    `Company: ${lead.Company}`,
    `Contact: ${lead.Name}`,
    `Email: ${lead.Email}`,
    `Audit Date: ${DATE}`,
    "Audited By: Codex",
    "",
    "---",
    "",
    "## Audit Summary",
    "",
    `${lead.Company}'s website was reviewed from a public-facing perspective.`,
    "",
    summaryBits.length
      ? `Main opportunities:\n\n${summaryBits.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "The external review did not find major public-facing issues, but the site should still be reviewed regularly as content and scripts change.",
    "",
    "---",
    "",
    "## Messaging Direction",
    "",
    `Recommended messaging model: ${model}`,
    "",
    "Messaging Notes:",
    "",
    modelNote,
    "",
    "---",
    "",
    "## Performance",
    "",
    "### Speed Test Scores",
    "",
    lighthouse.ok
      ? [`Performance: ${perf ?? "Needs review"}`, `Accessibility: ${acc ?? "Needs review"}`, `Best Practices: ${bp ?? "Needs review"}`, `SEO: ${seo ?? "Needs review"}`].join("\n")
      : "Speed test could not be completed. Scores need to be added manually.",
    "",
    "### Main Performance Issues",
    "",
    (perfIssues.length ? perfIssues : fallbackIssue).join("\n"),
    "",
    "### The Affects",
    "",
    cleanList(["Load speed", "Mobile experience", "First impression", "Bounce rate", "Conversion", "Speed test score", "Page usability", "Perceived site quality"]).join("\n"),
    "",
    "### The Fixes",
    "",
    cleanList(["Prioritise the main above-the-fold content.", "Optimise the main loading media.", "Reduce code and styling that blocks the first view.", "Delay non-essential scripts until after the page is usable.", "Compress and convert large media assets.", "Improve loading order so the main content renders first."]).join("\n"),
    "",
    "---",
    "",
    section(
      "Style & Site Experience",
      uxIssues,
      ["Clarity", "First impression", "User flow", "Conversion", "Perceived quality", "Professional finish", "Readability", "Visitor attention", "CTA engagement"],
      ["Improve visual hierarchy.", "Strengthen the main CTA path.", "Improve spacing and page rhythm.", "Make the site feel more focused and easier to scan.", "Make navigation and footer links clearer."]
    ),
    "",
    "---",
    "",
    section(
      "Animation & Interactions",
      interactionIssues,
      ["Page speed", "Mobile experience", "Speed performance", "User attention", "Conversion flow", "Interaction quality"],
      ["Move non-essential animation code behind page load.", "Prioritise content loading before decorative animation.", "Reduce movement that distracts from the main message.", "Make sure interactions support the user journey.", "Review visual effects for performance cost."]
    ),
    "",
    "---",
    "",
    section(
      "Code & Third-Party Scripts",
      codeIssues,
      ["Load speed", "Speed test score", "User interaction delay", "Tracking reliability", "First view", "Mobile performance"],
      ["Audit all code loaded on the page.", "Remove unused scripts and duplicate libraries.", "Defer non-critical code.", "Move non-essential scripts behind page load.", "Load third-party scripts after the main content has rendered.", "Reduce the number of scripts needed for the first view."]
    ),
    "",
    "---",
    "",
    section(
      "Asset & Media Performance",
      mediaIssues,
      ["Total page size", "Main content loading speed", "Mobile performance", "First impression", "Bandwidth usage", "Speed performance", "First view rendering"],
      ["Compress large media assets.", "Prioritise the main image or visual.", "Resize images to match their display size.", "Rework heavy above-the-fold media if it delays page render.", "Lazy-load below-the-fold media.", "Make sure critical visuals load before non-critical media."]
    ),
    "",
    "---",
    "",
    section(
      "SEO & Crawlability",
      seoIssues,
      ["Google discovery", "Indexing", "Search snippets", "Crawl efficiency", "Content quality signals", "Organic performance", "Page relevance", "Site structure"],
      ["Clean up page titles and meta descriptions.", "Use one clear main heading per page.", "Structure supporting headings properly.", "Improve internal linking to key pages.", "Strengthen page focus around the most valuable search intent.", "Make sure product or service content is visible to search engines."]
    ),
    "",
    "---",
    "",
    section(
      "Website Standards",
      standardIssues,
      ["Accessibility", "Usability", "Professional finish", "Conversion", "Navigation clarity", "Public-facing quality", "Visitor confidence"],
      ["Add clear labels to image-based buttons and links.", "Check colour contrast on key text and buttons.", "Make buttons and links clearer.", "Improve navigation and footer structure.", "Improve accessibility basics.", "Make the site feel more complete and professionally finished."]
    ),
    "",
  ].join("\n");

  return text.replace(/\n{3,}/g, "\n\n");
}

async function auditLead(lead, index, total) {
  const slug = slugify(lead.Company || lead.Website);
  console.log(`[${index}/${total}] ${lead.Company} - ${lead.Website}`);

  const pageResult = await fetchText(lead.Website);
  const page = extractPage(pageResult.text || "");
  page.rawHtml = pageResult.text || "";

  const lighthouse = await runLighthouse(lead, slug);
  const auditText = buildAudit(lead, slug, page, lighthouse);
  const txtPath = path.join(AUDITS_DIR, `${slug}-audit.txt`);
  fs.writeFileSync(txtPath, auditText, "utf8");
  console.log(`  wrote ${path.relative(ROOT, txtPath)}${lighthouse.ok ? "" : " (Lighthouse failed)"}`);
}

async function main() {
  const leads = parseCsv(fs.readFileSync(LEADS_CSV, "utf8"));
  for (let i = 0; i < leads.length; i++) {
    await auditLead(leads[i], i + 1, leads.length);
  }
  console.log(`Done. ${leads.length} audit txt files are ready in ${path.relative(process.cwd(), AUDITS_DIR)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
