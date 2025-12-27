import { useState, useEffect, useCallback } from "react"
import { LocalStorage } from "@raycast/api"

const STORAGE_KEY = "opencode-recent-projects"
const MAX_PROJECTS = 20

export interface Project {
  path: string
  name: string
  lastUsed: number
}

interface UseProjectsResult {
  projects: Project[]
  isLoading: boolean
  addProject: (path: string) => Promise<void>
  removeProject: (path: string) => Promise<void>
  clearProjects: () => Promise<void>
}

function getProjectName(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProjects() {
      try {
        const stored = await LocalStorage.getItem<string>(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as Project[]
          setProjects(parsed)
        }
      } catch {
        setProjects([])
      } finally {
        setIsLoading(false)
      }
    }
    loadProjects()
  }, [])

  const saveProjects = useCallback(async (newProjects: Project[]) => {
    setProjects(newProjects)
    await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects))
  }, [])

  const addProject = useCallback(
    async (path: string) => {
      const existing = projects.filter((p) => p.path !== path)
      const newProject: Project = {
        path,
        name: getProjectName(path),
        lastUsed: Date.now(),
      }
      const updated = [newProject, ...existing].slice(0, MAX_PROJECTS)
      await saveProjects(updated)
    },
    [projects, saveProjects]
  )

  const removeProject = useCallback(
    async (path: string) => {
      const updated = projects.filter((p) => p.path !== path)
      await saveProjects(updated)
    },
    [projects, saveProjects]
  )

  const clearProjects = useCallback(async () => {
    await saveProjects([])
  }, [saveProjects])

  return {
    projects,
    isLoading,
    addProject,
    removeProject,
    clearProjects,
  }
}
