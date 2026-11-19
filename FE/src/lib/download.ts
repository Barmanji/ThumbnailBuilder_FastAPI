/**
 * Save a CDN image to disk.
 *
 * The HTML `download` attribute is ignored for cross-origin URLs, so clicking a
 * plain <a download> on an ImageKit URL just opens it in a tab. Fetch the bytes
 * first and hand the browser a same-origin blob URL instead.
 */
export async function downloadImage(url: string, filename: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Could not fetch the image (${response.status}).`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()

  // Give the browser a moment to start the download before freeing the URL.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

export function thumbnailFilename(label: string, variant: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `thumbnail-builder-${slug || 'thumbnail'}-${variant}.png`
}
