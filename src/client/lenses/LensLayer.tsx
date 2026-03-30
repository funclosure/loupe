import type { LensDefinition } from "@shared/types";
import { LensBubble } from "./LensBubble";
import { LensChat } from "./LensChat";

interface LensState {
  lensId: string;
  definitionId: string;
  status: "idle" | "thinking" | "error";
  preview: string | null;
  messages: { role: "user" | "lens"; content: string }[];
  streamingContent: string;
  expanded: boolean;
  seen: boolean;
}

interface LensLayerProps {
  lenses: Map<string, LensState>;
  definitions: LensDefinition[];
  onToggleExpanded: (lensId: string) => void;
  onDismiss: (lensId: string) => void;
  onAsk: (lensId: string, message: string) => void;
  onRethink: (lensId: string) => void;
  onReset: (lensId: string) => void;
  onBubbleDragStart?: (lensId: string, e: React.PointerEvent) => void;
  draggingLensId?: string | null;
  onCreateLens?: (proposal: { name: string; description: string; icon: string; color: string; systemPrompt: string }) => void;
}

export function LensLayer({
  lenses,
  definitions,
  onToggleExpanded,
  onDismiss,
  onAsk,
  onRethink,
  onReset,
  onBubbleDragStart,
  draggingLensId,
  onCreateLens,
}: LensLayerProps) {
  const entries = Array.from(lenses.entries());
  if (entries.length === 0) return null;

  // Find expanded lens (only one at a time)
  const expandedEntry = entries.find(([, s]) => s.expanded);

  return (
    <>
      {/* Bubble column — near the editor text */}
      <div
        className="fixed top-14 bottom-4 flex flex-col gap-3 pointer-events-none z-10 overflow-y-auto overflow-x-hidden"
        style={{ right: "max(1rem, calc(50% - 420px))" }}
      >
        {entries.map(([lensId, state]) => {
          const def = definitions.find((d) => d.id === state.definitionId);
          if (!def || state.expanded) return null;

          return (
            <div key={lensId} className="pointer-events-auto" data-lens-id={lensId}>
              <LensBubble
                lensId={lensId}
                definition={def}
                status={state.status}
                preview={state.seen ? null : state.preview}
                onClick={() => onToggleExpanded(lensId)}
                onDismiss={() => onDismiss(lensId)}
                onDragStart={(e) => onBubbleDragStart?.(lensId, e)}
                isDragging={draggingLensId === lensId}
              />
            </div>
          );
        })}
      </div>

      {/* Expanded chat — fixed to right edge */}
      {expandedEntry && (() => {
        const [lensId, state] = expandedEntry;
        const def = definitions.find((d) => d.id === state.definitionId);
        if (!def) return null;

        return (
          <div className="loupe-chat-fixed">
            <LensChat
              lensId={lensId}
              definition={def}
              messages={state.messages}
              streamingContent={state.streamingContent}
              isThinking={state.status === "thinking"}
              onAsk={(msg) => onAsk(lensId, msg)}
              onRethink={() => onRethink(lensId)}
              onReset={() => onReset(lensId)}
              onClose={() => onToggleExpanded(lensId)}
              onCreateLens={onCreateLens}
            />
          </div>
        );
      })()}
    </>
  );
}
