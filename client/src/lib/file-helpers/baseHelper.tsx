import type { FileTypeHelper, FileDescriptor, FileRenderContext, FileValidationResult } from "./types";

export class BaseFileHelper implements FileTypeHelper {
  validate(_: FileDescriptor): FileValidationResult {
    return { isValid: true };
  }

  render(descriptor: FileDescriptor, _ctx?: FileRenderContext) {
    const content = descriptor.content ?? "";
    return (
      <pre className="file-viewer__pre">
        <code>{content}</code>
      </pre>
    );
  }
}
