import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Filter state kept in the URL query string, so a filtered view survives navigating to a detail screen and back,
 * and can be linked to from other pages (for example Analytics -> /alerts?risk=critical).
 * Values equal to their default are omitted from the URL.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) { const v = params.get(k); if (v !== null) (out as Record<string, string>)[k] = v; }
    return out;
  }, [params, defaults]);

  const set = useCallback((patch: Partial<T>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === defaults[k] || v === "") next.delete(k); else next.set(k, v as string);
      }
      return next;
    }, { replace: true });
  }, [setParams, defaults]);

  return [values, set, params] as const;
}
