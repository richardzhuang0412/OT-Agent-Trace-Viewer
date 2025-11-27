import { Badge } from '@/components/ui/badge';
import type { ParsedTurn } from '@shared/schema';
import { Brain, CheckCircle, ChevronDown, ChevronRight, Eye, FileText, Terminal } from 'lucide-react';
import { useState } from 'react';

interface TurnBreakdownDisplayProps {
  turn: ParsedTurn;
  index: number;
}

export function TurnBreakdownDisplay({ turn, index }: TurnBreakdownDisplayProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['raw']));

  const toggleSection = (section: string) => {
    const newSections = new Set(expandedSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setExpandedSections(newSections);
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'user':
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-none">User</Badge>;
      case 'assistant':
        return <Badge className="bg-green-600 hover:bg-green-700 text-white border-none">Assistant</Badge>;
      case 'system':
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white border-none">System</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const isUser = turn.role.toLowerCase() === 'user';
  const containerClass = isUser 
    ? "border-l-4 border-l-blue-500 border-y border-r border-gray-200 dark:border-gray-700 dark:border-l-blue-500" 
    : "border-l-4 border-l-green-500 border-y border-r border-gray-200 dark:border-gray-700 dark:border-l-green-500";
  
  const bgClass = isUser
    ? "bg-blue-50/50 dark:bg-blue-900/10"
    : "bg-green-50/50 dark:bg-green-900/10";

  const sections = turn.sections;
  const hasSections =
    sections.thoughts || sections.actions || sections.observations || sections.results;

  return (
    <div className={`rounded-lg overflow-hidden ${containerClass}`}>
      <div
        className={`${bgClass} p-4 flex items-center gap-3 cursor-pointer hover:opacity-95 transition`}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        )}
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          Turn {index + 1}
        </span>
        <div className="ml-auto">{getRoleBadge(turn.role)}</div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {hasSections ? (
            <>
              {sections.thoughts && (
                <Section
                  title="Thoughts"
                  icon={<Brain className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                  content={sections.thoughts}
                  sectionId="thoughts"
                  expanded={expandedSections.has('thoughts')}
                  onToggle={() => toggleSection('thoughts')}
                  color="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                />
              )}

              {sections.actions && (
                <Section
                  title="Actions"
                  icon={<Terminal className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
                  content={sections.actions}
                  sectionId="actions"
                  expanded={expandedSections.has('actions')}
                  onToggle={() => toggleSection('actions')}
                  color="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20"
                />
              )}

              {sections.observations && (
                <Section
                  title="Observations"
                  icon={<Eye className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                  content={sections.observations}
                  sectionId="observations"
                  expanded={expandedSections.has('observations')}
                  onToggle={() => toggleSection('observations')}
                  color="border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20"
                />
              )}

              {sections.results && (
                <Section
                  title="Results"
                  icon={<CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  content={sections.results}
                  sectionId="results"
                  expanded={expandedSections.has('results')}
                  onToggle={() => toggleSection('results')}
                  color="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                />
              )}

              <Section
                title="Raw Content"
                icon={<FileText className="h-4 w-4 text-gray-500" />}
                content={sections.raw}
                sectionId="raw"
                expanded={expandedSections.has('raw')}
                onToggle={() => toggleSection('raw')}
                color="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              />
            </>
          ) : (
            <Section
              title="Content"
              icon={<FileText className="h-4 w-4 text-gray-500" />}
              content={sections.raw}
              sectionId="raw"
              expanded={true}
              onToggle={() => {}}
              color="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            />
          )}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  content: string;
  sectionId: string;
  expanded: boolean;
  onToggle: () => void;
  color?: string;
}

function Section({ title, icon, content, sectionId, expanded, onToggle, color }: SectionProps) {
  return (
    <div className={`border rounded ${color || 'border-gray-200 dark:border-gray-700'}`}>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 hover:opacity-80 transition text-left text-foreground dark:text-gray-200"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        {icon && <span className="mr-1">{icon}</span>}
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-foreground dark:text-gray-100">
          <ContentDisplay content={content} />
        </div>
      )}
    </div>
  );
}

interface ContentDisplayProps {
  content: string;
}

function ContentDisplay({ content }: ContentDisplayProps) {
  // Try to detect JSON blocks and highlight them
  const isJson = content.trim().startsWith('{') || content.trim().startsWith('[');

  return (
    <pre className="text-xs overflow-x-auto bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2 text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
      {isJson ? (
        <code>{JSON.stringify(JSON.parse(content), null, 2)}</code>
      ) : (
        <code>{content}</code>
      )}
    </pre>
  );
}
