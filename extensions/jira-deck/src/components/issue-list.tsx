import {
  Action,
  ActionPanel,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { ReactNode, useMemo, useState } from "react";
import { changeAssignee } from "../lib/assignee";
import { applyFilters, summarize } from "../lib/filters";
import { groupByStatus, Issue, IssueGroup, IssueScope, User } from "../lib/issue";
import { userIcon } from "../lib/icons";
import { SetupError } from "../lib/jira";
import { getMyself, sourceKey } from "../lib/source";
import { PRIORITY_FILTERS, PriorityLevel, priorityIcon, priorityLabel } from "../lib/priority";
import { CreateIssueDefaults, CreateIssueForm } from "./create-issue-form";
import { IssueActions } from "./issue-actions";
import { IssueDetail } from "./issue-detail";

interface Props {
  /** Keeps each command's filters separate. */
  id: string;
  load: () => Promise<IssueScope>;
  /** What `load` shows, like a board's ID. Part of the cache key. */
  loadKey?: string;
  /** Switch Board and friends, for board views. */
  boardActions?: (scope?: IssueScope) => ReactNode;
  createDefaults?: CreateIssueDefaults;
}

interface Section {
  key: string;
  title: string;
  subtitle: string;
  issues: Issue[];
}

/** A section per status, per group when the scope has groups, like "Sprint 8 · In Progress". */
function toSections(groups: IssueGroup[]): Section[] {
  return groups.flatMap((group, index) => {
    if (!group.issues.length) return [];
    if (!group.byStatus) {
      const count = String(group.issues.length);
      const subtitle = group.subtitle ? `${group.subtitle} · ${count}` : count;
      return [{ key: `${index}`, title: group.title ?? "Issues", subtitle, issues: group.issues }];
    }
    return groupByStatus(group.issues).map(({ status, issues }) => ({
      key: `${index}:${status.name}`,
      title: group.title ? `${group.title} · ${status.name}` : status.name,
      subtitle: String(issues.length),
      issues,
    }));
  });
}

export function IssueList({ id, load, loadKey = "", boardActions, createDefaults }: Props) {
  // Part of every cache key, so switching accounts never shows the other one's issues.
  const key = sourceKey();
  const {
    data: scope,
    error,
    isLoading,
    revalidate,
  } = useCachedPromise(
    (what: string, cacheKey: string) => {
      void what;
      void cacheKey;
      return load();
    },
    [loadKey, key],
    {
      // Shown in the empty view when there's nothing else to show, and as a toast over older results.
      onError(error) {
        if (scope) showToast({ style: Toast.Style.Failure, title: "Couldn't refresh", message: error.message });
      },
    },
  );
  const { data: me } = useCachedPromise(
    (cacheKey: string) => {
      void cacheKey;
      return getMyself();
    },
    [key],
    { onError: () => undefined },
  );
  const [people, setPeople] = useCachedState(`${id}:people`, "all");
  const [priority, setPriority] = useCachedState<PriorityLevel | undefined>(`${id}:priority`, undefined);

  // Selects an issue created from here once it's in the list.
  const [focusId, setFocusId] = useState<string>();

  async function assign(issue: Issue, user?: User) {
    if (await changeAssignee(issue, user)) revalidate();
  }

  const groups = useMemo(() => {
    if (!scope) return [];
    const filter = (issues: Issue[]) => applyFilters(issues, { people, priority }, me?.accountId ?? "");
    return (scope.groups ?? [{ issues: scope.issues, byStatus: true }]).map((group) => ({
      ...group,
      issues: filter(group.issues),
    }));
  }, [scope, people, priority, me]);
  const issues = useMemo(() => groups.flatMap((group) => group.issues), [groups]);

  // Everyone with an issue in this view, for the assignee dropdown.
  const assignees = useMemo(() => {
    const byId = new Map<string, User>();
    for (const issue of scope?.issues ?? []) if (issue.assignee) byId.set(issue.assignee.accountId, issue.assignee);
    return [...byId.values()]
      .filter((person) => person.accountId !== me?.accountId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [scope, me]);

  // Opened while filtered to one person, a new issue goes to them.
  const assigneeDefault = people === "me" ? me : assignees.find((person) => person.accountId === people);
  const createAction = (
    <Action.Push
      title="Create Issue"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={
        <CreateIssueForm
          defaults={{ ...createDefaults, board: scope?.board, sprint: scope?.sprint, assignee: assigneeDefault }}
          onCreated={(issue) => {
            setFocusId(issue.id);
            revalidate();
          }}
        />
      }
    />
  );

  const boardAction = boardActions?.(scope);

  const priorityTitle = PRIORITY_FILTERS.find((filter) => filter.level === priority)?.title;
  const title = [
    scope?.title,
    scope && !scope.notice ? summarize(issues, scope.complete) : undefined,
    priorityTitle ? `${priorityTitle} Priority` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={issues.length > 0}
      navigationTitle={title}
      selectedItemId={focusId}
      searchBarPlaceholder="Search by key or title"
      searchBarAccessory={
        <List.Dropdown tooltip="Assignee" value={people} onChange={setPeople}>
          <List.Dropdown.Item title="Everyone" value="all" icon={Icon.TwoPeople} />
          <List.Dropdown.Item title="Assigned to Me" value="me" icon={userIcon(me)} />
          <List.Dropdown.Item title="Unassigned" value="unassigned" icon={userIcon()} />
          <List.Dropdown.Section title="People">
            {assignees.map((person) => (
              <List.Dropdown.Item
                key={person.accountId}
                title={person.displayName}
                value={person.accountId}
                icon={userIcon(person)}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {error && !scope ? (
        <ErrorView error={error} onRetry={revalidate} />
      ) : (
        <List.EmptyView
          icon={Icon.Tray}
          title={scope?.notice ?? (scope?.issues.length ? "No Matching Issues" : "No Issues")}
          description={
            scope?.issues.length
              ? "Try another assignee or priority filter."
              : boardAction
                ? "Press ⌘B to switch boards, or ⌘⇧B to pin more."
                : undefined
          }
          actions={
            <ActionPanel>
              {createAction}
              {boardAction}
            </ActionPanel>
          }
        />
      )}
      {toSections(groups).map(({ key, title, subtitle, issues }) => (
        <List.Section key={key} title={title} subtitle={subtitle}>
          {issues.map((issue) => (
            <List.Item
              key={issue.id}
              id={issue.id}
              // Priority, title and assignee, like Linear. The key and type are in the panel, and search still finds the key.
              icon={{ value: priorityIcon(issue.priority), tooltip: `Priority: ${priorityLabel(issue.priority)}` }}
              title={{ value: issue.summary, tooltip: issue.summary }}
              keywords={[issue.key]}
              accessories={[
                {
                  icon: userIcon(issue.assignee),
                  tooltip: issue.assignee ? `Assignee: ${issue.assignee.displayName}` : "Unassigned",
                },
              ]}
              detail={<IssueDetail issue={issue} />}
              actions={
                <IssueActions
                  issue={issue}
                  createAction={createAction}
                  boardAction={boardAction}
                  me={me}
                  onAssign={(user) => assign(issue, user)}
                  priority={priority}
                  onPriorityChange={setPriority}
                  onRefresh={revalidate}
                />
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

function testConnection() {
  return launchCommand({ name: "test-connection", type: LaunchType.UserInitiated });
}

function ErrorView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const setup = error instanceof SetupError;
  return (
    <List.EmptyView
      icon={setup ? Icon.Key : Icon.Warning}
      title={setup ? "Connect to Jira" : "Couldn't Load Issues"}
      description={error.message}
      actions={
        <ActionPanel>
          {setup ? (
            <>
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              <Action title="Test Connection" icon={Icon.Plug} onAction={testConnection} />
              <Action.OpenInBrowser
                title="Create API Token"
                url="https://id.atlassian.com/manage-profile/security/api-tokens"
              />
            </>
          ) : (
            <>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={onRetry} />
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              <Action title="Test Connection" icon={Icon.Plug} onAction={testConnection} />
            </>
          )}
        </ActionPanel>
      }
    />
  );
}
