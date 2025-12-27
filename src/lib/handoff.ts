import { showHUD, Clipboard, showToast, Toast } from "@raycast/api"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export type TerminalApp = "default" | "ghostty" | "iterm" | "warp" | "alacritty" | "kitty" | "terminal" | "hyper"

interface TerminalConfig {
  name: string
  openCommand: (dir: string, cmd: string) => string
}

function escapeForShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

const TERMINAL_CONFIGS: Record<TerminalApp, TerminalConfig> = {
  default: {
    name: "Default Terminal",
    openCommand: (dir, cmd) => {
      const escaped = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script "${escaped}"'`
    },
  },
  terminal: {
    name: "Terminal.app",
    openCommand: (dir, cmd) => {
      const escaped = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script "${escaped}"'`
    },
  },
  ghostty: {
    name: "Ghostty",
    openCommand: (dir, cmd) => {
      const escaped = escapeForShell(`cd '${escapeForShell(dir)}' && ${cmd}; exec $SHELL`)
      return `open -a Ghostty --args -e sh -c '${escaped}'`
    },
  },
  iterm: {
    name: "iTerm",
    openCommand: (dir, cmd) => {
      const escaped = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e 'tell application "iTerm" to create window with default profile' -e 'tell application "iTerm" to tell current session of current window to write text "${escaped}"'`
    },
  },
  warp: {
    name: "Warp",
    openCommand: (dir, cmd) => {
      const escaped = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `open -a Warp "${dir}" && sleep 0.3 && osascript -e 'tell application "System Events" to tell process "Warp" to keystroke "${escaped}"' -e 'tell application "System Events" to tell process "Warp" to key code 36'`
    },
  },
  alacritty: {
    name: "Alacritty",
    openCommand: (dir, cmd) =>
      `alacritty --working-directory "${dir}" -e bash -c '${cmd}; exec bash'`,
  },
  kitty: {
    name: "Kitty",
    openCommand: (dir, cmd) =>
      `kitty --directory "${dir}" bash -c '${cmd}; exec bash'`,
  },
  hyper: {
    name: "Hyper",
    openCommand: (dir, cmd) => {
      const escaped = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `open -a Hyper && sleep 0.3 && osascript -e 'tell application "System Events" to tell process "Hyper" to keystroke "${escaped}"' -e 'tell application "System Events" to tell process "Hyper" to key code 36'`
    },
  },
}

export async function handoffToOpenCode(
  sessionId: string,
  method: "terminal" | "desktop",
  workingDir?: string,
  terminalApp: TerminalApp = "default"
): Promise<void> {
  const dir = workingDir || process.env.HOME || "~"
  const command = `opencode --session=${sessionId}`

  if (method === "desktop") {
    try {
      await execAsync(`open "opencode://session/${sessionId}"`)
      await showHUD("Opened in OpenCode Desktop")
    } catch {
      await Clipboard.copy(`cd "${dir}" && ${command}`)
      await showHUD("Desktop app not found - command copied")
    }
    return
  }

  const config = TERMINAL_CONFIGS[terminalApp]
  const openCommand = config.openCommand(dir, command)

  try {
    await execAsync(openCommand)
    await showHUD(`Opened in ${config.name}`)
  } catch (error) {
    const fullCommand = `cd "${dir}" && ${command}`
    await Clipboard.copy(fullCommand)
    await showToast({
      style: Toast.Style.Failure,
      title: `Failed to open ${config.name}`,
      message: "Command copied to clipboard instead",
    })
  }
}

export async function copySessionCommand(sessionId: string, workingDir?: string): Promise<void> {
  const cdCommand = workingDir ? `cd "${workingDir}" && ` : ""
  const command = `${cdCommand}opencode --session=${sessionId}`
  await Clipboard.copy(command)
  await showHUD("Command copied to clipboard")
}
