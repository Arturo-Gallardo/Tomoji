import { useEffect, useRef, useState } from "react";
import { useCharacterAnimationRegistry } from "../../hooks/useCharacterAnimationRegistry";
import type { AnimationRegistry } from "../../services/animationRegistry";
import { isBuiltinCharacterId } from "../../services/characterLibrary";
import type { CompanionInstance } from "../../types/companionInstance";
import { MutedIcon } from "../MutedIcon";
import { FittedTomojiSprite } from "./FittedTomojiSprite";

const CARD_SPRITE_HEIGHT = 72;

interface TomojiCardProps {
  instance: CompanionInstance;
  reorderable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDragOver?: (id: string) => void;
  onDrop?: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDuplicate?: (characterId: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  confirmBeforeDelete?: boolean;
}

interface TomojiCardSpriteProps {
  registry: AnimationRegistry;
}

function TomojiCardSprite({ registry }: TomojiCardSpriteProps) {
  const idleFrame = registry.getAnimation("idle").frames[0];

  return (
    <FittedTomojiSprite
      frameSrc={idleFrame}
      facing="left"
      action="idle"
      targetHeight={CARD_SPRITE_HEIGHT}
      maxWidth={CARD_SPRITE_HEIGHT * 1.5}
    />
  );
}

function TomojiCardSpriteLoader({ characterId }: { characterId: string }) {
  const registry = useCharacterAnimationRegistry(characterId);

  if (!registry) {
    return (
      <div
        className="rounded-lg bg-neutral-800/80 animate-pulse"
        style={{ width: CARD_SPRITE_HEIGHT * 0.75, height: CARD_SPRITE_HEIGHT * 0.75 }}
        aria-hidden
      />
    );
  }

  return <TomojiCardSprite registry={registry} />;
}

export function TomojiCard({
  instance,
  reorderable = false,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDelete,
  onToggle,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  confirmBeforeDelete = true,
}: TomojiCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isBuiltin = isBuiltinCharacterId(instance.characterId);
  const canDelete = !isBuiltin;
  const canArchive = onArchive !== undefined;
  const isArchived = instance.archived === true;

  const handleDelete = () => {
    if (
      confirmBeforeDelete &&
      !window.confirm(
        `Delete ${instance.name}? If this is the last copy, its imported files will be removed too.`,
      )
    ) {
      return;
    }

    onDelete(instance.id);
    setIsMenuOpen(false);
  };

  const handleEdit = () => {
    onEdit(instance.id);
    setIsMenuOpen(false);
  };

  const handleDuplicate = () => {
    onDuplicate?.(instance.characterId);
    setIsMenuOpen(false);
  };

  const handleArchive = () => {
    onArchive?.(instance.id);
    setIsMenuOpen(false);
  };

  const handleRestore = () => {
    onRestore?.(instance.id);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        menuRef.current !== null &&
        !menuRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <article
      draggable={reorderable}
      onDragStart={(event) => {
        if (!reorderable) {
          return;
        }
        const target = event.target;
        if (target instanceof Element && target.closest("button")) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", instance.id);
        onDragStart?.(instance.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        onDragOver?.(instance.id);
      }}
      onDrop={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        onDrop?.(instance.id);
      }}
      className={`relative flex aspect-square w-full max-w-[11rem] flex-col items-center justify-between rounded-2xl border px-4 py-4 transition-opacity ${
        isDragging ? "opacity-40" : ""
      } ${isDropTarget ? "ring-2 ring-white/60" : ""} ${
        instance.enabled && !isArchived ? "border-white" : "border-neutral-500/80"
      } bg-neutral-950 ${reorderable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={() => onToggle(instance.id, !instance.enabled)}
          disabled={isArchived}
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            instance.enabled && !isArchived
              ? "bg-white text-black"
              : "bg-neutral-800 text-neutral-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          }`}
          aria-pressed={instance.enabled && !isArchived}
        >
          {instance.enabled && !isArchived ? "On" : "Off"}
        </button>

        <div className="flex items-center gap-1">
          {instance.muted === true ? (
            <span
              className="text-neutral-400"
              aria-label={`${instance.name} is muted`}
              title="Muted"
            >
              <MutedIcon />
            </span>
          ) : null}
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsMenuOpen((current) => !current)}
            className="rounded-full px-1.5 pb-1 text-lg leading-none text-white hover:bg-neutral-800"
            aria-expanded={isMenuOpen}
            aria-label={`More options for ${instance.name}`}
          >
            ...
          </button>
        </div>
      </div>

      <div className="flex h-[72px] items-center justify-center">
        <TomojiCardSpriteLoader characterId={instance.characterId} />
      </div>

      <p className="w-full truncate text-center text-sm font-bold text-white">
        {instance.characterId}
      </p>

      {isMenuOpen ? (
        <div
          ref={menuRef}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute right-2 top-9 z-10 w-36 rounded-lg border border-neutral-700 bg-neutral-950 p-1 shadow-xl"
        >
          <button
            type="button"
            onClick={handleEdit}
            className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800"
          >
            Edit
          </button>
          {onDuplicate ? (
            <button
              type="button"
              onClick={handleDuplicate}
              className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800"
            >
              Duplicate
            </button>
          ) : null}
          {canArchive ? (
            <button
              type="button"
              onClick={handleArchive}
              className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800"
            >
              Archive
            </button>
          ) : null}
          {onRestore ? (
            <button
              type="button"
              onClick={handleRestore}
              className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800"
            >
              Restore
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-red-300 hover:bg-red-500/15"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
