import { Color, List } from "@raycast/api";
import { typeIcon, userIcon } from "../lib/icons";
import { Issue } from "../lib/issue";
import { priorityIcon, priorityLabel } from "../lib/priority";

const STATUS_COLORS = { todo: Color.SecondaryText, inProgress: Color.Blue, done: Color.Green };

// Metadata only: with Markdown, Raycast gives it the top of the panel and pushes the metadata down.
// The title is on the list row already.
export function IssueDetail({ issue }: { issue: Issue }) {
  const updated = new Date(issue.updated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <List.Item.Detail
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Link title="Issue" text={issue.key} target={issue.url} />
          <List.Item.Detail.Metadata.TagList title="Status">
            <List.Item.Detail.Metadata.TagList.Item
              text={issue.status.name}
              color={STATUS_COLORS[issue.status.category]}
            />
          </List.Item.Detail.Metadata.TagList>
          <List.Item.Detail.Metadata.Label
            title="Priority"
            text={priorityLabel(issue.priority)}
            icon={priorityIcon(issue.priority)}
          />
          <List.Item.Detail.Metadata.Label
            title="Assignee"
            text={issue.assignee?.displayName ?? "Unassigned"}
            icon={userIcon(issue.assignee)}
          />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Type" text={issue.issueType} icon={typeIcon(issue.issueType)} />
          {issue.epic && (
            <List.Item.Detail.Metadata.Label title="Epic" text={`${issue.epic.key} ${issue.epic.summary}`} />
          )}
          {issue.storyPoints !== undefined && (
            <List.Item.Detail.Metadata.Label title="Story Points" text={String(issue.storyPoints)} />
          )}
          <List.Item.Detail.Metadata.Separator />
          {issue.reporter && (
            <List.Item.Detail.Metadata.Label
              title="Reporter"
              text={issue.reporter.displayName}
              icon={userIcon(issue.reporter)}
            />
          )}
          <List.Item.Detail.Metadata.Label title="Updated" text={updated} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}
