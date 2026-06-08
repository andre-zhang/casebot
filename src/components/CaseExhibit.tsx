"use client";

import type { Exhibit } from "@/lib/session-types";

export function CaseExhibit({ exhibit }: { exhibit: Exhibit }) {
  if (exhibit.type === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-600 bg-slate-900/80 p-4">
        <p className="mb-3 text-sm font-medium text-slate-200">{exhibit.title}</p>
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-600 text-left text-slate-400">
              {exhibit.headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exhibit.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-700/80 text-slate-100 last:border-0"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const max = Math.max(...exhibit.values, 1);

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-900/80 p-4">
      <p className="mb-4 text-sm font-medium text-slate-200">
        {exhibit.title}
        {exhibit.unit ? (
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({exhibit.unit})
          </span>
        ) : null}
      </p>
      <div className="flex items-end gap-3 sm:gap-4">
        {exhibit.labels.map((label, i) => {
          const value = exhibit.values[i] ?? 0;
          const height = Math.max(8, Math.round((value / max) * 120));
          return (
            <div
              key={label}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span className="text-xs font-medium text-sky-300">{value}</span>
              <div
                className="w-full max-w-[72px] rounded-t bg-gradient-to-t from-sky-700 to-sky-500"
                style={{ height: `${height}px` }}
              />
              <span className="text-center text-xs text-slate-400">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExhibitPanel({ exhibits }: { exhibits: Exhibit[] }) {
  if (exhibits.length === 0) return null;

  return (
    <section className="w-full space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Exhibit
      </p>
      {exhibits.map((exhibit, i) => (
        <CaseExhibit key={`${exhibit.title}-${i}`} exhibit={exhibit} />
      ))}
    </section>
  );
}
