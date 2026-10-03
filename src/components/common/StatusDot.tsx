export default function StatusDot({ tone = "green" }: { tone?: string }) {
  return <span className={`status-dot ${tone}`} aria-hidden="true" />;
}
