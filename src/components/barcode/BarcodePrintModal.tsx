import React, { useState } from 'react'
import { X, Printer, Copy, Check } from 'lucide-react'
import { BarcodeLabel } from './BarcodeLabel'
import { BRAND_EN } from '../../lib/brand'

export interface BarcodePrintModalProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  variantName?: string
  barcodeValue: string
  price: number
  mrp?: number | null
  defaultQuantity?: number
}

type LabelSizePreset = {
  name: string
  widthMm: number
  heightMm: number
}

const LABEL_PRESETS: LabelSizePreset[] = [
  { name: 'Thermal Standard (50mm × 30mm)', widthMm: 50, heightMm: 30 },
  { name: 'Thermal Compact (50mm × 25mm)', widthMm: 50, heightMm: 25 },
  { name: 'Small Jewelry / Tag (38mm × 25mm)', widthMm: 38, heightMm: 25 },
  { name: 'Large Sticker (60mm × 40mm)', widthMm: 60, heightMm: 40 },
]

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  onClose,
  productName,
  variantName,
  barcodeValue,
  price,
  mrp,
  defaultQuantity = 1,
}) => {
  const [quantity, setQuantity] = useState(defaultQuantity)
  const [selectedPreset, setSelectedPreset] = useState<LabelSizePreset>(LABEL_PRESETS[0])
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return

    // Build standalone HTML for the printed stickers
    const stickersHtml = Array.from({ length: Math.max(1, quantity) })
      .map(
        () => `
        <div class="sticker">
          <div class="brand">${BRAND_EN}</div>
          <div class="prod-title">${productName}</div>
          ${variantName ? `<div class="variant">${variantName}</div>` : ''}
          <div class="barcode-box">
            <svg class="barcode-svg" jsbarcode-value="${barcodeValue}"></svg>
          </div>
          <div class="footer">
            <span>${mrp && mrp > price ? `<span class="mrp">MRP ₹${mrp}</span>` : 'CLAD RETAIL'}</span>
            <span class="price">₹${price}</span>
          </div>
        </div>
      `
      )
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcodes - ${barcodeValue}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: ${selectedPreset.widthMm}mm ${selectedPreset.heightMm}mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            }
            .sticker {
              width: ${selectedPreset.widthMm}mm;
              height: ${selectedPreset.heightMm}mm;
              padding: 1.5mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              page-break-after: always;
              overflow: hidden;
            }
            .brand {
              font-size: 8pt;
              font-weight: 900;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              line-height: 1;
            }
            .prod-title {
              font-size: 8.5pt;
              font-weight: 700;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
              line-height: 1.1;
              margin-top: 1px;
            }
            .variant {
              font-size: 7.5pt;
              font-weight: 800;
              border: 0.5pt solid #000;
              padding: 0 3px;
              border-radius: 2px;
              display: inline-block;
              line-height: 1.1;
              margin-top: 1px;
            }
            .barcode-box {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 1px 0;
            }
            .barcode-svg {
              max-width: 95%;
              height: auto;
            }
            .footer {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 7.5pt;
              border-top: 0.5pt solid #ccc;
              padding-top: 1px;
              line-height: 1;
            }
            .mrp {
              text-decoration: line-through;
              color: #666;
            }
            .price {
              font-size: 9.5pt;
              font-weight: 900;
            }
          </style>
        </head>
        <body>
          ${stickersHtml}
          <script>
            window.onload = function() {
              JsBarcode(".barcode-svg").init({
                format: "CODE128",
                width: 1.4,
                height: 35,
                fontSize: 9,
                margin: 2,
                displayValue: true
              });
              setTimeout(function() {
                window.focus();
                window.print();
              }, 300);
            }
          </script>
        </body>
      </html>
    `

    doc.open()
    doc.write(html)
    doc.close()

    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#E8D399] shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0A0A0A] px-6 py-4 border-b border-[#D4AF37]/30 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
              <Printer size={18} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-white">
                Print Barcode Labels ({BRAND_EN})
              </h2>
              <p className="text-xs text-[#D4AF37] font-semibold">
                Generate physical retail stickers for this SKU
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Barcode Info Card */}
          <div className="bg-[#FBFAF6] border border-[#E8D399] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#B48811]">
                Product / SKU
              </span>
              <h3 className="text-lg font-black text-[#0A0A0A]">{productName}</h3>
              {variantName && (
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                  Variant: {variantName}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
              <span className="font-mono text-sm font-black text-black">
                {barcodeValue}
              </span>
              <button
                type="button"
                onClick={handleCopyBarcode}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
                title="Copy Barcode Value"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                Number of Labels to Print
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center font-black text-lg py-2 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] focus:border-[#0A0A0A] focus:bg-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300"
                >
                  +
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Prints {quantity} physical stickers with identical barcode identifier.
              </p>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1.5">
                Label Sizing Preset
              </label>
              <select
                value={selectedPreset.name}
                onChange={(e) => {
                  const preset = LABEL_PRESETS.find((p) => p.name === e.target.value)
                  if (preset) setSelectedPreset(preset)
                }}
                className="w-full py-2.5 px-3 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] font-bold text-sm text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
              >
                {LABEL_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-2">
              Sticker Print Preview (1 of {quantity})
            </label>
            <div className="bg-[#FBFAF6] border-2 border-dashed border-[#E8D399] rounded-2xl p-6 flex items-center justify-center">
              <BarcodeLabel
                productName={productName}
                variantName={variantName}
                barcodeValue={barcodeValue}
                price={price}
                mrp={mrp}
                storeName={BRAND_EN}
                widthMm={selectedPreset.widthMm}
                heightMm={selectedPreset.heightMm}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#FBFAF6] px-6 py-4 border-t border-[#E8D399] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] font-black hover:bg-[#1A1A1A] transition-all shadow-md cursor-pointer hover:scale-[1.02]"
          >
            <Printer size={16} />
            Print {quantity} {quantity === 1 ? 'Sticker' : 'Stickers'}
          </button>
        </div>
      </div>
    </div>
  )
}
