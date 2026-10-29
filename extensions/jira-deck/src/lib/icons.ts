import { Color, Icon, Image } from "@raycast/api";
import { getAvatarIcon } from "@raycast/utils";
import { Board, User } from "./issue";

// Jira's own colours for its standard issue types. Other types get a neutral icon.
const TYPE_ICONS: Record<string, Image.ImageLike> = {
  bug: { source: Icon.Bug, tintColor: Color.Red },
  story: { source: Icon.Bookmark, tintColor: Color.Green },
  task: { source: Icon.CheckCircle, tintColor: Color.Blue },
  subtask: { source: Icon.CheckCircle, tintColor: Color.Blue },
  "sub-task": { source: Icon.CheckCircle, tintColor: Color.Blue },
  epic: { source: Icon.Bolt, tintColor: Color.Purple },
};

export function typeIcon(type: string): Image.ImageLike {
  return TYPE_ICONS[type.toLowerCase()] ?? { source: Icon.Document, tintColor: Color.SecondaryText };
}

/** Initials on a colour picked from the name, so each person looks the same everywhere. */
export function userIcon(user?: User): Image.ImageLike {
  return user ? getAvatarIcon(user.displayName) : { source: Icon.PersonCircle, tintColor: Color.SecondaryText };
}

const BOARD_TYPES: Record<Board["type"], { label: string; icon: Icon }> = {
  scrum: { label: "Scrum", icon: Icon.ArrowClockwise },
  kanban: { label: "Kanban", icon: Icon.AppWindowGrid3x3 },
  simple: { label: "Team-managed", icon: Icon.AppWindowList },
};

export function boardIcon(board: Board): Image.ImageLike {
  return { source: BOARD_TYPES[board.type].icon, tintColor: Color.SecondaryText };
}

/** "ACME · Scrum". */
export function boardSubtitle(board: Board): string {
  return [board.spaceKey, BOARD_TYPES[board.type].label].filter(Boolean).join(" · ");
}
