import React, { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Check,
  Package,
  Tag,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProductStore, type Product } from '../../store/store'
import { fetchVariantsByProduct } from '../../services/variantService'
import { inventoryService, type CategoryRecord } from '../../services/inventoryService'

export interface VariantInputRow {
  id: string
  variantName: string
  sizeLabel?: string
  price: number
  costPrice: number
  noOfLabels: number
  customBarcode?: string
}

export const AddEditProductView: React.FC<{ onStockUpdated?: () => void }> = ({ onStockUpdated }) => {
  const { products, fetchProducts } = useProductStore()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [search, setSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [nameTa, setNameTa] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [price, setPrice] = useState<string>('')
  const [purchasePrice, setPurchasePrice] = useState<string>('')
  const [barcode, setBarcode] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [hasVariants, setHasVariants] = useState<boolean>(false)

  // Variants Rows for dynamic addition
  const [variantRows, setVariantRows] = useState<VariantInputRow[]>([])

  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    void fetchProducts()
    inventoryService.fetchCategories().then(setCategories).catch(console.error)
  }, [fetchProducts])

  const resetForm = () => {
    setSelectedProductId(null)
    setName('')
    setNameTa('')
    setCategoryId('')
    setPrice('')
    setPurchasePrice('')
    setBarcode('')
    setDescription('')
    setHasVariants(false)
    setVariantRows([])
    setStatusMessage(null)
  }

  const startEditProduct = async (p: Product) => {
    setSelectedProductId(Number(p.id))
    setName(p.name || '')
    setNameTa(p.nameTa || p.tamilName || '')
    setCategoryId(p.categoryId ? Number(p.categoryId) : '')
    setPrice(String(p.price || ''))
    setPurchasePrice(String(p.purchasePrice || ''))
    setBarcode(p.barcode || '')
    setDescription(p.description || '')
    setHasVariants(Boolean(p.hasVariants))
    setStatusMessage(null)

    if (p.hasVariants) {
      try {
        const vars = await fetchVariantsByProduct(String(p.id))
        setVariantRows(
          vars.map((v) => ({
            id: v.id,
            variantName: v.variantName,
            sizeLabel: v.sizeLabel || v.variantName,
            price: v.price,
            costPrice: v.purchasePrice || 0,
            noOfLabels: 0,
            customBarcode: v.barcode || '',
          }))
        )
      } catch (err) {
        console.error('Failed to load variants for edit:', err)
      }
    } else {
      setVariantRows([])
    }
  }

  const handleAddVariantRow = () => {
    const baseP = parseFloat(price) || 0
    const baseC = parseFloat(purchasePrice) || 0
    setVariantRows((prev) => [
      ...prev,
      {
        id: `var_${Date.now()}_${Math.random()}`,
        variantName: '',
        sizeLabel: '',
        price: baseP,
        costPrice: baseC,
        noOfLabels: 5,
        customBarcode: '',
      },
    ])
  }

  const handleRemoveVariantRow = (id: string) => {
    setVariantRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleUpdateVariantRow = (
    id: string,
    field: keyof VariantInputRow,
    value: string | number
  ) => {
    setVariantRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMessage(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setStatusMessage({ type: 'error', text: 'Product Name is required' })
      return
    }

    const firstVariant = variantRows.find(v => v.variantName.trim())
    const priceNum = hasVariants && firstVariant ? (Number(firstVariant.price) || 0) : (parseFloat(price) || 0)
    const costNum = hasVariants && firstVariant ? (Number(firstVariant.costPrice) || 0) : (parseFloat(purchasePrice) || 0)

    if (!hasVariants && priceNum <= 0) {
      setStatusMessage({ type: 'error', text: 'Price must be greater than 0' })
      return
    }

    if (hasVariants && (!variantRows.length || variantRows.some(v => !v.variantName.trim()))) {
      setStatusMessage({ type: 'error', text: 'Please provide names for all added variants' })
      return
    }

    setLoading(true)

    try {
      if (selectedProductId) {
        // UPDATE EXISTING PRODUCT
        const { error: updErr } = await supabase
          .from('products')
          .update({
            name: trimmedName,
            name_ta: nameTa.trim() || '',
            category_id: categoryId ? Number(categoryId) : 1,
            price: priceNum,
            offer_price: priceNum,
            purchase_price: costNum,
            barcode: (!hasVariants && barcode.trim()) ? barcode.trim() : null,
            description: description.trim() || '',
            has_variants: hasVariants && variantRows.length > 0,
          })
          .eq('id', selectedProductId)

        if (updErr) throw updErr

        // Process variant rows
        if (hasVariants && variantRows.length > 0) {
          for (const v of variantRows) {
            if (!v.variantName.trim()) continue

            const vPrice = Number(v.price) > 0 ? Number(v.price) : priceNum
            const vCost = Number(v.costPrice) > 0 ? Number(v.costPrice) : costNum
            const vQty = Math.max(0, v.noOfLabels || 0)

            if (v.id.startsWith('var_')) {
              // Insert newly added variant
              const { data: createdVar, error: vErr } = await supabase
                .from('product_variants')
                .insert({
                  product_id: selectedProductId,
                  variant_name: v.variantName.trim(),
                  size_label: v.sizeLabel?.trim() || v.variantName.trim(),
                  price: vPrice,
                  purchase_price: vCost,
                  stock: 0,
                  is_active: true,
                })
                .select()
                .single()

              if (!vErr && createdVar && vQty > 0) {
                await supabase.rpc('create_barcode_and_receive_stock', {
                  p_product_id: selectedProductId,
                  p_variant_id: createdVar.id,
                  p_quantity_received: vQty,
                  p_unit_cost: vCost || null,
                  p_created_by_name: 'Admin',
                  p_custom_barcode: v.customBarcode?.trim() || null,
                  p_note: `Added variant ${v.variantName.trim()}`,
                })
              }
            } else {
              // Update existing variant
              await supabase
                .from('product_variants')
                .update({
                  variant_name: v.variantName.trim(),
                  size_label: v.sizeLabel?.trim() || v.variantName.trim(),
                  price: vPrice,
                  purchase_price: vCost,
                })
                .eq('id', v.id)

              if (vQty > 0) {
                await supabase.rpc('create_barcode_and_receive_stock', {
                  p_product_id: selectedProductId,
                  p_variant_id: v.id,
                  p_quantity_received: vQty,
                  p_unit_cost: vCost || null,
                  p_created_by_name: 'Admin',
                  p_custom_barcode: v.customBarcode?.trim() || null,
                  p_note: `Received stock for variant ${v.variantName.trim()}`,
                })
              }
            }
          }
        }

        setStatusMessage({ type: 'success', text: `Product "${trimmedName}" updated successfully!` })
      } else {
        // CREATE NEW PRODUCT
        const { data: newProd, error: insErr } = await supabase
          .from('products')
          .insert({
            name: trimmedName,
            name_ta: nameTa.trim() || '',
            category_id: categoryId ? Number(categoryId) : 1,
            price: priceNum,
            offer_price: priceNum,
            purchase_price: costNum,
            barcode: (!hasVariants && barcode.trim()) ? barcode.trim() : null,
            description: description.trim() || '',
            has_variants: hasVariants && variantRows.length > 0,
            stock_quantity: 0,
            stock: 0,
            is_active: true,
          })
          .select('id, name')
          .single()

        if (insErr || !newProd) throw insErr || new Error('Failed to create product')

        // Process variants if any
        if (hasVariants && variantRows.length > 0) {
          for (const v of variantRows) {
            if (v.variantName.trim()) {
              const vPrice = Number(v.price) > 0 ? Number(v.price) : priceNum
              const vCost = Number(v.costPrice) > 0 ? Number(v.costPrice) : costNum
              const vQty = Math.max(0, v.noOfLabels || 0)

              const { data: createdVar, error: vErr } = await supabase
                .from('product_variants')
                .insert({
                  product_id: newProd.id,
                  variant_name: v.variantName.trim(),
                  size_label: v.sizeLabel?.trim() || v.variantName.trim(),
                  price: vPrice,
                  purchase_price: vCost,
                  stock: 0,
                  is_active: true,
                })
                .select()
                .single()

              if (!vErr && createdVar && vQty > 0) {
                await supabase.rpc('create_barcode_and_receive_stock', {
                  p_product_id: newProd.id,
                  p_variant_id: createdVar.id,
                  p_quantity_received: vQty,
                  p_unit_cost: vCost || null,
                  p_created_by_name: 'Admin',
                  p_custom_barcode: v.customBarcode?.trim() || null,
                  p_note: `Initial intake of variant ${v.variantName.trim()}`,
                })
              }
            }
          }
        }

        setStatusMessage({ type: 'success', text: `Product "${trimmedName}" created successfully with barcodes!` })
        resetForm()
      }

      await fetchProducts()
      onStockUpdated?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while saving'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* 2-Column Catalog Editor Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* LEFT COLUMN: Products Browser List */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-[#FAFAFA] flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-800">
              Product Catalog ({products.length})
            </h4>
          </div>

          <div className="p-3 border-b border-gray-100 bg-[#FBFAF6]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products, SKUs, barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
              />
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto divide-y divide-gray-100">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-bold">
                No products found.
              </div>
            ) : (
              filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => startEditProduct(p)}
                  className={`p-3.5 hover:bg-[#FBFAF6] cursor-pointer flex items-center justify-between transition-colors ${
                    selectedProductId === Number(p.id) ? 'bg-[#FFF9E6] border-l-4 border-[#D4AF37]' : ''
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs text-gray-900 truncate">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      {p.category || 'General'} {p.hasVariants ? '• Multi-variant' : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-xs text-gray-900">₹{p.price}</span>
                    <span className="block text-[10px] text-emerald-700 font-bold">
                      Stock: {p.stockQuantity ?? p.stock ?? 0}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Product Authoring Form */}
        <div className="bg-[#FBFAF6] border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                <Package size={16} className="text-[#D4AF37]" />
                {selectedProductId ? 'Edit Product & SKU Details' : 'Add New Product to Catalog'}
              </h3>
              <p className="text-xs text-gray-500 font-semibold">
                Configure pricing, categories, and dynamic variant barcodes
              </p>
            </div>
            {selectedProductId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                + Create Another
              </button>
            )}
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button onClick={() => setStatusMessage(null)} className="font-black">✕</button>
            </div>
          )}

          <form onSubmit={handleSaveProduct} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                  Product Name (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Linen Cotton Shirt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                  Tamil Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. காட்டன் சட்டை"
                  value={nameTa}
                  onChange={(e) => setNameTa(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            {/* Category & Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {!hasVariants && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                    Barcode (Optional - Auto if blank)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PBP00000001"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-300 bg-white text-xs font-mono font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              )}
            </div>

            {/* Pricing Section (Standard Products Only) */}
            {!hasVariants && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                  <Tag size={13} className="text-[#D4AF37]" /> Pricing &amp; Margin
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-700 mb-1">
                      Sale Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
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
            )}

            {/* Multi-Variant Section */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 text-xs font-black text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => setHasVariants(e.target.checked)}
                    className="accent-[#0A0A0A] w-4 h-4 rounded cursor-pointer"
                  />
                  Product Has Multiple Variants / Sizes
                </label>
                {hasVariants && (
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-[#D4AF37] border border-[#D4AF37] text-xs font-black flex items-center gap-1.5 hover:bg-[#1A1A1A] transition-all cursor-pointer shadow-xs"
                  >
                    <Plus size={13} /> Add Variant
                  </button>
                )}
              </div>

              {hasVariants && (
                <div className="pt-2 space-y-3 border-t border-gray-100">
                  <p className="text-[11px] text-gray-500 font-semibold">
                    Each variant will maintain its own SKU barcode and stock level:
                  </p>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {variantRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="p-3 bg-[#FBFAF6] border border-gray-200 rounded-xl grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2.5 items-end"
                      >
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 mb-0.5">
                            Variant #{idx + 1} Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. S, M, 42, Red"
                            value={row.variantName}
                            onChange={(e) =>
                              handleUpdateVariantRow(row.id, 'variantName', e.target.value)
                            }
                            className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 mb-0.5">
                            Sale Price (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={price || '0'}
                            value={row.price || ''}
                            onChange={(e) =>
                              handleUpdateVariantRow(row.id, 'price', parseFloat(e.target.value) || 0)
                            }
                            className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs font-black text-gray-900 outline-none focus:border-[#0A0A0A]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 mb-0.5">
                            Cost (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={purchasePrice || '0'}
                            value={row.costPrice || ''}
                            onChange={(e) =>
                              handleUpdateVariantRow(row.id, 'costPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-gray-700 mb-0.5">
                            Stock (Labels)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={row.noOfLabels}
                            onChange={(e) =>
                              handleUpdateVariantRow(row.id, 'noOfLabels', parseInt(e.target.value) || 0)
                            }
                            className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs font-black text-center text-gray-900 outline-none focus:border-[#0A0A0A]"
                          />
                        </div>

                        <div className="pb-0.5">
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantRow(row.id)}
                            disabled={variantRows.length <= 1}
                            className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
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
                    Saving Product...
                  </>
                ) : (
                  <>
                    <Check size={14} /> {selectedProductId ? 'Update Product' : 'Save & Add Product'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
