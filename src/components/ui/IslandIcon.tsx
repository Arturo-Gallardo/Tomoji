import {
  ArchiveIcon,
  ArmchairIcon,
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  ChatCenteredTextIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  CrownIcon,
  DotsSixVerticalIcon,
  DotsThreeIcon,
  FolderIcon,
  GaugeIcon,
  GearSixIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PersonSimpleWalkIcon,
  PlusIcon,
  SmileyIcon,
  SnowflakeIcon,
  SpeakerXIcon,
  StarFourIcon,
  TrashIcon,
  UserCircleIcon,
  XIcon,
  type Icon,
  type IconProps,
} from "@phosphor-icons/react";

export type IslandIconName =
  | "archive"
  | "back"
  | "background"
  | "check"
  | "close"
  | "crown"
  | "dashboard"
  | "dialogue"
  | "drag"
  | "duplicate"
  | "edit"
  | "folder"
  | "freeze"
  | "more"
  | "mute"
  | "plus"
  | "profile"
  | "refresh"
  | "restore"
  | "search"
  | "settings"
  | "sit"
  | "sparkles"
  | "tomoji"
  | "trash"
  | "turn"
  | "walk";

interface IslandIconProps extends IconProps {
  name: IslandIconName;
  title?: string;
}

const ICONS: Record<IslandIconName, Icon> = {
  archive: ArchiveIcon,
  back: ArrowLeftIcon,
  background: ImageIcon,
  check: CheckIcon,
  close: XIcon,
  crown: CrownIcon,
  dashboard: GaugeIcon,
  dialogue: ChatCenteredTextIcon,
  drag: DotsSixVerticalIcon,
  duplicate: CopyIcon,
  edit: PencilSimpleIcon,
  folder: FolderIcon,
  freeze: SnowflakeIcon,
  more: DotsThreeIcon,
  mute: SpeakerXIcon,
  plus: PlusIcon,
  profile: UserCircleIcon,
  refresh: ArrowClockwiseIcon,
  restore: ClockCounterClockwiseIcon,
  search: MagnifyingGlassIcon,
  settings: GearSixIcon,
  sit: ArmchairIcon,
  sparkles: StarFourIcon,
  tomoji: SmileyIcon,
  trash: TrashIcon,
  turn: ArrowsClockwiseIcon,
  walk: PersonSimpleWalkIcon,
};

export function IslandIcon({ name, title, className, ...props }: IslandIconProps) {
  const IconComponent = ICONS[name];

  return (
    <IconComponent
      className={className ?? "h-5 w-5"}
      weight="bold"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
    </IconComponent>
  );
}
