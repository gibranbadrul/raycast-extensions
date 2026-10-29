import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { getMyself } from "./jira-data";
import { Board } from "./issue";
import { jira, JiraError, myIssuesJql, routeInUse, SetupError, siteOrigin } from "./jira";
import { sourceKey } from "./source";

// The steps Test Connection runs, in order. Each one needs the one before it to pass.

export type CheckStatus = "waiting" | "running" | "passed" | "warning" | "failed" | "skipped";

/** Works, but something optional is off. The next steps still run. */
export class CheckWarning extends Error {}

export interface CheckResult {
  status: CheckStatus;
  /** What was found, or why it failed. */
  detail?: string;
  /** Set when the fix is in the extension's preferences. */
  setup?: boolean;
}

export interface Check {
  id: "site" | "account" | "issues" | "boards" | "columns";
  title: string;
  run: () => Promise<string>;
}

export const CHECKS: Check[] = [
  {
    id: "site",
    title: "Jira Site",
    async run() {
      const origin = siteOrigin();
      const { email, apiToken } = getPreferenceValues<Preferences>();
      if (!origin) throw new SetupError("Add your Jira site, like your-team.atlassian.net.");
      if (!email?.trim() || !apiToken?.trim()) throw new SetupError("Add your email and API token.");
      return new URL(origin).host;
    },
  },
  {
    id: "account",
    title: "Email and API Token",
    async run() {
      const me = await getMyself();
      // The account ID is what My Issues searches by, so it's shown to compare with the one in Jira.
      return `Signed in as ${me.displayName} (account ID ${me.accountId || "missing"})`;
    },
  },
  {
    id: "issues",
    title: "Your Issues",
    async run() {
      // The same search as My Issues, so an empty list there can be told apart from a filter.
      const jql = myIssuesJql((await getMyself()).accountId);
      const page = await jira<{ issues: unknown[]; nextPageToken?: string }>("/rest/api/3/search/jql", {
        method: "POST",
        body: { jql, fields: ["summary"], maxResults: 50 },
      });
      const route = `via ${routeInUse()}`;
      if (page.issues.length) {
        const count = `${page.issues.length}${page.nextPageToken ? "+" : ""}`;
        return `${count} open ${page.issues.length === 1 ? "issue" : "issues"} assigned to you (${route})`;
      }
      // Asks the pinned boards the same question through the Agile API, to tell a search problem from no issues.
      const onBoards = await countOnPinnedBoards(jql.replace(/ ORDER BY .*$/, ""));
      return `Search found no open issues assigned to you (${route}). ${onBoards}`;
    },
  },
  {
    id: "boards",
    title: "Boards",
    async run() {
      try {
        const page = await jira<{ total?: number }>("/rest/agile/1.0/board", { query: { maxResults: 1 } });
        const total = page.total ?? 0;
        if (total === 0) return "No boards yet. Board and Backlog need one.";
        return `${total} ${total === 1 ? "board" : "boards"} you can see`;
      } catch (error) {
        // Sites without Jira Software have no Agile API.
        if (error instanceof JiraError && (error.status === 403 || error.status === 404)) {
          throw new JiraError("Boards need Jira Software. My Issues and Create Issue still work.", error.status);
        }
        throw error;
      }
    },
  },
  {
    id: "columns",
    title: "Board Columns",
    async run() {
      const board = (await pinnedBoards())[0];
      if (!board) return "Pin a board to check it.";
      try {
        const config = await jira<{ columnConfig?: { columns?: unknown[] } }>(
          `/rest/agile/1.0/board/${encodeURIComponent(board.id)}/configuration`,
        );
        const count = config.columnConfig?.columns?.length ?? 0;
        return `${board.name} shows its ${count} ${count === 1 ? "column" : "columns"}`;
      } catch (error) {
        if (error instanceof SetupError || (error instanceof JiraError && (error.status ?? 0) < 500)) {
          throw new CheckWarning(
            "Can't read board columns, so boards are grouped by status. A token with scopes needs read:board-scope.admin:jira-software.",
          );
        }
        throw error;
      }
    },
  },
];

async function pinnedBoards(): Promise<Board[]> {
  try {
    return JSON.parse((await LocalStorage.getItem<string>(`pinned-boards:${sourceKey()}`)) ?? "[]");
  } catch {
    return [];
  }
}

async function countOnPinnedBoards(jql: string): Promise<string> {
  const boards = await pinnedBoards();
  if (!boards.length) return "Pin a board to compare with it.";

  const counts = await Promise.all(
    boards.slice(0, 5).map(async (board) => {
      try {
        const page = await jira<{ total?: number }>(`/rest/agile/1.0/board/${encodeURIComponent(board.id)}/issue`, {
          query: { jql, maxResults: 1, fields: "summary" },
        });
        return `${board.name}: ${page.total ?? 0}`;
      } catch (error) {
        return `${board.name}: ${error instanceof Error ? error.message : "failed"}`;
      }
    }),
  );
  return `Your pinned boards say ${counts.join(", ")}.`;
}

export function toResult(error: unknown): CheckResult {
  return {
    status: error instanceof CheckWarning ? "warning" : "failed",
    detail: error instanceof Error ? error.message : String(error),
    setup: error instanceof SetupError,
  };
}
