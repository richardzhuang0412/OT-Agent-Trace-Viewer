import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { Highlight, themes, type PrismTheme } from "prism-react-renderer";
import type { Components } from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";
import type { FileDescriptor, FileRenderContext, FileTypeHelper, FileValidationResult } from "./types";

class MarkdownHelper implements FileTypeHelper {
  validate(descriptor: FileDescriptor): FileValidationResult {
    const content = descriptor.content ?? "";
    if (!content.trim()) {
      return { isValid: false, errors: ["Markdown is empty."] };
    }

    if (content.includes("\u0000")) {
      return {
        isValid: false,
        errors: ["File appears to contain binary data; cannot render as Markdown."],
      };
    }

    if (content.length > 500_000) {
      return {
        isValid: true,
        warnings: ["Large markdown file – rendering may be truncated."],
      };
    }

    return { isValid: true };
  }

  render(descriptor: FileDescriptor, ctx?: FileRenderContext) {
    const content = descriptor.content ?? "";
    const theme = ctx?.theme === "light" ? themes.duotoneLight : themes.nightOwl;

    return (
      <div className="file-viewer__markdown prose prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          components={markdownComponents(theme)}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
}

type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
  node?: unknown;
};

const markdownComponents = (theme: PrismTheme): Components => ({
  code: createCodeComponent(theme),
});

const createCodeComponent =
  (theme: PrismTheme) =>
  ({ inline, className, children, ...props }: MarkdownCodeProps) => {
  const code = String(children ?? "");
  const language = /language-(\w+)/.exec(className || "");

  if (inline || !language) {
    return (
      <code className={className} {...props}>
        {code}
      </code>
    );
  }

  return (
    <Highlight
      code={code.trimEnd()}
      language={language[1] as string}
      theme={theme}
    >
      {({ className: cn, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={`file-viewer__pre ${cn}`} style={style}>
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
  };

export const markdownHelper = new MarkdownHelper();
