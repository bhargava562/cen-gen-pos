import React, { useState, useEffect } from 'react'
import { X, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { createVariant } from '../../services/variantService'

export interface CreatedItemResult {
  productId: number
  productName: string
  price: number
  costPrice?: number
  variantId?: string | null
  variantName?: string
  barcode?: string
}

interface QuickAddItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (item: CreatedItemResult) => void
}

export const QuickAddItemModal: React.FC<QuickAddItemModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<{ id: number; name_en: string }[]>([])

  const [itemType, setItemType] = useState<'Product' | 'Service'>('Product')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryMode, setCategoryMode] = useState<'select' | 'new'>('select')

  const [itemCode, setItemCode] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')

  const [hasVariants, setHasVariants] = useState(false)
  const [variantName, setVariantName] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    supabase
      .from('categories')
      .select('id, name_en')
      .eq('is_active', true)
      .order('name_en')
      .then(({ data }) => {
        if (isMounted && data) {
          setCategories(data)
        }
      })
    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAutoAssignCode = () => {
    const randomCode = 'CLAD' + Math.floor(1000000 + Math.random() * 9000000)
    setItemCode(randomCode)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Item Name is required')
      return
    }

    const priceNum = parseFloat(salePrice)
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Sale Price must be greater than 0')
      return
    }

    setLoading(true)

    try {
      let resolvedCategoryId: number | null = null
      if (categoryMode === 'new' && newCategoryName.trim()) {
        const catName = newCategoryName.trim()
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert({ name_en: catName, is_active: true })
          .select('id')
          .single()
        if (!catErr && newCat) {
          resolvedCategoryId = newCat.id
        }
      } else if (categoryId) {
        resolvedCategoryId = Number(categoryId)
      }

      const costNum = purchasePrice ? parseFloat(purchasePrice) : 0

      // Insert product with stock 0 (Stock intake happens via Barcode generator)
      const { data: newProd, error: prodErr } = await supabase
        .from('products')
        .insert({
          name: trimmedName,
          category_id: resolvedCategoryId,
          price: priceNum,
          offer_price: priceNum,
          purchase_price: costNum,
          has_variants: hasVariants,
          barcode: itemCode.trim() || null,
          stock_quantity: 0,
          stock: 0,
          is_active: true,
        })
        .select('id, name, price, barcode')
        .single()

      if (prodErr || !newProd) {
        throw new Error(prodErr?.message || 'Failed to create product')
      }

      let finalVariantId: string | null = null
      let finalVariantName: string | undefined = undefined

      if (hasVariants && variantName.trim()) {
        const { data: createdVar, error: varErr } = await createVariant({
          productId: String(newProd.id),
          variantName: variantName.trim(),
          price: priceNum,
          stock: 0,
        })
        if (!varErr && createdVar) {
          finalVariantId = createdVar.id
          finalVariantName = createdVar.variantName
        }
      }

      onSuccess({
        productId: newProd.id,
        productName: newProd.name,
        price: Number(newProd.price),
        costPrice: costNum,
        variantId: finalVariantId,
        variantName: finalVariantName,
        barcode: newProd.barcode || undefined,
      })
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while creating the item'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Top Header matching Screenshot 195258 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0A0A0A] text-white">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-black tracking-wide text-white">Add Item</h3>
            <div className="flex items-center bg-[#1A1A1A] border border-gray-700 rounded-lg p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setItemType('Product')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  itemType === 'Product' ? 'bg-[#D4AF37] text-[#0A0A0A]' : 'text-gray-400 hover:text-white'
                }`}
              >
                Product
              </button>
              <button
                type="button"
                onClick={() => setItemType('Service')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  itemType === 'Service' ? 'bg-[#D4AF37] text-[#0A0A0A]' : 'text-gray-400 hover:text-white'
                }`}
              >
                Service
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Item Name */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Linen Cotton Shirt or chips"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border-2 border-gray-200 bg-[#FBFAF6] text-sm font-bold text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
            />
          </div>

          {/* Category & Item Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setCategoryMode(categoryMode === 'select' ? 'new' : 'select')}
                  className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  {categoryMode === 'select' ? '+ New Category' : 'Select Existing'}
                </button>
              </div>
              {categoryMode === 'select' ? (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_en}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Enter new category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                Item Code / Barcode (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Auto if left blank"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-mono font-bold text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleAutoAssignCode}
                  className="shrink-0 px-2.5 h-10 rounded-xl bg-gray-100 border border-gray-300 text-[10px] font-black text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Assign Code
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="bg-[#FBFAF6] border border-gray-200 rounded-2xl p-4 space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Tag size={13} className="text-[#B48811]" /> Pricing Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                  Sale Price (₹ MRP) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-sm font-black text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                  Purchase / Cost Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>
          </div>

          {/* Optional Initial Variant */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
            <label className="flex items-center gap-2.5 text-xs font-black text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="accent-[#0A0A0A] w-4 h-4 rounded cursor-pointer"
              />
              Has Variants / Sizes (e.g. Clothing sizes, Colors, Pack sizes)
            </label>

            {hasVariants && (
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Initial Variant Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. M, 42, XXL, Red, Free Size"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] text-xs font-black uppercase tracking-wider hover:bg-[#1A1A1A] transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin inline-block" />
                  Saving...
                </>
              ) : (
                'Save & Select for Barcode'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
