import { renderHighlightedCode } from "./highlight";
import type { FileDescriptor, FileRenderContext, FileTypeHelper, FileValidationResult } from "./types";

class JsonHelper implements FileTypeHelper {
  validate(descriptor: FileDescriptor): FileValidationResult {
    const content = descriptor.content ?? "";
    if (!content.trim()) {
      return { isValid: false, errors: ["JSON file is empty."] };
    }

    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      return { isValid: true, details: { formatted } };
    } catch (error: any) {
      return {
        isValid: false,
        errors: [error?.message || "Invalid JSON"],
      };
    }
  }

  render(descriptor: FileDescriptor, ctx?: FileRenderContext) {
    const content = formatJson(descriptor.content);
    return renderHighlightedCode(content, "json", ctx);
  }
}

function formatJson(content?: string) {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

export const jsonHelper = new JsonHelper();
