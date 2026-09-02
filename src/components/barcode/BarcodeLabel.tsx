import React, { useEffect, useRef } from 'react'
import { renderBarcodeSvg } from '../../lib/barcode'
import { BRAND_EN } from '../../lib/brand'
import { formatCurrency } from '../../lib/retail'

export interface BarcodeLabelProps {
  productName: string
  variantName?: string
  barcodeValue: string
  price: number
  mrp?: number | null
  storeName?: string
  widthMm?: number
  heightMm?: number
}

export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  productName,
  variantName,
  barcodeValue,
  price,
  mrp,
  storeName = BRAND_EN,
  widthMm = 50,
  heightMm = 30,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current && barcodeValue) {
      renderBarcodeSvg(svgRef.current, barcodeValue, {
        width: 1.2,
        height: 28,
        fontSize: 9,
        margin: 0,
        textMargin: 1,
        displayValue: true,
      })
    }
  }, [barcodeValue])

  return (
    <div
      className="barcode-sticker-item bg-white text-black border border-gray-300 rounded p-1.5 flex flex-col justify-between items-center text-center shadow-sm select-none"
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Brand & Product Header */}
      <div className="w-full">
        <div className="text-[9px] font-black tracking-widest text-[#0A0A0A] uppercase truncate leading-none">
          {storeName}
        </div>
        <div className="text-[10px] font-bold text-gray-900 truncate mt-0.5 leading-tight">
          {productName}
        </div>
        {variantName && (
          <div className="text-[9px] font-extrabold text-[#0A0A0A] bg-amber-50 px-1 py-0.5 rounded border border-amber-200 inline-block mt-0.5 leading-none">
            {variantName}
          </div>
        )}
      </div>

      {/* Barcode Graphic */}
      <div className="w-full flex justify-center items-center my-0.5 overflow-hidden">
        <svg ref={svgRef} className="max-w-full h-auto" />
      </div>

      {/* Pricing Footer */}
      <div className="w-full flex items-center justify-between text-[9px] px-1 border-t border-gray-200 pt-0.5 leading-none">
        {mrp && mrp > price ? (
          <span className="text-gray-400 line-through text-[8px]">
            MRP {formatCurrency(mrp)}
          </span>
        ) : (
          <span className="text-gray-500 text-[8px]">CLAD RETAIL</span>
        )}
        <span className="font-black text-[11px] text-black">
          {formatCurrency(price)}
        </span>
      </div>
    </div>
  )
}
