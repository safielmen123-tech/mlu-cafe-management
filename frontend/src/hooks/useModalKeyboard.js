import { useEffect, useRef } from 'react'

function isTextarea(target) {
  return target?.tagName?.toLowerCase() === 'textarea'
}

function isButtonTypeButton(target) {
  return target?.tagName?.toLowerCase() === 'button' && target.type === 'button'
}

function isEditableField(target) {
  const tag = target?.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

/**
 * @param {'auto' | 'always' | 'never'} primaryActionMode
 * - auto: Enter submits nearest form (Save Item)
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
  const onEscapeRef = useRef(onEscape)
  const onPrimaryActionRef = useRef(onPrimaryAction)
  const modeRef = useRef(primaryActionMode)

  // Kept in refs so the keydown listener always sees the latest callbacks without
  // being torn down and re-attached on every render.
  useEffect(() => {
    onEscapeRef.current = onEscape
    onPrimaryActionRef.current = onPrimaryAction
    modeRef.current = primaryActionMode
  })

  useEffect(() => {
    if (!isOpen) return undefined

    const panel = panelRef.current
    const active = document.activeElement
    const typingInsidePanel = Boolean(panel && active && panel.contains(active) && isEditableField(active))

    if (!typingInsidePanel) {
      panel?.focus({ preventScroll: true })
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onEscapeRef.current?.()
        return
      }

      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return

      const target = event.target
      if (isTextarea(target) || isButtonTypeButton(target)) return

      const mode = modeRef.current
      const form = target?.closest?.('form')

      if (form && mode !== 'never') {
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

      if (mode === 'always' && onPrimaryActionRef.current) {
        event.preventDefault()
        event.stopPropagation()
        onPrimaryActionRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return panelRef
}
