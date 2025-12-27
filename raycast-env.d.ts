/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Default Project - Default working directory for OpenCode */
  "defaultProject"?: string,
  /** Handoff Method - How to open full sessions */
  "handoffMethod": "terminal" | "desktop",
  /** Auto-start Server - Automatically start OpenCode server if not running */
  "autoStartServer": boolean,
  /** Terminal Application - Which terminal to use when opening sessions */
  "terminalApp": "default" | "ghostty" | "iterm" | "warp" | "alacritty" | "kitty" | "terminal" | "hyper"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `ask` command */
  export type Ask = ExtensionPreferences & {}
  /** Preferences accessible in the `sessions` command */
  export type Sessions = ExtensionPreferences & {}
  /** Preferences accessible in the `projects` command */
  export type Projects = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `ask` command */
  export type Ask = {
  /** What do you want to know? */
  "question": string
}
  /** Arguments passed to the `sessions` command */
  export type Sessions = {}
  /** Arguments passed to the `projects` command */
  export type Projects = {}
}

