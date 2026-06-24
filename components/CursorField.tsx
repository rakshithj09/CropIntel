'use client'

/**
 * CursorField — a simple custom cursor: a pixel-accurate emerald dot plus a
 * larger ring that lags gently behind it (the trailing-ring effect), matching
 * the marketing site. Over links/buttons the ring grows and darkens; on click
 * it contracts. Self-disables on coarse pointers (touch) and when
 * prefers-reduced-motion is set, and is hidden below the md breakpoint.
 */

import { useEffect, useRef } from 'react'

// emerald accent (primary-500 / leaf-deep), matching the site
const LEAF = { r: 31, g: 168, b: 102 }
const LEAF_DEEP = { r: 14, g: 122, b: 71 }

export default function CursorField() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!finePointer || reduced) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    document.body.classList.add('cursor-field-active')

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const ringPos = { x: target.x, y: target.y }
    let hasMoved = false
    let pressed = false
    let overInteractive = false

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      if (!hasMoved) {
        hasMoved = true
        ringPos.x = target.x
        ringPos.y = target.y
        dot.style.opacity = '1'
        ring.style.opacity = '1'
      }
      const el = e.target instanceof Element ? e.target : null
      overInteractive = !!el?.closest('a, button, input, textarea, select, [role="button"], label')
    }
    const onDown = () => (pressed = true)
    const onUp = () => (pressed = false)
    const onLeave = () => {
      dot.style.opacity = '0'
      ring.style.opacity = '0'
    }
    const onEnter = () => {
      if (hasMoved) {
        dot.style.opacity = '1'
        ring.style.opacity = '1'
      }
    }

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      ringPos.x += (target.x - ringPos.x) * 0.18
      ringPos.y += (target.y - ringPos.y) * 0.18
      dot.style.transform = `translate(${target.x}px, ${target.y}px) translate(-50%, -50%)`
      const ringScale = (pressed ? 0.7 : 1) * (overInteractive ? 1.7 : 1)
      ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%) scale(${ringScale})`
      ring.style.borderColor = overInteractive
        ? `rgba(${LEAF_DEEP.r}, ${LEAF_DEEP.g}, ${LEAF_DEEP.b}, 0.9)`
        : `rgba(${LEAF.r}, ${LEAF.g}, ${LEAF.b}, 0.55)`
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    document.addEventListener('pointerenter', onEnter)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('pointerenter', onEnter)
      document.body.classList.remove('cursor-field-active')
    }
  }, [])

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="cursor-dot pointer-events-none fixed left-0 top-0 z-[9999] hidden h-2 w-2 rounded-full opacity-0 md:block"
      />
      <div
        ref={ringRef}
        aria-hidden
        className="cursor-ring pointer-events-none fixed left-0 top-0 z-[9999] hidden h-9 w-9 rounded-full border opacity-0 md:block"
      />
    </>
  )
}
