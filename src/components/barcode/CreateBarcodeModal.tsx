import React, { useState, useEffect } from 'react'
import { X, QrCode, Plus, CheckCircle, AlertCircle, Printer, RefreshCw } from 'lucide-react'
import { barcodeService, type CreateBarcodeResponse } from '../../services/barcodeService'
import { fetchVariantsByProduct, createVariant, type ProductVariant } from '../../services/variantService'
import { BRAND_EN } from '../../lib/brand'
import { BarcodePrintModal } from './BarcodePrintModal'

interface ProductOption {
  id: number
  name: string
  price: number
  offer_price?: number
  barcode?: string
  stock_quantity?: number
}

export interface CreateBarcodeModalProps {
  isOpen: boolean
  onClose: () => void
  products: ProductOption[]
  preselectedProductId?: number
  preselectedVariantId?: string | null
  onSuccess?: () => void
}

export const CreateBarcodeModal: React.FC<CreateBarcodeModalProps> = ({
  isOpen,
  onClose,
  products,
  preselectedProductId,
  preselectedVariantId,
  onSuccess,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<number | ''>(preselectedProductId || '')
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)

  // 'existing' | 'new' | 'none'
  const [variantMode, setVariantMode] = useState<'existing' | 'new' | 'none'>('existing')
  const [selectedVariantId, setSelectedVariantId] = useState<string>(preselectedVariantId || '')
  const [newVariantName, setNewVariantName] = useState('')
  const [newVariantPrice, setNewVariantPrice] = useState<string>('')

  const [quantity, setQuantity] = useState<number>(20)
  const [unitCost, setUnitCost] = useState<string>('')
  const [note, setNote] = useState('')
  const [customBarcode, setCustomBarcode] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateBarcodeResponse | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  // Load variants whenever selected product changes
  useEffect(() => {
    if (!selectedProductId) {
      setVariants([])
      return
    }

    let isMounted = true
    setLoadingVariants(true)

    fetchVariantsByProduct(String(selectedProductId))
      .then((vars) => {
        if (isMounted) {
          setVariants(vars)
          if (vars.length > 0) {
            setVariantMode('existing')
            if (!selectedVariantId && vars[0]) {
              setSelectedVariantId(vars[0].id)
            }
          } else {
            setVariantMode('none')
            setSelectedVariantId('')
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch variants:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingVariants(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedProductId])

  if (!isOpen) return null

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId))
  const selectedVariant = variants.find((v) => v.id === selectedVariantId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedProductId) {
      setError('Please select a product')
      return
    }

    if (quantity <= 0) {
      setError('Quantity received must be greater than 0')
      return
    }

    setSubmitting(true)

    try {
      let finalVariantId: string | null = null

      // If user is creating a new variant on the fly
      if (variantMode === 'new') {
        const trimmedName = newVariantName.trim()
        if (!trimmedName) {
          throw new Error('Please enter a variant / SKU name (e.g. M, 42, Red, 500ml)')
        }

        const price = newVariantPrice ? parseFloat(newVariantPrice) : (selectedProduct?.price || 0)

        // Create variant with stock = 0
        const { data: createdVar, error: varErr } = await createVariant({
          productId: String(selectedProductId),
          variantName: trimmedName,
          price: price,
          stock: 0, // Stock will be added in barcode receiving transaction
        })

        if (varErr || !createdVar) {
          throw new Error(varErr || 'Failed to create new variant')
        }

        finalVariantId = createdVar.id
      } else if (variantMode === 'existing' && selectedVariantId) {
        finalVariantId = selectedVariantId
      }

      // Execute atomic barcode receiving transaction
      const response = await barcodeService.receiveStockWithBarcode({
        product_id: Number(selectedProductId),
        variant_id: finalVariantId,
        quantity_received: quantity,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        note: note.trim() || undefined,
        custom_barcode: customBarcode.trim() || undefined,
        created_by_name: 'Admin',
      })

      setResult(response)
      onSuccess?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetAndClose = () => {
    setResult(null)
    setError('')
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-xl w-full border border-[#E8D399] shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-[#0A0A0A] px-6 py-4 border-b border-[#D4AF37]/30 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
                <QrCode size={18} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-wide text-white">
                  Receive Stock &amp; Barcode ({BRAND_EN})
                </h2>
                <p className="text-xs text-[#D4AF37] font-semibold">
                  Receive incoming stock &amp; assign / reuse SKU barcode
                </p>
              </div>
            </div>
            <button
              onClick={handleResetAndClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Success Screen */}
          {result ? (
            <div className="p-6 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} />
              </div>

              <div>
                <h3 className="text-xl font-black text-[#0A0A0A]">
                  {result.is_new_barcode ? 'New Barcode Generated & Stock Added!' : 'Stock Restocked with Existing Barcode!'}
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  {result.movement_type === 'RESTOCK'
                    ? 'Existing SKU barcode was reused to avoid duplicate barcode IDs.'
                    : 'A unique SKU barcode was generated and linked.'}
                </p>
              </div>

              {/* Barcode Receipt Summary */}
              <div className="bg-[#FBFAF6] border border-[#E8D399] rounded-2xl p-4 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">Product:</span>
                  <span className="font-black text-black">{result.product_name}</span>
                </div>
                {result.variant_name && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-bold uppercase tracking-wider">Variant / SKU:</span>
                    <span className="font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      {result.variant_name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">Barcode Value:</span>
                  <span className="font-mono font-black text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-gray-300">
                    {result.barcode_value}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-gray-200 pt-2">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">Stock Update:</span>
                  <span className="font-black text-emerald-700">
                    {result.quantity_before} + {result.quantity_received} = {result.quantity_after} Units
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] font-black hover:bg-[#1A1A1A] transition-all shadow-md cursor-pointer"
                >
                  <Printer size={16} />
                  Print {result.quantity_received} Physical Stickers
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Receiving Form */
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5">
                  1. Select Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full py-3 px-3.5 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] font-bold text-sm text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant / SKU Selection */}
              {selectedProductId && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                      2. Variant / SKU Selection
                    </label>
                    <div className="flex gap-2 text-[11px] font-bold">
                      {variants.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setVariantMode('existing')}
                          className={`px-2 py-0.5 rounded-md border ${
                            variantMode === 'existing'
                              ? 'bg-[#0A0A0A] text-[#D4AF37] border-[#D4AF37]'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          Existing ({variants.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setVariantMode('new')}
                        className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                          variantMode === 'new'
                            ? 'bg-[#0A0A0A] text-[#D4AF37] border-[#D4AF37]'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        <Plus size={11} /> New SKU
                      </button>
                    </div>
                  </div>

                  {loadingVariants ? (
                    <div className="py-2 text-xs text-gray-500 flex items-center gap-2">
                      <RefreshCw size={12} className="animate-spin" /> Loading product variants...
                    </div>
                  ) : variantMode === 'existing' && variants.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={selectedVariantId}
                        onChange={(e) => setSelectedVariantId(e.target.value)}
                        className="w-full py-2.5 px-3 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] font-bold text-sm text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
                      >
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.variantName} {v.barcode ? `(Barcode: ${v.barcode})` : '(No barcode)'} — Stock: {v.stock}
                          </option>
                        ))}
                      </select>
                      {selectedVariant?.barcode && (
                        <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-semibold">
                          💡 Active barcode ({selectedVariant.barcode}) will be reused. Stock will be added as RESTOCK.
                        </p>
                      )}
                    </div>
                  ) : variantMode === 'new' ? (
                    <div className="bg-amber-50/50 border border-amber-200 p-3 rounded-xl space-y-2.5">
                      <div className="text-xs font-bold text-amber-900">
                        Create Arbitrary Variant (e.g. S, XXXL, 42, Maroon Gold, 500ml)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Variant Name (e.g. XXXL, 42, Blue)"
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          required
                          className="py-2 px-3 rounded-lg border border-gray-300 font-bold text-xs bg-white text-black outline-none focus:border-[#0A0A0A]"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder={`Price (Default: ₹${selectedProduct?.price || 0})`}
                          value={newVariantPrice}
                          onChange={(e) => setNewVariantPrice(e.target.value)}
                          className="py-2 px-3 rounded-lg border border-gray-300 font-bold text-xs bg-white text-black outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded-lg border border-gray-200">
                      Standard Product (Single SKU). Barcode &amp; stock will apply directly to the product.
                    </p>
                  )}
                </div>
              )}

              {/* Quantity & Unit Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1">
                    Quantity Received <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className="w-full py-2.5 px-3 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] font-black text-base text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1">
                    Purchase Unit Cost (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Optional cost price"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] font-bold text-sm text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
                  />
                </div>
              </div>

              {/* Optional Custom Barcode */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Custom Barcode (Optional — leave blank for auto-generation)
                </label>
                <input
                  type="text"
                  placeholder="Auto (e.g. PBV00010001)"
                  value={customBarcode}
                  onChange={(e) => setCustomBarcode(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-gray-300 bg-white font-mono text-xs text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Receipt Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vendor Invoice #412 or Stock batch from Trichy"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-gray-300 bg-white text-xs text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedProductId}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] font-black hover:bg-[#1A1A1A] transition-all shadow-md disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin inline-block" />
                      Receiving...
                    </>
                  ) : (
                    <>
                      <QrCode size={16} />
                      Receive Stock &amp; Generate Barcode
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Print Multi-Label Modal */}
      {result && showPrintModal && (
        <BarcodePrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          productName={result.product_name}
          variantName={result.variant_name}
          barcodeValue={result.barcode_value}
          price={selectedProduct?.price || 0}
          defaultQuantity={result.quantity_received}
        />
      )}
    </>
  )
}
