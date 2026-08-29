"use client";

import { useMemo, useState } from "react";
import { t } from "@/strings";

export interface PickerProduct {
  id: string;
  name: string;
  image_path: string | null;
}

/** Search-as-you-type product picker with a thumbnail (brief §8.2). Client-side filter
 *  over the full list — fine at this scale (a few hundred products). */
export function ProductPicker({
  products,
  thumbBaseUrl,
  onSelect,
}: {
  products: PickerProduct[];
  thumbBaseUrl: string;
  onSelect: (p: PickerProduct) => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products.slice(0, 8);
    return products.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 12);
  }, [q, products]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.common.search}
        className="rounded-lg border border-sand bg-surface px-3 py-2 text-base"
      />
      <ul className="flex flex-col divide-y divide-sand rounded-lg border border-sand">
        {matches.length === 0 ? (
          <li className="px-3 py-3 text-sm text-ink-60">{t.empty.noResults}</li>
        ) : (
          matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQ("");
                }}
                className="tap flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                {p.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${thumbBaseUrl}/${p.image_path}?width=80&height=80&resize=cover`}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="h-12 w-12 shrink-0 rounded-md bg-sand" />
                )}
                <span className="text-base">{p.name}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
