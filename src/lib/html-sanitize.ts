const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "a",
  "ul", "ol", "li", "h2", "h3", "blockquote", "hr",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
};

const SKIP_TAGS = new Set(["script", "iframe", "style", "object", "embed", "link", "meta", "form", "input", "button", "svg", "math"]);

function isDangerousUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return true;
  if (trimmed.startsWith("data:")) return true;
  if (trimmed.startsWith("vbscript:")) return true;
  return false;
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return cleanNode(doc.body).innerHTML;
}

function cleanNode(node: Node): Node {
  if (node.nodeType === Node.TEXT_NODE) return node;

  if (node.nodeType !== Node.ELEMENT_NODE) {
    node.parentNode?.removeChild(node);
    return node;
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (SKIP_TAGS.has(tag)) {
    el.remove();
    return el;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
    return el;
  }

  const allowedAttrs = ALLOWED_ATTRS[tag];
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    if (!allowedAttrs || !allowedAttrs.has(attr.name.toLowerCase())) {
      el.removeAttribute(attr.name);
    } else if (attr.name.toLowerCase() === "href" && isDangerousUrl(attr.value)) {
      el.removeAttribute("href");
    }
  }

  if (tag === "a") {
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  }

  const children = Array.from(el.childNodes);
  for (const child of children) {
    cleanNode(child);
  }

  return el;
}

export function plainTextToHtml(text: string): string {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function isHtmlContent(text: string): boolean {
  if (!text) return false;
  return /<(p|div|h2|h3|ul|ol|blockquote|strong|em|u|a|br|hr)\b/i.test(text);
}

export function stripHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * Convert a stored text[] content array into a single HTML string for the
 * RichTextEditor. Each array element is one paragraph. Elements that already
 * contain HTML tags are passed through; plain-text elements are wrapped in <p>.
 */
export function contentArrayToEditorHtml(content: string[]): string {
  if (!content || content.length === 0) return "";
  return content
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      if (isHtmlContent(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .filter(Boolean)
    .join("");
}

/**
 * Convert the RichTextEditor's HTML output back into a text[] array where each
 * top-level block element becomes one array element — matching the original
 * paragraph-array format the database expects.
 */
export function editorHtmlToContentArray(html: string): string[] {
  if (!html || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const result: string[] = [];

  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text) {
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        result.push(`<p>${escaped}</p>`);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const outer = (node as Element).outerHTML;
      if (outer.trim()) result.push(outer);
    }
  }
  return result;
}
