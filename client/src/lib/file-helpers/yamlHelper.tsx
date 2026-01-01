import { load, dump } from "js-yaml";
import { renderHighlightedCode } from "./highlight";
import type { FileDescriptor, FileRenderContext, FileTypeHelper, FileValidationResult } from "./types";

class YamlHelper implements FileTypeHelper {
  validate(descriptor: FileDescriptor): FileValidationResult {
    const content = descriptor.content ?? "";
    if (!content.trim()) {
      return { isValid: false, errors: ["YAML file is empty."] };
    }

    try {
      const parsed = load(content);
      const formatted = dump(parsed, { lineWidth: 120 });
      return { isValid: true, details: { formatted } };
    } catch (error: any) {
      const message = error?.message || "Unable to parse YAML.";
      return { isValid: false, errors: [message] };
    }
  }

  render(descriptor: FileDescriptor, ctx?: FileRenderContext) {
    const content = formatYaml(descriptor.content);
    return renderHighlightedCode(content, "yaml", ctx);
  }
}

function formatYaml(content?: string) {
  if (!content) return "";
  try {
    const parsed = load(content);
    return dump(parsed, { lineWidth: 120 });
  } catch {
    return content;
  }
}

export const yamlHelper = new YamlHelper();
