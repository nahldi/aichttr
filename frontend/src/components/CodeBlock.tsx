import { useState, useMemo } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);
  const lineCount = lines.length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-outline-variant/10 my-2">
      <div className="bg-surface-container-high/50 flex items-center justify-between px-4 py-2">
        <span className="text-[10px] font-bold text-secondary-dim uppercase tracking-widest">
          {language || 'code'}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-on-surface-variant/40 font-mono">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
          <button
            onClick={handleCopy}
            className="text-[10px] text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="bg-surface-container-lowest overflow-x-auto">
        <pre className="text-xs font-mono leading-relaxed">
          <code>
            <table className="border-collapse w-full">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-surface-container-high/20">
                    <td className="select-none text-right pr-4 pl-4 py-0 text-on-surface-variant/25 w-[1%] whitespace-nowrap align-top">
                      {i + 1}
                    </td>
                    <td className="pr-4 py-0 text-on-surface-variant whitespace-pre">
                      {line}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </code>
        </pre>
      </div>
    </div>
  );
}
