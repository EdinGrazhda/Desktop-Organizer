export type SlotItem = {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder" | "program" | "shortcut";
  extension?: string;
  pinned?: boolean;
  useCount?: number;
  lastOpenedAt?: string;
  addedAt: string;
};

export type Slot = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  items: SlotItem[];
  createdAt: string;
  updatedAt: string;
};
