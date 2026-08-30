/**
 * RichText.jsx — Renders admin-authored plain text with its structure intact.
 *
 * Product descriptions are pasted from supplier monographs, Word docs and
 * competitor sites. A raw <p> collapses every newline, so a 6,000-character
 * paste becomes one unreadable wall of text. This parser turns the paste into
 * blocks without requiring the admin to learn any syntax:
 *
 *   • Blank lines and single newlines both separate paragraphs
 *   • Lines starting with •, -, * or · become bulleted lists
 *   • Lines starting with "1." / "2)" (tabs tolerated) become numbered lists
 *   • Short lines matching known section names ("Key Benefits", "Directions
 *     for Use", "Caution"…) become section headings
 *   • Other short, unpunctuated lines followed by content become bold lead-ins
 *     (the "Calcium Citrate" line above its explanation in a monograph)
 *   • **text** renders bold
 *
 * Pure parsing — no HTML passes through, so pasted markup can't inject.
 *
 * @module components/RichText
 */

const BULLET_RX = /^\s*[•·▪‣∙*-]\s+/;
const ORDERED_RX = /^\s*\d{1,3}[.)]\s*/;
const HEADING_RX = /^(key\s+ingredients?|ingredients?|key\s+benefits?|benefits?|uses?|how\s+to\s+use|directions?(\s+for\s+use)?|dosage|dos\s+and\s+don'?ts|caution|warnings?|safety(\s+information)?|storage|disclaimer|faqs?|frequently\s+asked\s+questions|why\b.{0,50}|what'?s\s+inside|about(\s+this\s+product)?)[?:]?$/i;

function isTermLine(line, next) {
  return (
    line.length <= 60 &&
    !/[.,;:]$/.test(line) &&
    typeof next === "string" &&
    next.trim().length > 0
  );
}

/** @returns {Array<{type:'h'|'term'|'p'|'ul'|'ol', text?:string, items?:string[]}>} */
export function parseRichText(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  const blocks = [];
  let list = null; // open {type:'ul'|'ol', items:[]}

  const closeList = () => { if (list) { blocks.push(list); list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { closeList(); continue; }

    if (BULLET_RX.test(line)) {
      const item = line.replace(BULLET_RX, "").trim();
      if (!list || list.type !== "ul") { closeList(); list = { type: "ul", items: [] }; }
      list.items.push(item);
      continue;
    }
    if (ORDERED_RX.test(line)) {
      const item = line.replace(ORDERED_RX, "").trim();
      if (!list || list.type !== "ol") { closeList(); list = { type: "ol", items: [] }; }
      list.items.push(item);
      continue;
    }

    closeList();
    const stripped = line.replace(/^#{1,3}\s+/, "");
    if (line !== stripped) {
      blocks.push({ type: "h", text: stripped });
    } else if (line.length <= 60 && HEADING_RX.test(line)) {
      blocks.push({ type: "h", text: line });
    } else if (isTermLine(line, lines[i + 1])) {
      blocks.push({ type: "term", text: line });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }
  closeList();
  return blocks;
}

/** Renders `**bold**` spans; everything else is plain text. */
function Inline({ text }) {
  const parts = String(text).split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-stone-800">{part}</strong> : part
  );
}

export default function RichText({ text, className = "" }) {
  const blocks = parseRichText(text);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.type === "h") {
          return (
            <h3 key={i} className="mt-6 first:mt-0 mb-2 text-[15px] font-semibold tracking-tight text-stone-900">
              <Inline text={b.text} />
            </h3>
          );
        }
        if (b.type === "term") {
          return (
            <p key={i} className="mt-3.5 first:mt-0 text-sm font-semibold text-stone-800">
              <Inline text={b.text} />
            </p>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className="mt-2 mb-1 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-600 marker:text-[#1e3a5f]">
              {b.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="mt-2 mb-1 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-stone-600 marker:font-medium marker:text-stone-400">
              {b.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
            </ol>
          );
        }
        return (
          <p key={i} className="mt-1.5 first:mt-0 text-sm leading-relaxed text-stone-600">
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
