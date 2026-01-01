import type { FileDescriptor, FileTypeHelper } from "./types";
import { plainTextHelper } from "./plainTextHelper";

type Extension = string;

const helperRegistry = new Map<Extension, FileTypeHelper>();

export function registerFileHelper(extensions: Extension[], helper: FileTypeHelper) {
  extensions.forEach((ext) => {
    helperRegistry.set(ext.toLowerCase(), helper);
  });
}

export function getFileHelper(descriptor: FileDescriptor): FileTypeHelper {
  const ext = getExtension(descriptor.name || descriptor.path || "");
  if (ext && helperRegistry.has(ext)) {
    return helperRegistry.get(ext)!;
  }
  return plainTextHelper;
}

function getExtension(path?: string): string | null {
  if (!path) return null;
  const fragments = path.toLowerCase().split(".");
  if (fragments.length < 2) return null;
  return fragments.pop() || null;
}

export function listRegisteredHelpers() {
  return helperRegistry;
}
