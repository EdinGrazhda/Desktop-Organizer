import {
  AirplaneTilt,
  Archive,
  Books,
  BracketsCurly,
  Briefcase,
  FileText,
  FilmSlate,
  Flask,
  FolderSimple,
  GameController,
  GraduationCap,
  House,
  ImageSquare,
  Lightbulb,
  LightningA,
  MusicNotesSimple,
  PaintBrush,
  Package,
  Sparkle,
  Toolbox,
  TrayArrowDown,
  type IconProps,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { normalizeSlotIcon, type SlotIconKey } from "../utils/icons";

interface SlotIconProps {
  icon: string;
  className?: string;
  strokeWidth?: number;
}

const SLOT_ICON_COMPONENTS: Record<SlotIconKey, ComponentType<IconProps>> = {
  games: GameController,
  documents: FileText,
  coding: BracketsCurly,
  work: Briefcase,
  images: ImageSquare,
  videos: FilmSlate,
  school: GraduationCap,
  downloads: TrayArrowDown,
  music: MusicNotesSimple,
  archive: Package,
  folder: FolderSimple,
  science: Flask,
  home: House,
  travel: AirplaneTilt,
  design: PaintBrush,
  library: Books,
  energy: LightningA,
  tools: Toolbox,
  idea: Lightbulb,
  spark: Sparkle,
};

const SLOT_ICON_ROTATION: Record<SlotIconKey, string> = {
  games: "rotate-[-3deg]",
  documents: "rotate-0",
  coding: "rotate-[2deg]",
  work: "rotate-[-2deg]",
  images: "rotate-[1deg]",
  videos: "rotate-[-1deg]",
  school: "rotate-[2deg]",
  downloads: "rotate-0",
  music: "rotate-[-3deg]",
  archive: "rotate-[1deg]",
  folder: "rotate-0",
  science: "rotate-[2deg]",
  home: "rotate-[-1deg]",
  travel: "rotate-[3deg]",
  design: "rotate-[-2deg]",
  library: "rotate-[1deg]",
  energy: "rotate-[-3deg]",
  tools: "rotate-[2deg]",
  idea: "rotate-[-2deg]",
  spark: "rotate-[3deg]",
};

export function SlotIcon({
  icon,
  className = "w-5 h-5",
  strokeWidth = 1.9,
}: SlotIconProps) {
  const key = normalizeSlotIcon(icon);
  const Icon: ComponentType<IconProps> = SLOT_ICON_COMPONENTS[key] ?? Archive;
  const rotation = SLOT_ICON_ROTATION[key] ?? "rotate-0";

  return (
    <span className={`relative inline-flex ${rotation}`}>
      <Icon className={className} weight="duotone" />
      {strokeWidth >= 2 && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/35" />
      )}
    </span>
  );
}
