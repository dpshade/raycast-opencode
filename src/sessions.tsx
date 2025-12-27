import { List, ActionPanel, Action, Icon, showToast, Toast, getPreferenceValues, confirmAlert, Keyboard, Alert } from "@raycast/api"
import { useState, useEffect } from "react"
import { getClient, Session } from "./lib/opencode"
import { handoffToOpenCode, copySessionCommand } from "./lib/handoff"
import { useSessionSearch } from "./hooks/useSessionSearch"
import { homedir } from "os"

import { TerminalApp } from "./lib/handoff"

interface Preferences {
  handoffMethod: "terminal" | "desktop"
  terminalApp: TerminalApp
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const {
    searchText,
    setSearchText,
    filteredSessions,
    isIndexing,
  } = useSessionSearch(sessions)

  async function loadSessions() {
    setIsLoading(true)
    try {
      const client = await getClient()
      const sessionList = await client.listSessions()
      setSessions(sessionList.sort((a, b) => b.time.updated - a.time.updated))
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  async function handleDelete(session: Session) {
    const confirmed = await confirmAlert({
      title: "Delete Session?",
      message: `This will permanently delete "${session.title}"`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    })

    if (!confirmed) return

    try {
      const client = await getClient()
      await client.deleteSession(session.id)
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
      await showToast({
        style: Toast.Style.Success,
        title: "Session deleted",
      })
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete session",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  async function handleHandoff(session: Session) {
    await handoffToOpenCode(session.id, preferences.handoffMethod, session.directory, preferences.terminalApp)
  }

  async function handleCopyCommand(session: Session) {
    await copySessionCommand(session.id, session.directory)
  }

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

  return (
    <List
      isLoading={isLoading || isIndexing}
      searchBarPlaceholder="Search sessions..."
      filtering={false}
      onSearchTextChange={setSearchText}
      searchText={searchText}
    >
      {filteredSessions.length === 0 && !isLoading ? (
        <List.EmptyView
          title={searchText ? "No matching sessions" : "No sessions yet"}
          description={searchText ? "Try a different search term" : "Start a conversation with Ask OpenCode"}
          icon={Icon.Message}
        />
      ) : (
        filteredSessions.map((session) => (
          <List.Item
            key={session.id}
            title={session.title || "Untitled Session"}
            subtitle={session.directory?.replace(homedir(), "~")}
            icon={Icon.Message}
            accessories={[
              { text: formatDate(session.time.updated), tooltip: "Last updated" },
              ...(session.share ? [{ icon: Icon.Link, tooltip: "Shared" }] : []),
            ]}
            actions={
              <ActionPanel>
                <ActionPanel.Section title="Open">
                  <Action
                    title="Continue in OpenCode"
                    icon={Icon.Terminal}
                    shortcut={Keyboard.Shortcut.Common.Open}
                    onAction={() => handleHandoff(session)}
                  />
                  <Action
                    title="Copy Session Command"
                    icon={Icon.Clipboard}
                    shortcut={Keyboard.Shortcut.Common.Copy}
                    onAction={() => handleCopyCommand(session)}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section title="Manage">
                  <Action
                    title="Refresh"
                    icon={Icon.ArrowClockwise}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                    onAction={loadSessions}
                  />
                  <Action
                    title="Delete Session"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={Keyboard.Shortcut.Common.Remove}
                    onAction={() => handleDelete(session)}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  )
}
