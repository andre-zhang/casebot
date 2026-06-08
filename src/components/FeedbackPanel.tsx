"use client";

import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let listItems: string[] = [];
  let inList = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={`list-${elements.length}`} className="my-3 list-disc space-y-1 pl-5">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
    inList = false;
  };

  const flushTable = () => {
    if (tableRows.length < 2) {
      tableRows = [];
      inTable = false;
      return;
    }
    const [header, ...rows] = tableRows;
    elements.push(
      <div key={`table-${elements.length}`} className="my-4 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-600 bg-slate-800/80">
              {header.map((cell, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium text-slate-300">
                  {cell.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-700/60">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-200">
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!cells.every((c) => /^[-:]+$/.test(c))) {
        tableRows.push(cells);
      }
      continue;
    }

    if (inTable) flushTable();

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${elements.length}`}
          className="mt-6 mb-2 text-base font-semibold text-white first:mt-0"
        >
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${elements.length}`}
          className="mt-4 mb-2 text-sm font-semibold text-slate-200"
        >
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inList = true;
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (inList && trimmed === "") {
      flushList();
      continue;
    }

    if (inList) flushList();

    if (trimmed === "") continue;

    elements.push(
      <p key={`p-${elements.length}`} className="my-2 leading-relaxed text-slate-300">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();

  return <>{elements}</>;
}

export function FeedbackPanel({ markdown }: { markdown: string }) {
  return (
    <section className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 p-6 sm:p-8">
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
        Case debrief
      </p>
      <div className="text-sm">
        <SimpleMarkdown content={markdown} />
      </div>
    </section>
  );
}
