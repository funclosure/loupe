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
}

interface LensLayerProps {
  lenses: Map<string, LensState>;
  definitions: LensDefinition[];
  onToggleExpanded: (lensId: string) => void;
  onDismiss: (lensId: string) => void;
  onAsk: (lensId: string, message: string) => void;
  onFocus: (lensId: string) => void;
  onRethink: (lensId: string) => void;
  onReset: (lensId: string) => void;
}

export function LensLayer({
  lenses,
  definitions,
  onToggleExpanded,
  onDismiss,
  onAsk,
  onFocus,
  onRethink,
  onReset,
}: LensLayerProps) {
  const entries = Array.from(lenses.entries());
  if (entries.length === 0) return null;

  return (
    <div className="fixed right-4 top-14 bottom-4 w-[320px] max-w-[35vw] flex flex-col gap-4 pointer-events-none z-10 overflow-y-auto overflow-x-hidden">
      {entries.map(([lensId, state]) => {
        const def = definitions.find((d) => d.id === state.definitionId);
        if (!def) return null;

        return (
          <div key={lensId} className="pointer-events-auto">
            {state.expanded ? (
              <LensChat
                lensId={lensId}
                definition={def}
                messages={state.messages}
                streamingContent={state.streamingContent}
                isThinking={state.status === "thinking"}
                onAsk={(msg) => onAsk(lensId, msg)}
                onFocus={() => onFocus(lensId)}
                onRethink={() => onRethink(lensId)}
                onReset={() => onReset(lensId)}
                onClose={() => onToggleExpanded(lensId)}
              />
            ) : (
              <LensBubble
                lensId={lensId}
                definition={def}
                status={state.status}
                preview={state.preview}
                onClick={() => onToggleExpanded(lensId)}
                onDismiss={() => onDismiss(lensId)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
