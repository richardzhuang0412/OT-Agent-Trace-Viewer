import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ParsedTurn } from '@shared/schema';

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
        return <Badge className="bg-blue-500 hover:bg-blue-600">User</Badge>;
      case 'assistant':
        return <Badge className="bg-green-500 hover:bg-green-600">Assistant</Badge>;
      case 'system':
        return <Badge className="bg-purple-500 hover:bg-purple-600">System</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  const sections = turn.sections;
  const hasSections =
    sections.thoughts || sections.actions || sections.observations || sections.results;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        className="bg-gray-50 dark:bg-gray-800 p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-foreground dark:text-gray-300" />
        ) : (
          <ChevronRight className="h-4 w-4 text-foreground dark:text-gray-300" />
        )}
        <span className="text-sm font-semibold text-muted-foreground dark:text-gray-400">
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
                  content={sections.thoughts}
                  sectionId="thoughts"
                  expanded={expandedSections.has('thoughts')}
                  onToggle={() => toggleSection('thoughts')}
                  color="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                />
              )}

              {sections.actions && (
                <Section
                  title="Actions"
                  content={sections.actions}
                  sectionId="actions"
                  expanded={expandedSections.has('actions')}
                  onToggle={() => toggleSection('actions')}
                  color="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                />
              )}

              {sections.observations && (
                <Section
                  title="Observations"
                  content={sections.observations}
                  sectionId="observations"
                  expanded={expandedSections.has('observations')}
                  onToggle={() => toggleSection('observations')}
                  color="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20"
                />
              )}

              {sections.results && (
                <Section
                  title="Results"
                  content={sections.results}
                  sectionId="results"
                  expanded={expandedSections.has('results')}
                  onToggle={() => toggleSection('results')}
                  color="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20"
                />
              )}

              <Section
                title="Raw Content"
                content={sections.raw}
                sectionId="raw"
                expanded={expandedSections.has('raw')}
                onToggle={() => toggleSection('raw')}
                color="border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
              />
            </>
          ) : (
            <Section
              title="Content"
              content={sections.raw}
              sectionId="raw"
              expanded={true}
              onToggle={() => {}}
              color="border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            />
          )}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  content: string;
  sectionId: string;
  expanded: boolean;
  onToggle: () => void;
  color?: string;
}

function Section({ title, content, sectionId, expanded, onToggle, color }: SectionProps) {
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
        <span className="text-sm font-semibold text-foreground dark:text-gray-200">{title}</span>
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
