import type { FileDescriptor } from "./types";
export type { FileDescriptor, FileTypeHelper, FileValidationResult } from "./types";
export { getFileHelper } from "./factory";
import { registerFileHelper } from "./factory";
import { plainTextHelper } from "./plainTextHelper";
import { tomlHelper } from "./tomlHelper";
import { markdownHelper } from "./markdownHelper";
import { yamlHelper } from "./yamlHelper";
import { jsonHelper } from "./jsonHelper";
import { pythonHelper } from "./pythonHelper";
import { cppHelper } from "./cppHelper";

registerFileHelper(["txt", "text", "log"], plainTextHelper);
registerFileHelper(["toml"], tomlHelper);
registerFileHelper(["md", "markdown"], markdownHelper);
registerFileHelper(["yaml", "yml"], yamlHelper);
registerFileHelper(["json"], jsonHelper);
registerFileHelper(["py"], pythonHelper);
registerFileHelper(["cpp", "cc", "cxx", "hpp", "hh", "hxx"], cppHelper);

export type { FileRenderContext } from "./types";
