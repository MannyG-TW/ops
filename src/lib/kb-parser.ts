import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export interface KbSection {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  subsections: { title: string; content: string }[];
}

export interface KbModel {
  model: string;
  productName: string;
  sections: KbSection[];
  images: string[];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function collectKeywords(text: string): string[] {
  const keywords: string[] = [];
  const lines = text.split("\n");
  let inVariations = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{2,3}\s*(Search (?:variations|keywords)|Alternate (?:terms|customer)|Synonyms|Intent matches)/i.test(trimmed)) {
      inVariations = true;
      continue;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      inVariations = false;
      continue;
    }
    if (inVariations) {
      const kw = trimmed.replace(/^[-*]\s*/, "").trim();
      if (kw) keywords.push(kw.toLowerCase());
    }
  }
  return keywords;
}

export function parseKbMarkdown(markdown: string): { productName: string; sections: KbSection[] } {
  const blocks = markdown.split(/^(?=# )/m);
  let productName = "Device";
  const sections: KbSection[] = [];

  const EXCLUDE_TITLES = new Set([
    "purpose of this file", "source basis",
    "content limitations and notes for future kb builders",
    "recommended chunking strategy for ai knowledge bases",
    "ready-to-ingest support summary", "suggested metadata tags for indexing",
    "search synonym map by concept", "intent library for ai search and chatbot retrieval",
  ]);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const titleMatch = trimmed.match(/^# (.+)/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    if (EXCLUDE_TITLES.has(title.toLowerCase())) continue;

    // First # heading becomes productName (the document title)
    const bodyAfterTitle = trimmed.slice(trimmed.indexOf("\n") + 1);

    // Split body into ## subsections
    const subBlocks = bodyAfterTitle.split(/^(?=## )/m);
    const sectionContent: string[] = [];
    const subsections: { title: string; content: string }[] = [];

    for (const sub of subBlocks) {
      const subTrimmed = sub.trim();
      if (!subTrimmed) continue;

      const subMatch = subTrimmed.match(/^## (.+)/);
      if (!subMatch) {
        sectionContent.push(cleanContent(subTrimmed));
        continue;
      }

      const subTitle = subMatch[1].trim();
      if (/^search (?:variations|keywords)/i.test(subTitle)) continue;

      const subBody = subTrimmed.slice(subTrimmed.indexOf("\n") + 1);
      subsections.push({ title: subTitle, content: cleanContent(subBody) });
    }

    const fullText = bodyAfterTitle;
    const keywords = collectKeywords(fullText);

    // Add content from all ### within subsections too
    const allSubContent = subsections.map((s) => s.title + " " + s.content).join(" ");

    sections.push({
      id: slugify(title),
      title,
      content: sectionContent.join("\n").trim(),
      keywords,
      subsections,
    });
  }

  if (sections.length > 0 && /product identity|product name/i.test(sections[0].title)) {
    const nameSub = sections[0].subsections.find((s) => /product name/i.test(s.title));
    if (nameSub) {
      const match = nameSub.content.match(/\*\*(.+?)\*\*/);
      if (match) productName = match[1];
    }
  }

  return { productName, sections };
}

function cleanContent(text: string): string {
  const lines = text.split("\n");
  const cleaned: string[] = [];
  let skipVariations = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{2,3}\s*(Search (?:variations|keywords)|Alternate (?:terms|customer)|Synonyms|Intent matches)/i.test(trimmed)) {
      skipVariations = true;
      continue;
    }
    if (/^#{1,3}\s/.test(trimmed) && skipVariations) {
      skipVariations = false;
    }
    if (skipVariations) {
      if (!trimmed || /^[-*]\s/.test(trimmed)) continue;
      skipVariations = false;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n").trim();
}

export function resolveKbModel(terminalType: string): string | null {
  const kbRoot = join(process.cwd(), "kb");
  if (!existsSync(kbRoot)) return null;

  const upper = terminalType.toUpperCase();
  const folders = readdirSync(kbRoot).filter((f) => {
    try { return existsSync(join(kbRoot, f, "index.md")); } catch { return false; }
  });

  const exact = folders.find((f) => f.toUpperCase() === upper);
  if (exact) return exact;

  for (let len = upper.length - 1; len >= 2; len--) {
    const prefix = upper.slice(0, len);
    const match = folders.find((f) => f.toUpperCase() === prefix);
    if (match) return match;
  }

  return null;
}

export function loadKbForModel(model: string): KbModel | null {
  const resolved = resolveKbModel(model);
  const folderName = resolved || model;
  const kbDir = join(process.cwd(), "kb", folderName);
  if (!existsSync(kbDir)) return null;

  const indexPath = join(kbDir, "index.md");
  if (!existsSync(indexPath)) return null;

  const markdown = readFileSync(indexPath, "utf-8");
  const { productName, sections } = parseKbMarkdown(markdown);

  const images = readdirSync(kbDir)
    .filter((f) => /\.(webp|png|jpg|jpeg|svg)$/i.test(f))
    .map((f) => `/api/kb/${folderName}/image/${f}`);

  return { model: folderName, productName, sections, images };
}
