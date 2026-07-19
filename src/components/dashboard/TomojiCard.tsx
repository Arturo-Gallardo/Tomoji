import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCharacterIdlePreview } from "../../hooks/useCharacterIdlePreview";
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
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  confirmBeforeDelete?: boolean;
  style?: CSSProperties;
}

function TomojiCardSpriteLoader({ characterId }: { characterId: string }) {
  const idleFrame = useCharacterIdlePreview(characterId);

  if (!idleFrame) {
    return (
      <div
        className="animate-pulse rounded-lg bg-island-ink/15"
        style={{ width: CARD_SPRITE_HEIGHT * 0.75, height: CARD_SPRITE_HEIGHT * 0.75 }}
        aria-hidden
      />
    );
  }

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

function isCardActionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("button, a, input, select, textarea, [data-card-action]") !== null
  );
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
  onArchive,
  onRestore,
  confirmBeforeDelete = true,
  style,
}: TomojiCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toggleAnimationKey, setToggleAnimationKey] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isBuiltin = isBuiltinCharacterId(instance.characterId);
  const canDelete = !isBuiltin;
  const canArchive = onArchive !== undefined;
  const isArchived = instance.archived === true;
  const canToggle = !isArchived;

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

  const handleArchive = () => {
    onArchive?.(instance.id);
    setIsMenuOpen(false);
  };

  const handleRestore = () => {
    onRestore?.(instance.id);
    setIsMenuOpen(false);
  };

  const toggleInstance = () => {
    if (!canToggle) {
      return;
    }

    setToggleAnimationKey((key) => key + 1);
    onToggle(instance.id, !instance.enabled);
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
        if (isCardActionTarget(target)) {
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
      onClick={(event) => {
        if (isCardActionTarget(event.target)) {
          return;
        }

        toggleInstance();
      }}
      onKeyDown={(event) => {
        if (
          isCardActionTarget(event.target) ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }

        event.preventDefault();
        toggleInstance();
      }}
      tabIndex={canToggle ? 0 : undefined}
      style={style}
      aria-label={`${instance.name}: ${instance.enabled ? "turn off" : "turn on"}`}
      className={`island-grid-enter relative flex aspect-square w-full max-w-[12rem] flex-col items-center overflow-hidden rounded-xl border-2 bg-island-paper p-2.5 transition-[transform,border-color,box-shadow,background-color,opacity] duration-200 ease-out active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-island-ink ${
        isDragging ? "opacity-40" : ""
      } ${isDropTarget ? "ring-2 ring-island-orange/70" : ""} ${
        instance.enabled && !isArchived
          ? "border-island-ink/65 shadow-[0_4px_0_rgba(24,52,79,0.14)]"
          : "border-island-ink/25"
      } ${
        canToggle
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-island-ink/60 hover:shadow-[0_4px_0_rgba(24,52,79,0.12)]"
          : "cursor-default"
      }`}
    >
      {toggleAnimationKey > 0 ? (
        <span
          key={toggleAnimationKey}
          className={`tomoji-card-toggle-flash pointer-events-none absolute inset-0 rounded-xl ${
            instance.enabled && !isArchived ? "bg-island-orange/25" : "bg-island-ink/5"
          }`}
          aria-hidden
        />
      ) : null}

      <div className="flex w-full items-center justify-between px-0.5 pb-2">
        <button
          type="button"
          onClick={toggleInstance}
          disabled={isArchived}
          className={`rounded-md border-2 border-island-ink/55 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide transition-colors ${
            instance.enabled && !isArchived
              ? "bg-island-orange text-island-ink"
              : "bg-island-paper text-island-muted hover:bg-island-cream disabled:cursor-not-allowed disabled:opacity-50"
          }`}
          aria-pressed={instance.enabled && !isArchived}
        >
          {instance.enabled && !isArchived ? "On" : "Off"}
        </button>

        <div className="flex items-center gap-1">
          {instance.muted === true ? (
            <span
              className="text-island-ink/65"
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
            className="grid h-7 w-7 place-items-center rounded-md text-sm font-extrabold leading-none text-island-ink hover:bg-island-custard"
            aria-expanded={isMenuOpen}
            aria-label={`More options for ${instance.name}`}
          >
            •••
          </button>
        </div>
      </div>

      <div
        key={toggleAnimationKey}
        className={`flex min-h-0 w-full flex-1 items-center justify-center rounded-lg border border-island-ink/15 bg-island-orange/55 ${
          toggleAnimationKey > 0 ? "tomoji-card-toggle-pop" : ""
        }`}
      >
        <TomojiCardSpriteLoader characterId={instance.characterId} />
      </div>

      <p className="w-full truncate px-1 pt-2 text-center text-sm font-extrabold text-island-ink" title={instance.characterId}>
        {instance.name}
      </p>

      {isMenuOpen ? (
        <div
          ref={menuRef}
          data-card-action
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute right-2 top-9 z-10 w-36 rounded-lg border-2 border-island-ink/30 bg-island-paper p-1 shadow-xl"
        >
          <button
            type="button"
            onClick={handleEdit}
            className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-island-ink hover:bg-island-custard"
          >
            Edit
          </button>
          {canArchive ? (
            <button
              type="button"
              onClick={handleArchive}
              className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-island-ink hover:bg-island-custard"
            >
              Archive
            </button>
          ) : null}
          {onRestore ? (
            <button
              type="button"
              onClick={handleRestore}
              className="w-full rounded-md px-3 py-2 text-left text-xs font-bold text-island-ink hover:bg-island-custard"
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
