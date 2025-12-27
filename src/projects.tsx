import { List, ActionPanel, Action, Icon, showToast, Toast, Keyboard, confirmAlert, Alert } from "@raycast/api"
import { useProjects } from "./hooks/useProjects"
import { homedir } from "os"

export default function Command() {
  const { projects, isLoading, addProject, removeProject, clearProjects } = useProjects()

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  async function handleRemove(path: string, name: string) {
    await removeProject(path)
    await showToast({
      style: Toast.Style.Success,
      title: `Removed ${name}`,
    })
  }

  async function handleClearAll() {
    const confirmed = await confirmAlert({
      title: "Clear All Projects?",
      message: "This will remove all recent projects from the list",
      primaryAction: { title: "Clear", style: Alert.ActionStyle.Destructive },
    })

    if (!confirmed) return

    await clearProjects()
    await showToast({
      style: Toast.Style.Success,
      title: "Cleared all projects",
    })
  }

  async function handleAddProject() {
    await showToast({
      style: Toast.Style.Animated,
      title: "Use @path in Ask OpenCode",
      message: "Projects are added when you use @path",
    })
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search projects...">
      {projects.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No recent projects"
          description="Use @path in Ask OpenCode to add projects"
          icon={Icon.Folder}
          actions={
            <ActionPanel>
              <Action title="How to Add Projects" icon={Icon.QuestionMark} onAction={handleAddProject} />
            </ActionPanel>
          }
        />
      ) : (
        <>
          <List.Section title="Recent Projects" subtitle={`${projects.length} projects`}>
            {projects.map((project) => (
              <List.Item
                key={project.path}
                title={project.name}
                subtitle={project.path.replace(homedir(), "~")}
                icon={Icon.Folder}
                accessories={[{ text: formatDate(project.lastUsed), tooltip: "Last used" }]}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section title="Actions">
                      <Action.CopyToClipboard
                        title="Copy Path"
                        content={project.path}
                        shortcut={Keyboard.Shortcut.Common.Copy}
                      />
                      <Action.Open
                        title="Open in Finder"
                        target={project.path}
                        shortcut={Keyboard.Shortcut.Common.Open}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section title="Manage">
                      <Action
                        title="Remove from List"
                        icon={Icon.Trash}
                        style={Action.Style.Destructive}
                        shortcut={Keyboard.Shortcut.Common.Remove}
                        onAction={() => handleRemove(project.path, project.name)}
                      />
                      {projects.length > 1 && (
                        <Action
                          title="Clear All Projects"
                          icon={Icon.Trash}
                          style={Action.Style.Destructive}
                          onAction={handleClearAll}
                        />
                      )}
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        </>
      )}
    </List>
  )
}
