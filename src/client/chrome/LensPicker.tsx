import type { LensDefinition } from "@shared/types";

interface LensPickerProps {
  available: LensDefinition[];
  activeLensCount: number;
  onActivate: (definitionId: string) => void;
  onClose: () => void;
}

export function LensPicker({ available, activeLensCount, onActivate, onClose }: LensPickerProps) {
  const atLimit = activeLensCount >= 5;
  const presets = available.filter((l) => l.source === "preset");
  const userLenses = available.filter((l) => l.source === "user");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-[400px] max-h-[500px] overflow-y-auto rounded-xl p-6"
        style={{ background: "var(--loupe-surface)", border: "1px solid var(--loupe-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium" style={{ color: "var(--loupe-text)" }}>
            Choose a Lens
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full
                       opacity-60 hover:opacity-100 cursor-pointer
                       hover:bg-white/5 text-lg leading-none"
            style={{ color: "var(--loupe-text-muted)" }}
          >
            &times;
          </button>
        </div>

        {atLimit && (
          <p className="text-xs mb-4" style={{ color: "var(--loupe-text-muted)" }}>
            Maximum 5 lenses active. Dismiss one to add another.
          </p>
        )}

        {/* Presets */}
        <div className="mb-4">
          <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--loupe-text-dim)" }}>
            Built-in
          </h3>
          <div className="space-y-2">
            {presets.map((lens) => (
              <LensEntry
                key={lens.id}
                lens={lens}
                disabled={atLimit}
                onActivate={() => { onActivate(lens.id); onClose(); }}
              />
            ))}
          </div>
        </div>

        {/* User lenses */}
        {userLenses.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--loupe-text-dim)" }}>
              Your Lenses
            </h3>
            <div className="space-y-2">
              {userLenses.map((lens) => (
                <LensEntry
                  key={lens.id}
                  lens={lens}
                  disabled={atLimit}
                  onActivate={() => { onActivate(lens.id); onClose(); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LensEntry({
  lens,
  disabled,
  onActivate,
}: {
  lens: LensDefinition;
  disabled: boolean;
  onActivate: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{
        background: "var(--loupe-bg)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
        style={{ background: `${lens.color}22`, color: lens.color }}
      >
        {lens.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: "var(--loupe-text)" }}>
          {lens.name}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--loupe-text-muted)" }}>
          {lens.description}
        </div>
      </div>
      <button
        onClick={onActivate}
        disabled={disabled}
        className="text-xs px-3 py-1 rounded cursor-pointer hover:opacity-80 disabled:cursor-not-allowed shrink-0"
        style={{ background: `${lens.color}20`, color: lens.color }}
      >
        Activate
      </button>
    </div>
  );
}
