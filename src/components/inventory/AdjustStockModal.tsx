import React, { useState } from 'react'
import { X, SlidersHorizontal, AlertCircle, CheckCircle2 } from 'lucide-react'
import { inventoryService, type InventoryStockItem } from '../../services/inventoryService'
import { BRAND_EN } from '../../lib/brand'

export interface AdjustStockModalProps {
  isOpen: boolean
  onClose: () => void
  item: InventoryStockItem | null
  onSuccess?: () => void
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
}) => {
  const [newQuantity, setNewQuantity] = useState<number>(item ? item.stock : 0)
  const [reason, setReason] = useState<'RESTOCK' | 'DAMAGE' | 'CORRECTION' | 'RETURN'>('CORRECTION')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !item) return null

  const currentStock = item.stock
  const delta = newQuantity - currentStock

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newQuantity < 0) {
      setError('Stock quantity cannot be negative')
      return
    }

    setSubmitting(true)

    try {
      await inventoryService.adjustStock({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        new_quantity: newQuantity,
        reason: reason,
        note: note.trim() || undefined,
        created_by_name: 'Admin',
      })

      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to adjust stock'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-[#E8D399] shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#0A0A0A] px-6 py-4 border-b border-[#D4AF37]/30 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1A1A1A] border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-white">
                Adjust Inventory Stock ({BRAND_EN})
              </h2>
              <p className="text-xs text-[#D4AF37] font-semibold">
                Audit-tracked stock correction &amp; damage logging
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Item details card */}
          <div className="bg-[#FBFAF6] border border-[#E8D399] rounded-2xl p-3.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#B48811]">
              Target SKU
            </div>
            <div className="text-sm font-black text-black">{item.name}</div>
            {item.variant_name && (
              <div className="mt-1 inline-block text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                Variant: {item.variant_name}
              </div>
            )}
            <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-gray-600">
              <span>Current Stock: <strong className="text-black text-sm">{currentStock}</strong></span>
              {item.barcode && <span>Barcode: <strong className="font-mono text-black">{item.barcode}</strong></span>}
            </div>
          </div>

          {/* Reason picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5">
              Adjustment Reason <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['RESTOCK', 'DAMAGE', 'CORRECTION', 'RETURN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`py-2 px-2 rounded-xl text-xs font-black border transition-all ${
                    reason === r
                      ? 'bg-[#0A0A0A] text-[#D4AF37] border-[#D4AF37] shadow-sm'
                      : 'bg-[#FBFAF6] text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* New Stock Input */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5">
              New Total Stock Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewQuantity((q) => Math.max(0, q - 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                required
                className="flex-1 text-center font-black text-xl py-2.5 rounded-xl border-2 border-[#E8D399] bg-[#FBFAF6] focus:border-[#0A0A0A] focus:bg-white outline-none"
              />
              <button
                type="button"
                onClick={() => setNewQuantity((q) => q + 1)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-black font-black text-lg flex items-center justify-center border border-gray-300"
              >
                +
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-bold mt-1.5 px-1">
              <span className="text-gray-500">Difference (Delta):</span>
              <span
                className={`font-black ${
                  delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-gray-500'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} Units
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Adjustment Note / Reason Description
            </label>
            <input
              type="text"
              placeholder="e.g. Broken packaging, stock count reconciliation"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl border border-gray-300 bg-white text-xs text-gray-900 outline-none focus:border-[#0A0A0A]"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || delta === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] font-black hover:bg-[#1A1A1A] transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin inline-block" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Confirm Stock Adjustment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
