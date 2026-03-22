'use client';

interface TableBlockProps {
  content: {
    headers?: string[];
    rows?: (string | number)[][];
  };
  metadata?: Record<string, unknown>;
}

export function TableBlock({ content }: TableBlockProps) {
  const headers = content?.headers || [];
  const rows = content?.rows || [];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4 text-center text-sm text-[var(--fg-muted)]">
        Empty table
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full border-collapse text-sm">
        {headers.length > 0 && (
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              {headers.map((h, i) => (
                <th key={i} className="border-b border-[var(--border)] px-4 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-[var(--border)] last:border-b-0">
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
