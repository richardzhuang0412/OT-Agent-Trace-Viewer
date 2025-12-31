import type { Language } from "prism-react-renderer";
import { parse, stringify } from "smol-toml";
import type { FileDescriptor, FileRenderContext, FileTypeHelper, FileValidationResult } from "./types";
import { renderHighlightedCode } from "./highlight";

const TOML_LANGUAGE: Language = "toml";

class TomlHelper implements FileTypeHelper {
  validate(descriptor: FileDescriptor): FileValidationResult {
    const content = descriptor.content ?? "";
    if (!content.trim()) {
      return {
        isValid: false,
        errors: ["File is empty or missing TOML content."],
      };
    }

    try {
      const ast = parse(content);
      const formatted = stringify(ast);
      return {
        isValid: true,
        details: { formatted },
      };
    } catch (error: any) {
      const message = error?.message || "Unknown TOML parse error.";
      const locationParts = ["line", "col"]
        .map((key) => (error?.[key] ? `${key}: ${error[key]}` : null))
        .filter(Boolean)
        .join(" ");

      return {
        isValid: false,
        errors: [
          locationParts ? `${message} (${locationParts})` : message,
        ],
      };
    }
  }

  render(descriptor: FileDescriptor, ctx?: FileRenderContext) {
    const content = getFormattedToml(descriptor.content);
    return renderHighlightedCode(content, TOML_LANGUAGE, ctx);
  }
}

function getFormattedToml(content?: string) {
  if (!content) return "";
  try {
    const ast = parse(content);
    return stringify(ast);
  } catch {
    return content;
  }
}

export const tomlHelper = new TomlHelper();
