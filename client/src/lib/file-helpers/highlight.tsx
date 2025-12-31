import { Highlight, themes, type Language } from "prism-react-renderer";
import Prism from "prismjs";
import type { FileRenderContext } from "./types";

const prismGlobal =
  typeof globalThis !== "undefined"
    ? (globalThis as any)
    : typeof window !== "undefined"
      ? (window as any)
      : undefined;

if (prismGlobal && !prismGlobal.Prism) {
  prismGlobal.Prism = Prism;
}

import "prismjs/components/prism-markup";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-python";
import "prismjs/components/prism-cpp";

export function renderHighlightedCode(
  code: string,
  language: Language | undefined,
  ctx?: FileRenderContext,
) {
  const theme = ctx?.theme === "light" ? themes.github : themes.nightOwl;
  const normalizedLanguage =
    typeof language === "string" && language.length > 0
      ? (language.toLowerCase() as Language)
      : ("markup" as Language);

  const safeLanguage = Prism.languages[normalizedLanguage]
    ? normalizedLanguage
    : ("markup" as Language);

  if (!Prism.languages[normalizedLanguage]) {
    console.warn(
      `[Prism] Missing grammar for language "${language}". Falling back to markup.`,
    );
  }

  try {
    return (
    <Highlight
      prism={Prism as any}
      code={code}
      theme={theme}
      language={safeLanguage}
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
  } catch (error) {
    console.error("[Prism] Failed to highlight code:", error);
    return (
      <pre className="file-viewer__pre fallback">
        <code>{code}</code>
      </pre>
    );
  }
}
