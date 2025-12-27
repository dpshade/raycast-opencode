import { useState, useEffect } from "react"
import { readdirSync, statSync, existsSync } from "fs"
import { homedir } from "os"
import { join, dirname, basename } from "path"

export interface PathSuggestion {
  path: string
  displayPath: string
  name: string
  type: "directory" | "file"
}

export function usePathAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<PathSuggestion[]>([])
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const match = query.match(/@([\w\/~.-]*)$/)
    
    if (!match) {
      setSuggestions([])
      setIsActive(false)
      return
    }

    const partialPath = match[1]
    
    if (!partialPath || partialPath.startsWith("/") && partialPath.length < 2) {
      setSuggestions([])
      setIsActive(false)
      return
    }

    setIsActive(true)

    try {
      const expandedPath = partialPath.replace(/^~/, homedir())
      let searchDir: string
      let prefix: string

      if (existsSync(expandedPath) && statSync(expandedPath).isDirectory()) {
        searchDir = expandedPath
        prefix = ""
      } else {
        searchDir = dirname(expandedPath) || homedir()
        prefix = basename(expandedPath).toLowerCase()
      }

      if (!existsSync(searchDir)) {
        setSuggestions([])
        return
      }

      const entries = readdirSync(searchDir)
        .filter((name) => !name.startsWith("."))
        .filter((name) => !prefix || name.toLowerCase().startsWith(prefix))
        .map((name) => {
          const fullPath = join(searchDir, name)
          try {
            const stat = statSync(fullPath)
            const displayPath = fullPath.replace(homedir(), "~")
            return {
              path: fullPath,
              displayPath,
              name,
              type: stat.isDirectory() ? "directory" : "file",
            } as PathSuggestion
          } catch {
            return null
          }
        })
        .filter((x): x is PathSuggestion => x !== null)
        .sort((a, b) => {
          if (a.type === "directory" && b.type === "file") return -1
          if (a.type === "file" && b.type === "directory") return 1
          return a.name.localeCompare(b.name)
        })
        .slice(0, 15)

      setSuggestions(entries)
    } catch {
      setSuggestions([])
    }
  }, [query])

  return { suggestions, isActive }
}

export function extractPathFromQuery(query: string): { cleanQuery: string; directory?: string } {
  const match = query.match(/@([\w\/~.-]+)\s/)
  
  if (!match) {
    return { cleanQuery: query }
  }

  const pathPart = match[1]
  const expandedPath = pathPart.replace(/^~/, homedir())
  
  try {
    if (existsSync(expandedPath)) {
      const stat = statSync(expandedPath)
      const directory = stat.isDirectory() ? expandedPath : dirname(expandedPath)
      const cleanQuery = query.replace(match[0], "").trim()
      return { cleanQuery, directory }
    }
  } catch {
    // Path doesn't exist, ignore
  }

  return { cleanQuery: query.replace(match[0], "").trim() }
}
