import { Link } from "react-router-dom";

export type BarTone = "critical" | "high" | "moderate" | "low" | "blue" | "steel" | "slate";
export interface BarPart { key: string; label: string; value: number; to?: string }
export interface BarItem { key: string; label: string; value: number; share: number; tone: BarTone; hint?: string; to?: string; parts?: BarPart[] }

/** Horizontal bar list. Bar length is the share of the total, so every bar in one chart is on the same scale. */
export default function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  return (
    <ul className="barlist" aria-label={ariaLabel}>
      {items.map((it) => {
        const head = (
          <>
            <span className="bl-label">{it.label}</span>
            <span className="bl-val mono">{it.value}<small>{it.share}%</small></span>
            <span className="bl-track"><span className={`bl-fill ${it.tone}`} style={{ width: `${it.value ? Math.max(it.share, 1.5) : 0}%` }} /></span>
          </>
        );
        return (
          <li key={it.key} className="bl-item">
            {it.to ? <Link to={it.to} className="bl-row link" title={`View ${it.label.toLowerCase()} alerts`}>{head}</Link> : <div className="bl-row">{head}</div>}
            {it.hint && <div className="bl-hint">{it.hint}</div>}
            {it.parts && it.parts.length > 1 && (
              <ul className="bl-parts">
                {it.parts.map((p) => <li key={p.key}>{p.to ? <Link to={p.to}>{p.label}</Link> : p.label}<span className="mono">{p.value}</span></li>)}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
