import {
  List,
  ActionPanel,
  Action,
  Detail,
  Icon,
  showToast,
  Toast,
  getPreferenceValues,
  LaunchProps,
  Keyboard,
  showHUD,
  popToRoot,
  Clipboard,
  Color,
} from "@raycast/api"
import { useState } from "react"
import { useOpenCode } from "./hooks/useOpenCode"
import { useProviders } from "./hooks/useProviders"
import { useProjects } from "./hooks/useProjects"
import { usePathAutocomplete, extractPathFromQuery } from "./hooks/usePathAutocomplete"
import { handoffToOpenCode, copySessionCommand } from "./lib/handoff"
import { homedir } from "os"

import { TerminalApp } from "./lib/handoff"

interface Preferences {
  defaultProject?: string
  handoffMethod: "terminal" | "desktop"
  terminalApp: TerminalApp
}

interface Arguments {
  question?: string
}

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const preferences = getPreferenceValues<Preferences>()
  const initialQuestion = props.arguments?.question || ""

  const [searchText, setSearchText] = useState(initialQuestion)
  const [response, setResponse] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<{ providerID: string; modelID: string } | null>(null)
  const [activeDirectory, setActiveDirectory] = useState<string | undefined>(preferences.defaultProject)

  const { providers, favorites, recentModels, defaultModel, isLoading: modelsLoading } = useProviders()
  const activeModel = selectedModel || defaultModel
  const [streamingText, setStreamingText] = useState<string | null>(null)

  const { isConnected, isLoading, agents, commands, currentSession, sendPrompt, setWorkingDirectory } =
    useOpenCode(activeDirectory)

  const { projects, addProject } = useProjects()
  const { suggestions: pathSuggestions, isActive: showingPathSuggestions } = usePathAutocomplete(searchText)

  const showingAgentPicker =
    searchText.startsWith("@") &&
    !searchText.includes("/") &&
    !searchText.includes("~") &&
    !searchText.includes(".") &&
    !searchText.includes(" ")

  const agentFilter = showingAgentPicker ? searchText.slice(1).toLowerCase() : ""
  const filteredAgents = showingAgentPicker
    ? agents.filter((a) => a.name.toLowerCase().includes(agentFilter) || a.name.toLowerCase().startsWith(agentFilter))
    : []

  const showingSlashCommands = searchText.startsWith("/") && !searchText.includes(" ")
  const slashFilter = showingSlashCommands ? searchText.slice(1).toLowerCase() : ""
  const filteredSlashCommands = showingSlashCommands
    ? commands.filter(
        (c) => c.name.toLowerCase().includes(slashFilter) || c.name.toLowerCase().startsWith(slashFilter)
      )
    : []

  async function handleSubmit() {
    const { cleanQuery, directory } = extractPathFromQuery(searchText)
    if (!cleanQuery.trim()) return

    if (directory && directory !== activeDirectory) {
      setActiveDirectory(directory)
      setWorkingDirectory(directory)
      await addProject(directory)
    }

    if (!activeModel) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Model not selected",
        message: "Please wait for models to load or check if OpenCode server is running",
      })
      return
    }

    setIsProcessing(true)
    setStreamingText("Thinking...")
    
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Asking ${activeModel.modelID}...`,
      message: "You can close Raycast - response will be ready when you return",
    })
    
    try {
      const result = await sendPrompt(cleanQuery, {
        agent: selectedAgent || undefined,
        model: activeModel!,
      })
      setResponse(result)
      setStreamingText(null)
      toast.style = Toast.Style.Success
      toast.title = "Response ready"
      toast.message = undefined
    } catch (error) {
      setStreamingText(null)
      toast.style = Toast.Style.Failure
      toast.title = "Failed to get response"
      toast.message = error instanceof Error ? error.message : "Unknown error"
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleSlashCommand(commandName: string) {
    if (commandName === "clear") {
      setResponse(null)
      setSearchText("")
      setSelectedAgent(null)
      await showToast({ title: "Conversation cleared" })
    } else if (commandName === "compact") {
      setResponse(null)
      setSearchText("")
      await showToast({ title: "Context compacted" })
    } else if (commandName === "share") {
      if (currentSession?.share?.url) {
        await Clipboard.copy(currentSession.share.url)
        await showToast({ title: "Share URL copied to clipboard" })
      } else {
        await showToast({ title: "No share URL available", style: Toast.Style.Failure })
      }
    } else {
      setSearchText(`/${commandName} `)
      await showToast({ title: `Using /${commandName}`, message: "Type your message and press Enter" })
    }
  }

  function handleSelectAgent(agentName: string) {
    setSelectedAgent(agentName)
    setSearchText("")
    showToast({
      style: Toast.Style.Success,
      title: `Using @${agentName}`,
    })
  }

  function handleSelectPath(suggestion: { path: string; displayPath: string; type: "directory" | "file" }) {
    const currentQuery = searchText.replace(/@[\w\/~.-]*$/, "")
    setSearchText(`${currentQuery}@${suggestion.displayPath} `)
    
    if (suggestion.type === "directory") {
      setActiveDirectory(suggestion.path)
      setWorkingDirectory(suggestion.path)
      addProject(suggestion.path)
    }
  }

  async function handleHandoff() {
    if (!currentSession) return
    await handoffToOpenCode(currentSession.id, preferences.handoffMethod, activeDirectory, preferences.terminalApp)
  }

  async function handleCopyCommand() {
    if (!currentSession) return
    await copySessionCommand(currentSession.id, activeDirectory)
  }

  function handleNewQuestion() {
    setResponse(null)
    setSearchText("")
    setSelectedAgent(null)
  }

  if (response) {
    return (
      <Detail
        markdown={response}
        navigationTitle={currentSession?.title || "OpenCode Response"}
        metadata={
          <Detail.Metadata>
            {activeDirectory && <Detail.Metadata.Label title="Directory" text={activeDirectory.replace(homedir(), "~")} />}
            {selectedAgent && <Detail.Metadata.Label title="Agent" text={selectedAgent} />}
            {activeModel && <Detail.Metadata.Label title="Model" text={activeModel.modelID} />}
            {currentSession && <Detail.Metadata.Label title="Session" text={currentSession.id.slice(0, 8)} />}
          </Detail.Metadata>
        }
        actions={
          <ActionPanel>
            <ActionPanel.Section title="Actions">
              <Action
                title="Continue in OpenCode"
                icon={Icon.Terminal}
                shortcut={Keyboard.Shortcut.Common.Open}
                onAction={handleHandoff}
              />
              <Action.CopyToClipboard
                title="Copy Response"
                content={response}
                shortcut={Keyboard.Shortcut.Common.Copy}
              />
              <Action
                title="Copy Session Command"
                icon={Icon.Clipboard}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                onAction={handleCopyCommand}
              />
            </ActionPanel.Section>
            <ActionPanel.Section title="Navigation">
              <Action
                title="New Question"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                onAction={handleNewQuestion}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    )
  }

  // Build context accessories for the header
  const contextAccessories: List.Item.Accessory[] = []
  if (selectedAgent) {
    contextAccessories.push({ tag: { value: `@${selectedAgent}`, color: Color.Blue }, tooltip: "Selected Agent" })
  }
  if (activeModel) {
    contextAccessories.push({ tag: { value: activeModel.modelID, color: Color.Purple }, tooltip: "Selected Model" })
  }
  if (activeDirectory) {
    contextAccessories.push({ text: activeDirectory.replace(homedir(), "~"), tooltip: "Working Directory" })
  }

  return (
    <List
      isLoading={isLoading || isProcessing || modelsLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Ask anything... (@ for agents/paths, / for commands)"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Select Model"
          value={activeModel ? `${activeModel.providerID}/${activeModel.modelID}` : ""}
          onChange={(value) => {
            const [providerID, ...modelParts] = value.split("/")
            const modelID = modelParts.join("/")
            setSelectedModel({ providerID, modelID })
          }}
        >
          {favorites.length > 0 && (
            <List.Dropdown.Section title="Favorites">
              {favorites.map((fav) => (
                <List.Dropdown.Item
                  key={`fav-${fav.providerID}-${fav.modelID}`}
                  title={fav.modelName}
                  value={`${fav.providerID}/${fav.modelID}`}
                  icon={Icon.Star}
                />
              ))}
            </List.Dropdown.Section>
          )}
          {recentModels.length > 0 && (
            <List.Dropdown.Section title="Recent">
              {recentModels
                .filter((r) => !favorites.some((f) => f.providerID === r.providerID && f.modelID === r.modelID))
                .slice(0, 5)
                .map((recent) => (
                  <List.Dropdown.Item
                    key={`recent-${recent.providerID}-${recent.modelID}`}
                    title={recent.modelName}
                    value={`${recent.providerID}/${recent.modelID}`}
                    icon={Icon.Clock}
                  />
                ))}
            </List.Dropdown.Section>
          )}
          {providers.map((provider) => (
            <List.Dropdown.Section key={provider.id} title={provider.name}>
              {Object.values(provider.models).map((model) => (
                <List.Dropdown.Item
                  key={model.id}
                  title={model.name}
                  value={`${provider.id}/${model.id}`}
                />
              ))}
            </List.Dropdown.Section>
          ))}
        </List.Dropdown>
      }
      filtering={false}
      throttle
    >
      {!isConnected && !isLoading ? (
        <List.EmptyView
          title="Not connected to OpenCode"
          description="Make sure OpenCode server is running"
          icon={Icon.ExclamationMark}
        />
      ) : showingAgentPicker && filteredAgents.length > 0 ? (
        <List.Section title="Select Agent" subtitle={`${filteredAgents.length} agents`}>
          {filteredAgents.map((agent) => (
            <List.Item
              key={agent.name}
              title={agent.name}
              subtitle={agent.description || undefined}
              accessories={[{ text: agent.mode, icon: Icon.Circle }]}
              icon={Icon.Person}
              actions={
                <ActionPanel>
                  <Action title="Select Agent" onAction={() => handleSelectAgent(agent.name)} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : showingSlashCommands && filteredSlashCommands.length > 0 ? (
        <List.Section title="Commands" subtitle={`${filteredSlashCommands.length} commands`}>
          {filteredSlashCommands.map((command) => (
            <List.Item
              key={command.name}
              title={`/${command.name}`}
              subtitle={command.description || undefined}
              icon={Icon.Terminal}
              actions={
                <ActionPanel>
                  <Action title="Use Command" onAction={() => handleSlashCommand(command.name)} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : showingPathSuggestions && pathSuggestions.length > 0 ? (
        <List.Section title="Select Path" subtitle="Files and directories">
          {pathSuggestions.map((suggestion) => (
            <List.Item
              key={suggestion.path}
              title={suggestion.name}
              subtitle={suggestion.displayPath}
              icon={suggestion.type === "directory" ? Icon.Folder : Icon.Document}
              accessories={[{ text: suggestion.type }]}
              actions={
                <ActionPanel>
                  <Action title="Select Path" onAction={() => handleSelectPath(suggestion)} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : (
        <>
          {/* Context Bar - Always visible when agent/directory is selected */}
          {(selectedAgent || activeDirectory) && (
            <List.Section title="Current Context">
              <List.Item
                title={selectedAgent ? `@${selectedAgent}` : "Default Agent"}
                subtitle={activeDirectory ? activeDirectory.replace(homedir(), "~") : "No directory"}
                icon={selectedAgent ? Icon.Person : Icon.Circle}
                accessories={[
                  ...(activeModel ? [{ tag: { value: activeModel.modelID, color: Color.Purple } }] : []),
                ]}
                actions={
                  <ActionPanel>
                    {selectedAgent && (
                      <Action
                        title="Clear Agent"
                        icon={Icon.XMarkCircle}
                        onAction={() => setSelectedAgent(null)}
                      />
                    )}
                    <Action
                      title="Change Agent"
                      icon={Icon.Person}
                      shortcut={{ modifiers: ["cmd"], key: "@" }}
                      onAction={() => setSearchText("@")}
                    />
                    <Action
                      title="Change Directory"
                      icon={Icon.Folder}
                      onAction={() => setSearchText("@~/")}
                    />
                  </ActionPanel>
                }
              />
            </List.Section>
          )}

          {searchText.trim() && (
            <List.Section title="Ask OpenCode">
              <List.Item
                title={searchText}
                subtitle="Press Enter to submit"
                icon={Icon.QuestionMark}
                accessories={contextAccessories}
                actions={
                  <ActionPanel>
                    <Action title="Submit" icon={Icon.ArrowRight} onAction={handleSubmit} />
                    <Action
                      title="Submit and Close"
                      icon={Icon.Clock}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
                      onAction={async () => {
                        handleSubmit()
                        await showHUD("Processing... Open Raycast again to see response")
                        await popToRoot()
                      }}
                    />
                    {selectedAgent && (
                      <Action
                        title="Clear Agent"
                        icon={Icon.XMarkCircle}
                        onAction={() => setSelectedAgent(null)}
                      />
                    )}
                  </ActionPanel>
                }
              />
            </List.Section>
          )}

          {projects.length > 0 && (
            <List.Section title="Recent Projects" subtitle="Use @path to switch">
              {projects.slice(0, 5).map((project) => (
                <List.Item
                  key={project.path}
                  title={project.name}
                  subtitle={project.path.replace(homedir(), "~")}
                  icon={Icon.Folder}
                  accessories={[
                    {
                      text: new Date(project.lastUsed).toLocaleDateString(),
                      tooltip: "Last used",
                    },
                  ]}
                  actions={
                    <ActionPanel>
                      <Action
                        title="Use This Project"
                        onAction={() => {
                          setActiveDirectory(project.path)
                          setWorkingDirectory(project.path)
                          showToast({
                            style: Toast.Style.Success,
                            title: `Switched to ${project.name}`,
                          })
                        }}
                      />
                    </ActionPanel>
                  }
                />
              ))}
            </List.Section>
          )}
        </>
      )}
    </List>
  )
}
