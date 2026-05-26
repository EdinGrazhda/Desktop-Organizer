import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export interface DragDropState {
  isDragging: boolean;
  /** The slot-id attribute of the card currently under the cursor, or null */
  hoveredSlotId: string | null;
}

/**
 * Listens for OS-level file drag events on the Tauri window.
 * Calls `onDrop(paths, slotId)` when files are released.
 * Exposes `isDragging` and `hoveredSlotId` for visual feedback.
 *
 * Slot cards must have a `data-slot-id` attribute for per-card highlighting.
 */
export function useDragDrop(
  onDrop: (paths: string[], slotId: string | null) => void
): DragDropState {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        const payload = event.payload as {
          type: string;
          paths?: string[];
          position?: { x: number; y: number };
        };

        if (payload.type === "enter" || payload.type === "over") {
          const pos = payload.position;
          if (pos) {
            const el = document.elementFromPoint(pos.x, pos.y);
            const slotEl = el?.closest<HTMLElement>("[data-slot-id]");
            setIsDragging(true);
            setHoveredSlotId(slotEl?.dataset.slotId ?? null);
          } else {
            setIsDragging(true);
          }

        } else if (payload.type === "drop") {
          const pos = payload.position;
          const el = pos ? document.elementFromPoint(pos.x, pos.y) : null;
          const slotEl = el?.closest<HTMLElement>("[data-slot-id]");
          const slotId = slotEl?.dataset.slotId ?? null;
          setIsDragging(false);
          setHoveredSlotId(null);
          onDropRef.current(payload.paths ?? [], slotId);

        } else if (payload.type === "leave") {
          setIsDragging(false);
          setHoveredSlotId(null);
        }
      })
      .then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  return { isDragging, hoveredSlotId };
}
