import { Highlight, type Language, themes } from "prism-react-renderer";
import Prism from "prismjs";
import "prismjs/components/prism-toml";
import { parse, stringify } from "smol-toml";
import type { FileDescriptor, FileRenderContext, FileTypeHelper, FileValidationResult } from "./types";

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
    const theme =
      ctx?.theme === "light" ? themes.github : themes.nightOwl;

    return (
      <Highlight
        prism={Prism as any}
        code={content}
        theme={theme}
        language={TOML_LANGUAGE}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`file-viewer__pre ${className}`}
            style={{
              ...style,
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              borderRadius: "0.5rem",
              padding: "1rem",
            }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    );
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
