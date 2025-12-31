import type { ReactNode } from "react";

export interface FileDescriptor {
  name: string;
  path?: string;
  size?: number;
  content?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  details?: Record<string, unknown>;
}

export interface FileRenderContext {
  theme?: "light" | "dark";
  className?: string;
}

export interface FileTypeHelper {
  validate(descriptor: FileDescriptor): FileValidationResult;
  render(descriptor: FileDescriptor, ctx?: FileRenderContext): ReactNode;
}
