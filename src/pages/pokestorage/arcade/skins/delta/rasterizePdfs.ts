import { i18n } from '../../../../../services/i18n'
import { rasterName, type DeltaSkinArchive } from './parseDeltaSkin'

/** Wide enough to stay sharp on a large window without a huge bitmap. */
const TARGET_WIDTH = 1800

async function rasterize(pdf: Uint8Array): Promise<Uint8Array> {
  // Loaded only for skins that need it; pdf.js is large.
  const pdfjs = await import('pdfjs-dist')
  const { default: workerSrc } =
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  const task = pdfjs.getDocument({ data: pdf.slice() })
  const document = await task.promise
  try {
    const page = await document.getPage(1)
    const natural = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: TARGET_WIDTH / natural.width })
    const canvas = globalThis.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error(i18n.t('arcade:rasterizePdfs.noCanvasToDrawThePdfOn'))
    // Artwork is often see-through (a controller over the game); keep it so.
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      background: 'rgba(0, 0, 0, 0)',
    }).promise
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    )
    if (!blob)
      throw new Error(i18n.t('arcade:rasterizePdfs.thePdfCouldNotBeDrawn'))
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    void task.destroy()
  }
}

/**
 * A copy of the archive that also holds a PNG of every PDF in it, which is
 * how Delta skins usually ship their artwork. A PDF that will not draw is
 * left alone; normalizing then reports it.
 */
export async function rasterizeSkinPdfs(
  archive: DeltaSkinArchive
): Promise<DeltaSkinArchive> {
  const pdfs = [...archive.files].filter(([name]) =>
    name.toLowerCase().endsWith('.pdf')
  )
  if (pdfs.length === 0) return archive
  const files = new Map(archive.files)
  await Promise.all(
    pdfs.map(async ([name, bytes]) => {
      try {
        files.set(rasterName(name), await rasterize(bytes))
      } catch {
        // Reported when a layout that needs it is chosen.
      }
    })
  )
  return { ...archive, files }
}
