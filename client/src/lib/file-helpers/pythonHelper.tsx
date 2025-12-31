import { renderHighlightedCode } from "./highlight";
import type { FileDescriptor, FileRenderContext, FileTypeHelper, FileValidationResult } from "./types";

class PythonHelper implements FileTypeHelper {
  validate(descriptor: FileDescriptor): FileValidationResult {
    if (!descriptor.content || !descriptor.content.trim()) {
      return { isValid: false, errors: ["Python file is empty."] };
    }
    return { isValid: true };
  }

  render(descriptor: FileDescriptor, ctx?: FileRenderContext) {
    return renderHighlightedCode(descriptor.content ?? "", "python", ctx);
  }
}

export const pythonHelper = new PythonHelper();
