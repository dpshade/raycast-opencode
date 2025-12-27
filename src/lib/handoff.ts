import { showHUD, Clipboard, showToast, Toast } from "@raycast/api"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export type TerminalApp = "default" | "ghostty" | "iterm" | "warp" | "alacritty" | "kitty" | "terminal" | "hyper"

interface TerminalConfig {
  name: string
  openCommand: (dir: string, cmd: string) => string
}

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

const TERMINAL_CONFIGS: Record<TerminalApp, TerminalConfig> = {
  default: {
    name: "Default Terminal",
    openCommand: (dir, cmd) => {
      const fullCmd = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e '
        tell application "Terminal"
          activate
          if (count of windows) > 0 then
            tell application "System Events" to keystroke "t" using command down
            delay 0.3
            do script "${fullCmd}" in front window
          else
            do script "${fullCmd}"
          end if
        end tell'`
    },
  },
  terminal: {
    name: "Terminal.app",
    openCommand: (dir, cmd) => {
      const fullCmd = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e '
        tell application "Terminal"
          activate
          if (count of windows) > 0 then
            tell application "System Events" to keystroke "t" using command down
            delay 0.3
            do script "${fullCmd}" in front window
          else
            do script "${fullCmd}"
          end if
        end tell'`
    },
  },
  ghostty: {
    name: "Ghostty",
    openCommand: (dir, cmd) => {
      const fullCmd = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e '
        tell application "Ghostty"
          activate
          delay 0.1
          tell application "System Events"
            keystroke "t" using command down
            delay 0.3
            keystroke "${fullCmd}"
            key code 36
          end tell
        end tell'`
    },
  },
  iterm: {
    name: "iTerm",
    openCommand: (dir, cmd) => {
      const fullCmd = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e '
        tell application "iTerm"
          activate
          if (count of windows) = 0 then
            create window with default profile command "${fullCmd}"
          else
            tell current window
              create tab with default profile command "${fullCmd}"
            end tell
          end if
        end tell'`
    },
  },
  warp: {
    name: "Warp",
    openCommand: (dir, cmd) => {
      const fullCmd = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e '
        tell application "Warp"
          activate
          delay 0.1
          tell application "System Events"
            keystroke "t" using command down
            delay 0.3
            keystroke "${fullCmd}"
            key code 36
          end tell
        end tell'`
    },
  },
  alacritty: {
    name: "Alacritty",
    openCommand: (dir, cmd) =>
      `alacritty --working-directory "${dir}" -e bash -c '${cmd}; exec bash'`,
  },
  kitty: {
    name: "Kitty",
    openCommand: (dir, cmd) => {
      const fullCmd = cmd.replace(/'/g, "'\\''")
      return `kitty @ launch --type=tab --cwd="${dir}" bash -c '${fullCmd}; exec bash' 2>/dev/null || kitty --single-instance --directory "${dir}" bash -c '${fullCmd}; exec bash'`
    },
  },
  hyper: {
    name: "Hyper",
    openCommand: (dir, cmd) => {
      const fullCmd = escapeForAppleScript(`cd "${dir}" && ${cmd}`)
      return `osascript -e '
        tell application "Hyper"
          activate
          delay 0.1
          tell application "System Events"
            keystroke "t" using command down
            delay 0.3
            keystroke "${fullCmd}"
            key code 36
          end tell
        end tell'`
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
