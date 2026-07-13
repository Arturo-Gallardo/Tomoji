import { useCallback, useState } from "react";
import type { CompanionInstance } from "../../types/companionInstance";
import { AddTomojiCard } from "./AddTomojiCard";
import { TomojiCard } from "./TomojiCard";

interface TomojiGridProps {
  instances: CompanionInstance[];
  reorderable?: boolean;
  onReorder?: (orderedIds: string[]) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onAdd?: () => void;
  confirmBeforeDelete?: boolean;
}

export function TomojiGrid({
  instances,
  reorderable = false,
  onReorder,
  onDelete,
  onToggle,
  onEdit,
  onArchive,
  onRestore,
  onAdd,
  confirmBeforeDelete = true,
}: TomojiGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTargetId(null);
  }, []);

  const handleDragOver = useCallback(
    (targetId: string) => {
      if (!draggingId || draggingId === targetId) {
        return;
      }
      setDropTargetId(targetId);
    },
    [draggingId],
  );

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!draggingId || draggingId === targetId || !onReorder) {
        handleDragEnd();
        return;
      }

      const ids = instances.map((instance) => instance.id);
      const fromIndex = ids.indexOf(draggingId);
      const toIndex = ids.indexOf(targetId);

      if (fromIndex === -1 || toIndex === -1) {
        handleDragEnd();
        return;
      }

      const nextIds = [...ids];
      nextIds.splice(fromIndex, 1);
      nextIds.splice(toIndex, 0, draggingId);
      onReorder(nextIds);
      handleDragEnd();
    },
    [draggingId, handleDragEnd, instances, onReorder],
  );

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-4 sm:gap-5">
      {instances.map((instance, index) => (
        <TomojiCard
          key={instance.id}
          instance={instance}
          reorderable={reorderable}
          isDragging={draggingId === instance.id}
          isDropTarget={dropTargetId === instance.id}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDelete={onDelete}
          onToggle={onToggle}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
          confirmBeforeDelete={confirmBeforeDelete}
          style={{ animationDelay: `${Math.min(index, 8) * 32}ms` }}
        />
      ))}

      {onAdd ? (
        <AddTomojiCard
          onAdd={onAdd}
          style={{ animationDelay: `${Math.min(instances.length, 8) * 32}ms` }}
        />
      ) : null}
    </div>
  );
}
