"use client";

import React, { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export const TableOfContents: React.FC = () => {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const updateHeadings = () => {
      const elements = Array.from(document.querySelectorAll("h2[id], h3[id]"));
      const items = elements.map((el) => ({
        id: el.id,
        text: el.textContent || "",
        level: Number(el.tagName.replace("H", "")),
      }));
      setHeadings(items);

      if (items.length > 0) {
        setActiveId((prev) => prev || items[0].id);
      }
    };

    updateHeadings();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -65% 0px", threshold: 0.1 }
    );

    const elements = document.querySelectorAll("h2[id], h3[id]");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <nav className="w-60 hidden xl:block sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto p-4 text-xs font-mono">
      <div className="text-slate-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        On This Page
      </div>
      <ul className="space-y-2 border-l border-white/10 pl-3">
        {headings.map((h) => (
          <li key={h.id} style={{ marginLeft: `${Math.max(0, (h.level - 2) * 10)}px` }}>
            <a
              href={`#${h.id}`}
              className={`block transition-colors py-0.5 truncate ${
                activeId === h.id
                  ? "text-cyan-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
