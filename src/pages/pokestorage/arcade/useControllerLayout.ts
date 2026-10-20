import { useEffect, type RefObject } from 'react'

export function useControllerLayout(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  gameId: string | null
) {
  // The display can be width- or height-limited. Keep shoulder buttons on its
  // actual top edge as the viewport and inline messages change size.
  useEffect(() => {
    const screen = canvasRef.current
    const stage = screen?.closest<HTMLElement>('.arcade-stage')
    if (!screen || !stage) return
    const alignShoulders = () => {
      const offset =
        screen.getBoundingClientRect().top - stage.getBoundingClientRect().top
      stage.style.setProperty('--screen-top', `${offset}px`)
      const select = stage.querySelector('.arcade-controller-system button')
      const a = stage.querySelector('.arcade-controller-round--a')
      if (select && a) {
        const aRight = a.getBoundingClientRect().right
        const width = aRight - select.getBoundingClientRect().left
        if (width > 0) stage.style.setProperty('--shoulder-width', `${width}px`)
        stage.style.setProperty(
          '--shoulder-right',
          `${stage.getBoundingClientRect().right - aRight}px`
        )
      }
    }
    const observer = new ResizeObserver(alignShoulders)
    observer.observe(stage)
    observer.observe(screen)
    alignShoulders()
    return () => observer.disconnect()
  }, [canvasRef, gameId])
}
