import { useState, useEffect, useRef, useCallback } from "react"
import { LocalStorage } from "@raycast/api"
import { Index } from "flexsearch"
import { Session, getClient, Message } from "../lib/opencode"

interface IndexedSession {
  id: string
  title: string
  directory: string
  content: string
  updated: number
}

interface CachedIndex {
  version: number
  sessionHashes: Record<string, string>
  indexedSessions: IndexedSession[]
}

const CACHE_KEY = "opencode-session-search-index"
const CACHE_VERSION = 1
const MESSAGES_PER_SESSION = 10

function hashSession(session: Session): string {
  return `${session.time.updated}`
}

function extractTextFromMessages(messages: Message[]): string {
  const recentMessages = messages.slice(-MESSAGES_PER_SESSION)
  return recentMessages
    .flatMap((msg) =>
      msg.parts
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text as string)
    )
    .join(" ")
}

async function loadCachedIndex(
  index: Index,
  indexedData: Map<string, IndexedSession>
): Promise<void> {
  try {
    const cachedJson = await LocalStorage.getItem<string>(CACHE_KEY)
    if (!cachedJson) return

    const cached: CachedIndex = JSON.parse(cachedJson)
    if (cached.version !== CACHE_VERSION) return

    for (const item of cached.indexedSessions) {
      indexedData.set(item.id, item)
      index.add(item.id, `${item.title} ${item.directory} ${item.content}`)
    }
  } catch {
    return
  }
}

async function saveCachedIndex(
  indexedData: Map<string, IndexedSession>
): Promise<void> {
  try {
    const sessionHashes: Record<string, string> = {}
    for (const [id, data] of indexedData) {
      sessionHashes[id] = `${data.updated}`
    }

    const cache: CachedIndex = {
      version: CACHE_VERSION,
      sessionHashes,
      indexedSessions: Array.from(indexedData.values()),
    }
    await LocalStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    return
  }
}

function findSessionsNeedingIndex(
  sessions: Session[],
  indexedData: Map<string, IndexedSession>
): Session[] {
  return sessions.filter((session) => {
    const cached = indexedData.get(session.id)
    return !cached || hashSession(session) !== `${cached.updated}`
  })
}

async function indexSessionBatch(
  batch: Session[],
  index: Index,
  indexedData: Map<string, IndexedSession>,
  client: Awaited<ReturnType<typeof getClient>>
): Promise<void> {
  await Promise.all(
    batch.map(async (session) => {
      try {
        const messages = await client.getSessionMessages(
          session.id,
          MESSAGES_PER_SESSION * 2
        )
        const content = extractTextFromMessages(messages)

        const indexed: IndexedSession = {
          id: session.id,
          title: session.title || "",
          directory: session.directory || "",
          content,
          updated: session.time.updated,
        }

        if (indexedData.has(session.id)) {
          index.remove(session.id)
        }
        index.add(session.id, `${indexed.title} ${indexed.directory} ${indexed.content}`)
        indexedData.set(session.id, indexed)
      } catch {
        const indexed: IndexedSession = {
          id: session.id,
          title: session.title || "",
          directory: session.directory || "",
          content: "",
          updated: session.time.updated,
        }
        if (!indexedData.has(session.id)) {
          index.add(session.id, `${indexed.title} ${indexed.directory}`)
          indexedData.set(session.id, indexed)
        }
      }
    })
  )
}

function pruneDeletedSessions(
  sessions: Session[],
  index: Index,
  indexedData: Map<string, IndexedSession>
): void {
  const sessionIds = new Set(sessions.map((s) => s.id))
  for (const id of indexedData.keys()) {
    if (!sessionIds.has(id)) {
      index.remove(id)
      indexedData.delete(id)
    }
  }
}

export function useSessionSearch(sessions: Session[]) {
  const [searchText, setSearchText] = useState("")
  const [filteredSessions, setFilteredSessions] = useState<Session[]>(sessions)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState(0)

  const indexRef = useRef<Index | null>(null)
  const indexedDataRef = useRef<Map<string, IndexedSession>>(new Map())
  const isIndexingRef = useRef(false)

  useEffect(() => {
    if (!indexRef.current) {
      indexRef.current = new Index({
        tokenize: "forward",
        resolution: 9,
      })
    }
  }, [])

  useEffect(() => {
    if (sessions.length === 0) return
    if (isIndexingRef.current) return

    async function buildIndex() {
      isIndexingRef.current = true
      setIsIndexing(true)

      const index = indexRef.current!
      const indexedData = indexedDataRef.current

      await loadCachedIndex(index, indexedData)

      const sortedSessions = [...sessions].sort(
        (a, b) => b.time.updated - a.time.updated
      )

      const sessionsToIndex = findSessionsNeedingIndex(sortedSessions, indexedData)

      if (sessionsToIndex.length === 0) {
        setIsIndexing(false)
        setIndexProgress(100)
        isIndexingRef.current = false
        return
      }

      const batchSize = Math.max(1, Math.ceil(sessionsToIndex.length / 4))
      const client = await getClient()

      for (let batchIndex = 0; batchIndex < 4; batchIndex++) {
        const start = batchIndex * batchSize
        const end = Math.min(start + batchSize, sessionsToIndex.length)
        const batch = sessionsToIndex.slice(start, end)

        if (batch.length === 0) break

        await indexSessionBatch(batch, index, indexedData, client)
        setIndexProgress(Math.round(((batchIndex + 1) / 4) * 100))

        if (batchIndex < 3) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      }

      pruneDeletedSessions(sessions, index, indexedData)
      await saveCachedIndex(indexedData)

      setIsIndexing(false)
      isIndexingRef.current = false
    }

    buildIndex()
  }, [sessions])

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredSessions(sessions)
      return
    }

    const index = indexRef.current
    if (!index) {
      setFilteredSessions(sessions)
      return
    }

    const results = index.search(searchText, { limit: 100 })
    const resultIds = new Set(results as string[])

    const matched = sessions.filter((s) => resultIds.has(s.id))
    matched.sort((a, b) => b.time.updated - a.time.updated)

    setFilteredSessions(matched)
  }, [searchText, sessions])

  const clearCache = useCallback(async () => {
    await LocalStorage.removeItem(CACHE_KEY)
    indexRef.current = new Index({ tokenize: "forward", resolution: 9 })
    indexedDataRef.current.clear()
    setIndexProgress(0)
  }, [])

  return {
    searchText,
    setSearchText,
    filteredSessions,
    isIndexing,
    indexProgress,
    clearCache,
  }
}
