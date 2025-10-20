// hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  handler: () => void
  description?: string
  enabled?: boolean
}

interface ShortcutOptions {
  preventDefault?: boolean
  stopPropagation?: boolean
  enableInInput?: boolean
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: ShortcutOptions = {}
) {
  const { 
    preventDefault = true, 
    stopPropagation = true,
    enableInInput = false 
  } = options

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input/textarea (unless explicitly enabled)
    if (!enableInInput) {
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return
      }
      // Also skip if contenteditable
      if (target.isContentEditable) {
        return
      }
    }

    // Find matching shortcut
    const matchedShortcut = shortcuts.find(shortcut => {
      if (shortcut.enabled === false) return false
      
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase() ||
                      e.code.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
      const altMatch = shortcut.alt ? e.altKey : !e.altKey
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
      const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey

      return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch
    })

    if (matchedShortcut) {
      if (preventDefault) e.preventDefault()
      if (stopPropagation) e.stopPropagation()
      matchedShortcut.handler()
    }
  }, [shortcuts, preventDefault, stopPropagation, enableInInput])

  useEffect(() => {
    // Use capture phase to intercept before browser
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])
}

// Global navigation shortcuts hook - UPDATED TO AVOID CONFLICTS
export function useGlobalShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  const globalShortcuts: ShortcutConfig[] = [
    // Navigation shortcuts - Using number keys without modifiers
    { key: '1', handler: () => router.push('/dashboard'), description: 'Dashboard' },
    { key: '2', handler: () => router.push('/loads'), description: 'Load Builder' },
    { key: '3', handler: () => router.push('/queue'), description: 'Queue' },
    { key: '4', handler: () => router.push('/instructors'), description: 'Instructors' },
    { key: '5', handler: () => router.push('/assignments'), description: 'History' },
    { key: '6', handler: () => router.push('/analytics'), description: 'Analytics' },
    { key: '7', handler: () => router.push('/notes'), description: 'Notes' },
    { key: '8', handler: () => router.push('/settings'), description: 'Settings' },
    
    // Alternative with 'g' for "go to" pattern
    { key: 'g', handler: () => {
      window.dispatchEvent(new CustomEvent('show-navigation-menu'))
    }, description: 'Go to menu' },
    
    // Global actions - safer combinations
    { key: 'k', handler: () => openCommandPalette(), description: 'Command palette' },
    { key: '?', handler: () => openShortcutsHelp(), description: 'Show keyboard shortcuts' },
    { key: '/', handler: () => openSearchModal(), description: 'Search' },
  ]

  useKeyboardShortcuts(globalShortcuts)

  return { pathname }
}

// Quick navigation menu that appears when pressing 'g'
export function useGoToMenu(handlers?: {
  onNavigate?: (path: string) => void
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleShowMenu = () => setMenuOpen(true)
    window.addEventListener('show-navigation-menu', handleShowMenu)
    return () => window.removeEventListener('show-navigation-menu', handleShowMenu)
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const handleKeyPress = (e: KeyboardEvent) => {
      const routes: Record<string, string> = {
        'd': '/dashboard',
        'l': '/loads',
        'q': '/queue',
        'i': '/instructors',
        'h': '/assignments',
        'a': '/analytics',
        'n': '/notes',
        's': '/settings',
      }

      const route = routes[e.key.toLowerCase()]
      if (route) {
        e.preventDefault()
        // Use provided handler or default to router.push
        if (handlers?.onNavigate) {
          handlers.onNavigate(route)
        } else {
          router.push(route)
        }
        setMenuOpen(false)
      } else if (e.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [menuOpen, router, handlers])

  return { menuOpen, setMenuOpen }
}

// Helper functions for global actions
function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('open-command-palette'))
}

function openSearchModal() {
  window.dispatchEvent(new CustomEvent('open-search'))
}

function openShortcutsHelp() {
  window.dispatchEvent(new CustomEvent('show-shortcuts-help'))
}

// Context-specific shortcuts for Queue page - SAFER COMBINATIONS
export function useQueueShortcuts(handlers: {
  onAddStudent?: () => void
  onCreateGroup?: () => void
  onImport?: () => void
  onDelete?: () => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
}) {
  const shortcuts: ShortcutConfig[] = [
    // Using single letters without modifiers when safe
    { key: 'a', handler: () => handlers.onAddStudent?.(), description: 'Add student' },
    { key: 'g', shift: true, handler: () => handlers.onCreateGroup?.(), description: 'Create group' },
    { key: 'i', handler: () => handlers.onImport?.(), description: 'Import students' },
    { key: 'Delete', handler: () => handlers.onDelete?.(), description: 'Delete selected' },
    { key: 'Backspace', handler: () => handlers.onDelete?.(), description: 'Delete selected (alt)' },
    { key: 'a', shift: true, handler: () => handlers.onSelectAll?.(), description: 'Select all' },
    { key: 'Escape', handler: () => handlers.onDeselectAll?.(), description: 'Deselect all' },
    { key: 'd', handler: () => handlers.onDeselectAll?.(), description: 'Deselect all (alt)' },
  ]

  useKeyboardShortcuts(shortcuts)
}

// Context-specific shortcuts for Load Builder (assignment operations within a load)
export function useLoadBuilderShortcuts(handlers: {
  onQuickAssign?: () => void
  onConfirmAssignment?: () => void
  onCancelOperation?: () => void
  onToggleRequest?: () => void
  onMarkMissed?: () => void
}) {
  const shortcuts: ShortcutConfig[] = [
    { key: ' ', handler: () => handlers.onQuickAssign?.(), description: 'Quick assign' },
    { key: 'Enter', handler: () => handlers.onConfirmAssignment?.(), description: 'Confirm' },
    { key: 'Escape', handler: () => handlers.onCancelOperation?.(), description: 'Cancel' },
    { key: 'r', handler: () => handlers.onToggleRequest?.(), description: 'Toggle request jump' },
    { key: 'm', handler: () => handlers.onMarkMissed?.(), description: 'Mark as missed jump' },
  ]

  useKeyboardShortcuts(shortcuts)
}

// Context-specific shortcuts for Loads Page (load-level operations)
export function useLoadsPageShortcuts(handlers: {
  onNewLoad?: () => void
  onMarkReady?: () => void
  onMarkDeparted?: () => void
  onMarkCompleted?: () => void
  onDeleteLoad?: () => void
  onOptimizeLoad?: () => void
  onNavigateUp?: () => void
  onNavigateDown?: () => void
  onToggleExpand?: () => void
}) {
  const shortcuts: ShortcutConfig[] = [
    { key: 'n', handler: () => handlers.onNewLoad?.(), description: 'New load' },
    { key: 'r', handler: () => handlers.onMarkReady?.(), description: 'Mark load ready' },
    { key: 'd', handler: () => handlers.onMarkDeparted?.(), description: 'Mark load departed' },
    { key: 'c', handler: () => handlers.onMarkCompleted?.(), description: 'Mark load completed' },
    { key: 'Delete', handler: () => handlers.onDeleteLoad?.(), description: 'Delete load' },
    { key: 'Backspace', handler: () => handlers.onDeleteLoad?.(), description: 'Delete load (alt)' },
    { key: 'a', handler: () => handlers.onOptimizeLoad?.(), description: 'Auto-assign load' },
    { key: 'o', handler: () => handlers.onOptimizeLoad?.(), description: 'Optimize load' },
    { key: 'ArrowUp', handler: () => handlers.onNavigateUp?.(), description: 'Navigate to previous load' },
    { key: 'ArrowDown', handler: () => handlers.onNavigateDown?.(), description: 'Navigate to next load' },
    { key: 'Enter', handler: () => handlers.onToggleExpand?.(), description: 'Expand/collapse load' },
  ]

  useKeyboardShortcuts(shortcuts)
}

// Modal-specific shortcuts
export function useModalShortcuts(
  isOpen: boolean,
  onClose: () => void,
  _onConfirm?: () => void
) {
  const shortcuts: ShortcutConfig[] = [
    { key: 'Escape', handler: onClose, enabled: isOpen, description: 'Close modal' },
    // Removed Ctrl+Enter as it might conflict - use button click or Enter in form
  ]

  useKeyboardShortcuts(shortcuts, { enableInInput: false })
}

// Instructor page shortcuts - SAFER COMBINATIONS
export function useInstructorShortcuts(handlers: {
  onAddInstructor?: () => void
  onClockToggle?: () => void
  onEdit?: () => void
  onSwitchTab?: (tab: 'roster' | 'teams') => void
}) {
  const shortcuts: ShortcutConfig[] = [
    { key: 'n', handler: () => handlers.onAddInstructor?.(), description: 'New instructor' },
    { key: 'c', handler: () => handlers.onClockToggle?.(), description: 'Clock in/out' },
    { key: 'e', handler: () => handlers.onEdit?.(), description: 'Edit selected' },
    { key: '[', handler: () => handlers.onSwitchTab?.('roster'), description: 'Roster tab' },
    { key: ']', handler: () => handlers.onSwitchTab?.('teams'), description: 'Teams tab' },
  ]

  useKeyboardShortcuts(shortcuts)
}

// Form navigation shortcuts
export function useFormShortcuts(handlers: {
  onSubmit?: () => void
  onCancel?: () => void
}) {
  const shortcuts: ShortcutConfig[] = [
    { key: 's', ctrl: true, handler: () => handlers.onSubmit?.(), description: 'Save' },
    { key: 'Escape', handler: () => handlers.onCancel?.(), description: 'Cancel' },
  ]

  useKeyboardShortcuts(shortcuts, { enableInInput: true })
}