import { renderHighlightedCode } from "./highlight";
import type { FileDescriptor, FileRenderContext, FileTypeHelper, FileValidationResult } from "./types";

class CppHelper implements FileTypeHelper {
  validate(descriptor: FileDescriptor): FileValidationResult {
    if (!descriptor.content || !descriptor.content.trim()) {
      return { isValid: false, errors: ["C++ file is empty."] };
    }
    return { isValid: true };
  }

  render(descriptor: FileDescriptor, ctx?: FileRenderContext) {
    return renderHighlightedCode(descriptor.content ?? "", "cpp", ctx);
  }
}

export const cppHelper = new CppHelper();
