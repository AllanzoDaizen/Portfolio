function cleanHeadingText(value) {
  return value
    .replace(/\s+#+\s*$/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export function slugifyPath(value) {
  return cleanHeadingText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function slugifyHeading(value, seen) {
  const base = slugifyPath(value);

  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);

  return count === 0 ? base : `${base}-${count}`;
}

export function getMarkdownToc(markdown, { minDepth = 2, maxDepth = 2 } = {}) {
  const seen = new Map();
  let inFrontmatter = false;
  let frontmatterChecked = false;

  return markdown.split("\n").flatMap((line) => {
    if (!frontmatterChecked && line.trim() === "---") {
      inFrontmatter = true;
      frontmatterChecked = true;
      return [];
    }

    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      return [];
    }

    const match = line.match(/^(#{2,6})\s+(.+)$/);
    if (!match) return [];

    const depth = match[1].length;
    if (depth < minDepth || depth > maxDepth) return [];

    const title = cleanHeadingText(match[2]);
    return [{ depth, title, slug: slugifyHeading(title, seen) }];
  });
}
