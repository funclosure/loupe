import { useEffect } from "react";

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // Prevent App.tsx global Escape handler from also firing
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded"
        />
        {alt && (
          <p
            className="text-sm max-w-[60ch] text-center"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            {alt}
          </p>
        )}
      </div>
    </div>
  );
}
