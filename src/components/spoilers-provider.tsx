import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'ringside:spoilers'

type SpoilersContextValue = {
  /** When true, match results are shown; when false, they are hidden. */
  spoilers: boolean
  setSpoilers: (value: boolean) => void
}

const SpoilersContext = createContext<SpoilersContextValue | null>(null)

function readStoredSpoilers(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
  } catch {
    // private mode / blocked storage
  }
  return null
}

function writeStoredSpoilers(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // private mode / blocked storage
  }
}

/**
 * Global spoilers preference (localStorage). Defaults to off so results stay
 * hidden until the user opts in — matches the rivalry Spoilers switch.
 */
export function SpoilersProvider({ children }: { children: ReactNode }) {
  // SSR + first client paint: off. Hydrate from storage after mount to avoid
  // flashing spoilers before the preference is known.
  const [spoilers, setSpoilersState] = useState(false)

  useEffect(() => {
    const stored = readStoredSpoilers()
    if (stored != null) setSpoilersState(stored)
  }, [])

  const setSpoilers = (value: boolean) => {
    setSpoilersState(value)
    writeStoredSpoilers(value)
  }

  return (
    <SpoilersContext.Provider value={{ spoilers, setSpoilers }}>
      {children}
    </SpoilersContext.Provider>
  )
}

export function useSpoilers(): SpoilersContextValue {
  const ctx = useContext(SpoilersContext)
  if (!ctx) {
    throw new Error('useSpoilers must be used within SpoilersProvider')
  }
  return ctx
}
