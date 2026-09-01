import JsBarcode from 'jsbarcode'

/**
 * Render a CODE128 barcode directly into an SVG element.
 */
export function renderBarcodeSvg(
  svgElement: SVGSVGElement,
  value: string,
  options?: {
    width?: number
    height?: number
    displayValue?: boolean
    fontSize?: number
    font?: string
    textMargin?: number
    margin?: number
    lineColor?: string
    background?: string
  }
) {
  if (!svgElement || !value) return

  try {
    JsBarcode(svgElement, value.trim(), {
      format: 'CODE128',
      width: options?.width ?? 2,
      height: options?.height ?? 50,
      displayValue: options?.displayValue ?? true,
      fontSize: options?.fontSize ?? 14,
      font: options?.font ?? 'monospace',
      textMargin: options?.textMargin ?? 2,
      margin: options?.margin ?? 10,
      lineColor: options?.lineColor ?? '#000000',
      background: options?.background ?? '#ffffff',
    })
  } catch (err) {
    console.error('[renderBarcodeSvg] Failed to generate barcode:', err)
  }
}

/**
 * Format barcode for UI display.
 */
export function formatBarcodeDisplay(value?: string | null): string {
  if (!value) return '—'
  return String(value).trim()
}

/**
 * Validate barcode format (alphanumeric, 4 to 32 chars).
 */
export function isValidBarcodeValue(value: string): boolean {
  return /^[A-Z0-9_-]{4,32}$/i.test(value.trim())
}
