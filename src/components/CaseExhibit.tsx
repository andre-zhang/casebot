"use client";

import type { Exhibit } from "@/lib/session-types";
import { eyebrowClass, surfaceSoftClass } from "@/lib/ui-classes";

export function CaseExhibit({ exhibit }: { exhibit: Exhibit }) {
  if (exhibit.type === "table") {
    return (
      <div className={`overflow-x-auto ${surfaceSoftClass}`}>
        <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          {exhibit.title}
        </p>
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--uoft-border)] text-left text-[var(--uoft-muted)]">
              {exhibit.headers.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exhibit.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[var(--uoft-border)]/40 text-[var(--foreground)] last:border-0"
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
    <div className={surfaceSoftClass}>
      <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
        {exhibit.title}
        {exhibit.unit ? (
          <span className="ml-2 text-xs font-normal text-[var(--uoft-muted)]">
            ({exhibit.unit})
          </span>
        ) : null}
      </p>
      <div className="flex items-end gap-3 sm:gap-4">
        {exhibit.labels.map((label, i) => {
          const value = exhibit.values[i] ?? 0;
          const height = Math.max(8, Math.round((value / max) * 100));
          return (
            <div
              key={label}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span className="text-xs font-semibold text-[var(--uoft-blue)]">
                {value}
              </span>
              <div
                className="w-full max-w-[72px] rounded-t-sm bg-[var(--uoft-blue)]"
                style={{ height: `${height}px` }}
              />
              <span className="text-center text-xs text-[var(--uoft-muted)]">
                {label}
              </span>
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
      <p className={eyebrowClass}>Exhibit</p>
      {exhibits.map((exhibit, i) => (
        <CaseExhibit key={`${exhibit.title}-${i}`} exhibit={exhibit} />
      ))}
    </section>
  );
}
