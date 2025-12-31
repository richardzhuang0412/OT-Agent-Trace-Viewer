import type { FileDescriptor } from "./types";
export type { FileDescriptor, FileTypeHelper, FileValidationResult } from "./types";
export { getFileHelper } from "./factory";
import { registerFileHelper } from "./factory";
import { plainTextHelper } from "./plainTextHelper";
import { tomlHelper } from "./tomlHelper";
import { markdownHelper } from "./markdownHelper";

registerFileHelper(["txt", "text", "log"], plainTextHelper);
registerFileHelper(["toml"], tomlHelper);
registerFileHelper(["md", "markdown"], markdownHelper);

export type { FileRenderContext } from "./types";
