import {
  BaseFormatConverter,
  type AdapterPostableMessage,
  type CardChild,
  parseMarkdown,
  type Root,
  stringifyMarkdown,
} from "chat";

/**
 * Plain-text format converter for iMessage via Sendblue.
 *
 * iMessage is a plain-text platform — markdown bold/italic/links are not
 * rendered natively. Outbound messages strip all formatting. Inbound messages
 * are treated as plain text.
 */

export class SendblueFormatConverter extends BaseFormatConverter {
  fromAst(ast: Root): string {
    return toPlainText(stringifyMarkdown(ast));
  }

  toAst(platformText: string): Root {
    return parseMarkdown(platformText);
  }

  override renderPostable(message: AdapterPostableMessage): string {
    if (
      typeof message === "object" &&
      "text" in message &&
      typeof message.text === "string"
    ) {
      return toPlainText(message.text);
    }
    return toPlainText(super.renderPostable(message));
  }

  protected override cardChildToFallbackText(child: CardChild): string | null {
    if (child.type === "actions") {
      const choices = child.children.flatMap((action, index) =>
        "label" in action ? [`${index + 1}. ${action.label}`] : [],
      );
      return choices.join("\n") || null;
    }
    return super.cardChildToFallbackText(child);
  }
}

/**
 * Strip markdown-style formatting for Sendblue outbound messages.
 * Preserves newlines and URLs but removes bold, italic, code fences, etc.
 */
export function toPlainText(text: string): string {
  const urlPlaceholders: string[] = [];

  let result = text
    // Protect URLs from being mangled by markdown stripping
    .replace(/https?:\/\/[^\s)>\]]+/g, (url) => {
      urlPlaceholders.push(url);
      return `%%URLPH${urlPlaceholders.length - 1}%%`;
    })
    // code blocks → content only
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```(\w*\n?)?/g, "").trim())
    // inline code
    .replace(/`([^`]+)`/g, "$1")
    // bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    // bold
    .replace(/\*\*(.+?)\*\*/g, "$1")
    // italic
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, "$1")
    // strikethrough
    .replace(/~~(.+?)~~/g, "$1")
    // markdown links → "text (url)"
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    // headings
    .replace(/^#{1,6}\s+/gm, "")
    // horizontal rules
    .replace(/^[-*_]{3,}$/gm, "")
    // unordered list markers
    .replace(/^[\s]*[-*+]\s+/gm, "• ")
    .trim();

  // Restore protected URLs
  result = result.replace(
    /%%URLPH(\d+)%%/g,
    (_, idx) => urlPlaceholders[Number(idx)]!,
  );

  return result;
}
