import { showToast, Toast, Clipboard, getPreferenceValues } from "@raycast/api"
import { ensureServer, ServerNotRunningError, OpenCodeNotInstalledError } from "./server-manager"

interface Preferences {
  defaultProject?: string
  handoffMethod: "terminal" | "desktop"
  autoStartServer: boolean
}

export interface Session {
  id: string
  projectID: string
  directory: string
  title: string
  version: string
  time: {
    created: number
    updated: number
  }
  share?: {
    url: string
  }
}

export interface Agent {
  name: string
  description?: string
  mode: "primary" | "subagent" | "all"
  hidden?: boolean
}

export interface Command {
  name: string
  description?: string
}

export interface MessagePart {
  type: string
  id?: string
  text?: string
  [key: string]: unknown
}

export interface Message {
  info: {
    id: string
    sessionID: string
    role: "user" | "assistant"
  }
  parts: MessagePart[]
}

export interface HealthResponse {
  healthy: boolean
  version: string
}

export interface Model {
  id: string
  providerID: string
  name: string
}

export interface Provider {
  id: string
  name: string
  models: Record<string, Model>
}

export interface ProviderResponse {
  all: Provider[]
  default: {
    providerID: string
    modelID: string
  }
}

class OpenCodeClient {
  private baseUrl: string
  private directory?: string

  constructor(baseUrl: string, directory?: string) {
    this.baseUrl = baseUrl
    this.directory = directory
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | undefined>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)

    if (this.directory) {
      url.searchParams.set("directory", this.directory)
    }

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          url.searchParams.set(key, value)
        }
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(this.directory ? { "x-opencode-directory": this.directory } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    return response.json() as Promise<T>
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/global/health")
  }

  async listSessions(): Promise<Session[]> {
    return this.request<Session[]>("GET", "/session")
  }

  async createSession(title?: string): Promise<Session> {
    return this.request<Session>("POST", "/session", { title })
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>("GET", `/session/${sessionId}`)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.request<boolean>("DELETE", `/session/${sessionId}`)
  }

  async getSessionMessages(sessionId: string, limit?: number): Promise<Message[]> {
    return this.request<Message[]>("GET", `/session/${sessionId}/message`, undefined, {
      limit: limit?.toString(),
    })
  }

  async sendPrompt(
    sessionId: string,
    text: string,
    options: {
      agent?: string
      model: { providerID: string; modelID: string }
    }
  ): Promise<Message> {
    return this.request<Message>("POST", `/session/${sessionId}/message`, {
      parts: [{ type: "text", text }],
      agent: options.agent,
      model: options.model,
    })
  }

  async abortSession(sessionId: string): Promise<boolean> {
    return this.request<boolean>("POST", `/session/${sessionId}/abort`)
  }

  async listAgents(): Promise<Agent[]> {
    return this.request<Agent[]>("GET", "/agent")
  }

  async listCommands(): Promise<Command[]> {
    return this.request<Command[]>("GET", "/command")
  }

  async listProviders(): Promise<ProviderResponse> {
    return this.request<ProviderResponse>("GET", "/provider")
  }

  setDirectory(directory: string): void {
    this.directory = directory
  }
}

let clientInstance: OpenCodeClient | null = null
let serverUrl: string | null = null

export async function getClient(directory?: string): Promise<OpenCodeClient> {
  const preferences = getPreferenceValues<Preferences>()

  try {
    const server = await ensureServer(preferences.autoStartServer)
    serverUrl = server.url

    if (!clientInstance || directory) {
      const effectiveDir = directory || preferences.defaultProject
      clientInstance = new OpenCodeClient(server.url, effectiveDir)
    }

    return clientInstance
  } catch (error) {
    if (error instanceof ServerNotRunningError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "OpenCode server not running",
        message: "Run 'opencode serve' to start",
        primaryAction: {
          title: "Copy Command",
          onAction: () => Clipboard.copy("opencode serve"),
        },
      })
    } else if (error instanceof OpenCodeNotInstalledError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "OpenCode not installed",
        message: "Install from opencode.ai",
        primaryAction: {
          title: "Copy Install Command",
          onAction: () => Clipboard.copy("curl -fsSL https://opencode.ai/install | bash"),
        },
      })
    }
    throw error
  }
}

export function getServerUrl(): string | null {
  return serverUrl
}

export function resetClient(): void {
  clientInstance = null
}

export { OpenCodeClient }
