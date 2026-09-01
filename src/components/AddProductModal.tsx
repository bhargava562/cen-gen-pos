import React, { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { useProductStore } from '../store/store'
import { supabase } from '../lib/supabase'
import { BRAND_EN } from '../lib/brand'

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const { fetchProducts, products } = useProductStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [categoryMode, setCategoryMode] = useState<'select' | 'new'>('select')
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
  })

  const existingCategories = categoryOptions.length > 0
    ? categoryOptions
    : Array.from(new Set(products.filter(p => p.category).map(p => p.category))).filter(Boolean).sort()

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const loadCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('name_en')
        .eq('is_active', true)
        .order('sort_order')
      if (!cancelled) setCategoryOptions((data || []).map(row => String(row.name_en || '')).filter(Boolean))
    }
    void loadCategories()
    return () => { cancelled = true }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return setError('Name is required')
    if (!formData.price || Number(formData.price) <= 0) return setError('Price must be greater than 0')

    setLoading(true)
    setError('')
    try {
      const categoryName = formData.category.trim()
      let categoryId: string | number | null = null
      if (categoryName) {
        const { data: existingCategory, error: categoryLookupError } = await supabase
          .from('categories')
          .select('id')
          .ilike('name_en', categoryName)
          .maybeSingle()
        if (categoryLookupError) throw categoryLookupError
        categoryId = existingCategory?.id ?? null
        if (!existingCategory) {
          const { data: insertedCategory, error: categoryInsertError } = await supabase
            .from('categories')
            .insert({ name_en: categoryName, name_ta: '', is_active: true })
            .select('id')
            .single()
          if (categoryInsertError) throw categoryInsertError
          categoryId = insertedCategory?.id ?? null
        }
      }

      // Products initialize with stock = 0. Stock enters through barcode receiving.
      const { error: dbErr } = await supabase.from('products').insert({
        name: formData.name.trim(),
        category: categoryName || 'Apparel',
        category_id: categoryId,
        price: Number(formData.price),
        stock: 0,
        stock_quantity: 0,
        is_active: true,
        unit: '1pc',
        base_quantity: 1,
        unit_type: 'unit',
        unit_label: 'pc'
      })

      if (dbErr) throw dbErr
      await fetchProducts()
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden border border-[#E8D399] animate-in fade-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-6 border-b border-[#D4AF37]/30 bg-[#0A0A0A] text-white">
          <div>
            <h2 className="text-lg font-black text-white">Add Product to {BRAND_EN}</h2>
            <p className="text-xs text-[#D4AF37] font-semibold">Initial stock will be added via Barcode Receiving</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && <div className="text-red-600 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-200">{error}</div>}

          <div>
            <label className="block text-[11px] font-black text-gray-700 tracking-wider uppercase mb-1.5">Product Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-[#FBFAF6] border-2 border-[#E8D399] rounded-xl focus:outline-none focus:border-[#0A0A0A] focus:bg-white text-sm font-bold text-black"
              placeholder="E.g. Men Slim Fit Cotton Shirt"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black text-gray-700 tracking-wider uppercase mb-1.5">Category</label>
              {categoryMode === 'select' ? (
                <div className="flex gap-1">
                  <select
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="flex-1 w-full px-3 py-3 bg-[#FBFAF6] border-2 border-[#E8D399] rounded-xl focus:outline-none focus:border-[#0A0A0A] focus:bg-white text-xs font-bold appearance-none text-black"
                  >
                    <option value="">Select category</option>
                    {existingCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setCategoryMode('new'); setFormData(f => ({...f, category: ''})) }}
                    className="px-2.5 py-3 text-xs font-black text-[#0A0A0A] bg-[#FBFAF6] border-2 border-[#E8D399] rounded-xl hover:bg-amber-100 transition-colors shrink-0"
                    title="Add new category"
                  >+</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="flex-1 w-full px-3 py-3 bg-[#FBFAF6] border-2 border-[#E8D399] rounded-xl focus:outline-none focus:border-[#0A0A0A] focus:bg-white text-xs font-bold text-black"
                    placeholder="Type category"
                  />
                  <button
                    type="button"
                    onClick={() => { setCategoryMode('select'); setFormData(f => ({...f, category: ''})) }}
                    className="px-2.5 py-3 text-xs font-black text-gray-700 bg-[#FBFAF6] border-2 border-[#E8D399] rounded-xl hover:bg-gray-200 transition-colors shrink-0"
                    title="Pick from existing"
                  >↩</button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-black text-gray-700 tracking-wider uppercase mb-1.5">Price (₹) <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                className="w-full px-4 py-3 bg-[#FBFAF6] border-2 border-[#E8D399] rounded-xl focus:outline-none focus:border-[#0A0A0A] focus:bg-white text-sm font-bold text-right text-black"
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="bg-[#FBFAF6] border border-[#E8D399] p-3 rounded-xl text-[11px] text-gray-600 flex items-start gap-2">
            <Sparkles size={14} className="text-[#B48811] shrink-0 mt-0.5" />
            <span>Product will be created with <strong>Stock: 0</strong>. Generate a barcode and receive stock units in the Inventory tab.</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3.5 bg-[#0A0A0A] border border-[#D4AF37] hover:bg-[#1A1A1A] text-[#D4AF37] rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-md cursor-pointer"
          >
            {loading ? 'Creating...' : 'Save Product'}
          </button>
        </form>
      </div>
    </div>
  )
}
