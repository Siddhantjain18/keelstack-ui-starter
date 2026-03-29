type KeelStackBrandLinkProps = {
  compact?: boolean;
  showCaption?: boolean;
  className?: string;
};

export function KeelStackBrandLink({
  compact = false,
  showCaption = true,
  className = "",
}: KeelStackBrandLinkProps) {
  return (
    <a
      href="https://keelstack.me"
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 min-w-0 ${className}`.trim()}
      title="Visit KeelStack Engine"
    >
      <KeelStackLogoMark />
      {!compact && (
        <div className="min-w-0">
          <p className="font-display font-bold text-fg tracking-tight text-sm leading-none">
            KeelStack Engine
          </p>
          {showCaption && (
            <p className="text-[11px] text-fg-muted mt-1 truncate">Built with the engine</p>
          )}
        </div>
      )}
    </a>
  );
}

export function KeelStackLogoMark({ size = "default" }: { size?: "default" | "large" }) {
  const boxSize = size === "large" ? "h-12 w-12 rounded-2xl" : "h-9 w-9 rounded-xl";
  const iconSize = size === "large" ? 24 : 20;

  return (
    <div
      className={`${boxSize} flex items-center justify-center shrink-0 border border-white/10`}
      style={{
        background:
          "radial-gradient(circle at top left, rgba(99,102,241,0.95), rgba(59,130,246,0.72) 58%, rgba(17,17,24,0.95))",
        boxShadow: "0 10px 25px rgba(99,102,241,0.2)",
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 5.5V18.5M7.75 12H16M16 5.5L10.5 12L16 18.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function KeelStackPoweredBadge() {
  return (
    <a
      href="https://keelstack.me"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-fg-muted transition-all hover:border-accent/50 hover:text-fg"
      style={{ background: "rgba(17,17,24,0.72)" }}
    >
      <span className="font-mono uppercase tracking-[0.2em] text-accent">Built with</span>
      <span className="font-display font-semibold text-fg">KeelStack Engine</span>
      <span className="text-accent">↗</span>
    </a>
  );
}

export function KeelStackSidebarCard() {
  return (
    <a
      href="https://keelstack.me"
      target="_blank"
      rel="noreferrer"
      className="mb-3 block rounded-xl border border-border p-3 transition-all hover:border-accent/50 hover:bg-white/5"
      style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(17,17,24,0.9))" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-2">
        Built with
      </p>
      <div className="flex items-center gap-3">
        <KeelStackBrandLink showCaption={false} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-fg-muted">
        <span>Open keelstack.me</span>
        <span className="text-accent">↗</span>
      </div>
    </a>
  );
}
