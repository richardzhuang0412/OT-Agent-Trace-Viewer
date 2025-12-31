import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getFileHelper, type FileDescriptor } from "@/lib/file-helpers";

interface FileViewerProps {
  file: FileDescriptor;
  className?: string;
}

function detectTheme(): "light" | "dark" {
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  return "dark";
}

export function FileViewer({ file, className }: FileViewerProps) {
  const { toast } = useToast();
  const helper = useMemo(() => getFileHelper(file), [file.name, file.path]);
  const validation = useMemo(
    () => helper.validate(file),
    [helper, file.content, file.size],
  );
  const theme = detectTheme();

  useEffect(() => {
    if (!validation.isValid && validation.errors?.length) {
      toast({
        title: `Invalid ${file.name}`,
        description: validation.errors.join("\n"),
        variant: "destructive",
      });
    }
  }, [validation, toast, file.name]);

  const hasWarnings = validation.warnings?.length;

  return (
    <div
      className={cn(
        "file-viewer space-y-2 rounded-lg border bg-card/50 p-3",
        !validation.isValid && "file-viewer--invalid",
        className,
      )}
      data-invalid={!validation.isValid}
    >
      {hasWarnings && (
        <div className="text-xs text-amber-500">
          {validation.warnings!.map((warning, index) => (
            <div key={index}>{warning}</div>
          ))}
        </div>
      )}
      {helper.render(file, { theme })}
    </div>
  );
}
