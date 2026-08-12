import { useEffect, useRef } from 'react'

function isTextarea(target) {
  return target?.tagName?.toLowerCase() === 'textarea'
}

function isButtonTypeButton(target) {
  return target?.tagName?.toLowerCase() === 'button' && target.type === 'button'
}

/**
 * @param {'auto' | 'always' | 'never'} primaryActionMode
 * - auto: Enter submits nearest form (Save Recipe / Save Item)
 * - always: Enter calls onPrimaryAction (confirm dialogs)
 * - never: Escape only
 * @returns {React.RefObject<HTMLElement|null>} attach to modal panel with tabIndex={-1}
 */
export function useModalKeyboard({
  isOpen,
  onEscape,
  onPrimaryAction,
  primaryActionMode = 'auto',
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const focusPanel = () => {
      panelRef.current?.focus({ preventScroll: true })
    }
    focusPanel()
    const focusTimer = window.setTimeout(focusPanel, 0)

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onEscape?.()
        return
      }

      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return

      const target = event.target
      if (isTextarea(target) || isButtonTypeButton(target)) return

      const form = target?.closest?.('form')

      if (form && primaryActionMode !== 'never') {
        if (target?.tagName?.toLowerCase() === 'select') return
        event.preventDefault()
        event.stopPropagation()
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit()
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
        return
      }

      if (primaryActionMode === 'always' && onPrimaryAction) {
        event.preventDefault()
        event.stopPropagation()
        onPrimaryAction()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onEscape, onPrimaryAction, primaryActionMode])

  return panelRef
}
