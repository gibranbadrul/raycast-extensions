/** Jira groups every workflow status into one of three categories. Status names themselves vary by tenant. */
export type StatusCategory = "todo" | "inProgress" | "done";

export interface User {
  accountId: string;
  displayName: string;
}

export interface Status {
  name: string;
  category: StatusCategory;
}

export interface Issue {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  status: Status;
  /** Missing when the space doesn't use priorities. */
  priority?: string;
  assignee?: User;
  reporter?: User;
  epic?: { key: string; summary: string };
  storyPoints?: number;
  created: string;
  updated: string;
  url: string;
}

export interface Space {
  id: string;
  key: string;
  name: string;
}

/** A view over issues, set by a filter. A space can have many, and sprints belong to boards. */
export interface Board {
  id: string;
  name: string;
  /** Kanban boards have no sprints. "simple" is a team-managed board, which can have them. */
  type: "scrum" | "kanban" | "simple";
  /** Missing when the board shows issues from several spaces. */
  spaceKey?: string;
  spaceName?: string;
}

/** How much the user has done in a space lately, for suggesting its boards. */
export interface SpaceActivity {
  spaceKey: string;
  /** Recent issues the user is assignee, reporter or watcher of. 0 when the space was only viewed. */
  issues: number;
}

export interface Sprint {
  id: string;
  name: string;
}

/** A sprint new issues can go into, from the space's board. */
export interface SprintChoice extends Sprint {
  state: "active" | "future";
  startDate?: string;
  endDate?: string;
}

/** An issue that can be a new issue's parent: an epic for a story, a story for a sub-task. */
export interface ParentChoice {
  key: string;
  summary: string;
  issueType: string;
}

/** An issue type or priority, as Jira's create metadata lists it. */
export interface Choice {
  id: string;
  name: string;
}

/** Jira's hierarchy: -1 for sub-tasks, 0 for stories, tasks and bugs, 1 for epics, and higher above. */
export interface IssueTypeChoice extends Choice {
  level: number;
}

/** What a new issue of one type can be set to. */
export interface TypeFields {
  /** Missing when the type has no priority field. */
  priorities?: Choice[];
  defaultPriorityId?: string;
  /** Required fields the form doesn't have, so the issue has to be finished in Jira. */
  missingRequired: string[];
  /** Fields the form offers only when the type's create screen has them. */
  hasParent: boolean;
  hasLabels: boolean;
  hasDueDate: boolean;
}

export interface NewIssue {
  spaceId: string;
  spaceKey: string;
  issueTypeId: string;
  summary: string;
  /** Markdown as typed. */
  description?: string;
  priorityId?: string;
  assigneeId?: string;
  /** Adds the issue to this sprint instead of the backlog. */
  sprint?: Sprint;
  parentKey?: string;
  labels?: string[];
  /** YYYY-MM-DD. */
  dueDate?: string;
}

/** The issue was created, and sometimes a later step, like adding it to the sprint, failed. */
export interface Created {
  issue: Issue;
  warning?: string;
}

/** Jira refused some fields. Keys are `NewIssue` fields, values are Jira's messages. */
export class FieldErrors extends Error {
  constructor(
    readonly fields: Partial<Record<keyof NewIssue, string>>,
    message?: string,
  ) {
    super(message ?? Object.values(fields)[0] ?? "Jira refused the issue");
  }
}

/** Issues shown together, like one sprint of several. `byStatus` splits them into a section per status. */
export interface IssueGroup {
  title?: string;
  subtitle?: string;
  issues: Issue[];
  byStatus: boolean;
}

/** The issues of one view, and where they came from. */
export interface IssueScope {
  title: string;
  issues: Issue[];
  /** False when only some pages were loaded, so counts must say "loaded". */
  complete: boolean;
  /** For board views. */
  board?: Board;
  /** The sprint new issues can go into. */
  sprint?: Sprint;
  /** Set when the issues are shown in groups. Otherwise there's one section per status. */
  groups?: IssueGroup[];
  /** Why the view is empty when that's expected, like a Kanban board without a backlog. */
  notice?: string;
}

const CATEGORY_ORDER: Record<StatusCategory, number> = { inProgress: 0, todo: 1, done: 2 };

/** Groups by status, with work in progress first and done last. Statuses keep the order they first appear in. */
export function groupByStatus(issues: Issue[]): { status: Status; issues: Issue[] }[] {
  const groups = new Map<string, { status: Status; issues: Issue[] }>();
  for (const issue of issues) {
    const group = groups.get(issue.status.name);
    if (group) group.issues.push(issue);
    else groups.set(issue.status.name, { status: issue.status, issues: [issue] });
  }
  return [...groups.values()].sort((a, b) => CATEGORY_ORDER[a.status.category] - CATEGORY_ORDER[b.status.category]);
}
