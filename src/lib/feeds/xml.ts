// Minimal regex-based RSS 2.0 / Atom item extractor.
// Avoids pulling in a full XML parser dependency for the simple, consistent
// feed shapes produced by WordPress / Atom that this app consumes.

export interface RawItem {
  title: string;
  link: string;
  date: string; // raw date string from the feed
  description: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

export function parseRss(xml: string): RawItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items.map((block) => ({
    title: stripHtml(tag(block, "title")),
    link: stripHtml(tag(block, "link")),
    date: tag(block, "pubDate"),
    description: stripHtml(tag(block, "description") || tag(block, "content:encoded")),
  }));
}

export function parseAtom(xml: string): RawItem[] {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  return entries.map((block) => {
    const linkMatch =
      block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) ??
      block.match(/<link[^>]*href="([^"]+)"/i);
    return {
      title: stripHtml(tag(block, "title")),
      link: linkMatch ? decodeEntities(linkMatch[1]) : "",
      date: tag(block, "published") || tag(block, "issued") || tag(block, "updated"),
      description: stripHtml(tag(block, "summary") || tag(block, "content")),
    };
  });
}
