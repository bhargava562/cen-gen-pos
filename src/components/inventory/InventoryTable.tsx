import React, { useState, useEffect } from 'react'
import {
  Search,
  SlidersHorizontal,
  Printer,
  History,
  QrCode,
  AlertTriangle,
  Package,
  Layers,
  RefreshCw,
  Plus
} from 'lucide-react'
import { inventoryService, type InventoryStockItem } from '../../services/inventoryService'
import { CreateBarcodeModal } from '../barcode/CreateBarcodeModal'
import { BarcodePrintModal } from '../barcode/BarcodePrintModal'
import { AdjustStockModal } from './AdjustStockModal'
import { StockHistoryDrawer } from './StockHistoryDrawer'
import { formatCurrency } from '../../lib/retail'

export const InventoryTable: React.FC = () => {
  const [items, setItems] = useState<InventoryStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_stock' | 'low' | 'out'>('all')

  // Modals state
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [selectedForReceive, setSelectedForReceive] = useState<{ productId: number; variantId?: string | null } | null>(null)

  const [printModalItem, setPrintModalItem] = useState<InventoryStockItem | null>(null)
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryStockItem | null>(null)
  const [historyDrawerItem, setHistoryDrawerItem] = useState<InventoryStockItem | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await inventoryService.fetchInventoryItems()
      setItems(data)
    } catch (err) {
      console.error('Failed to load inventory items:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter items
  const filtered = items.filter((item) => {
    const q = search.toLowerCase().trim()
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.variant_name && item.variant_name.toLowerCase().includes(q)) ||
      (item.barcode && item.barcode.toLowerCase().includes(q)) ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))

    if (!matchesSearch) return false

    if (filterStatus === 'out') return item.stock <= 0
    if (filterStatus === 'low') return item.stock > 0 && item.stock <= 5
    if (filterStatus === 'in_stock') return item.stock > 0

    return true
  })

  // Summary Metrics
  const totalSkus = items.length
  const totalUnits = items.reduce((sum, i) => sum + i.stock, 0)
  const outOfStockCount = items.filter((i) => i.stock <= 0).length
  const lowStockCount = items.filter((i) => i.stock > 0 && i.stock <= 5).length
  const totalValuation = items.reduce((sum, i) => sum + i.stock * i.price, 0)

  // Distinct products for receive modal
  const distinctProducts = Array.from(
    new Map(items.map((i) => [i.product_id, { id: i.product_id, name: i.name, price: i.price, stock_quantity: i.stock }])).values()
  )

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-[#E8D399] rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0A0A0A] text-[#D4AF37] flex items-center justify-center font-black">
            <Layers size={20} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">Total SKUs</div>
            <div className="text-xl font-black text-black">{totalSkus}</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8D399] rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-black">
            <Package size={20} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">Total Stock</div>
            <div className="text-xl font-black text-emerald-700">{totalUnits} Units</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8D399] rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-black">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">Low Stock (≤5)</div>
            <div className="text-xl font-black text-amber-700">{lowStockCount}</div>
          </div>
        </div>

        <div className="bg-white border border-[#E8D399] rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#FBFAF6] text-[#0A0A0A] border border-[#E8D399] flex items-center justify-center font-black text-sm">
            ₹
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">Stock Valuation</div>
            <div className="text-lg font-black text-[#0A0A0A]">{formatCurrency(totalValuation)}</div>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white border border-[#E8D399] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search SKU name, variant, barcode, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 bg-[#FBFAF6] text-xs font-bold text-gray-900 outline-none focus:border-[#0A0A0A] focus:bg-white"
          />
        </div>

        {/* Filter Badges & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#FBFAF6] border border-[#E8D399] p-1 rounded-xl gap-1 text-xs font-black">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'all' ? 'bg-[#0A0A0A] text-[#D4AF37]' : 'text-gray-600 hover:text-black'
              }`}
            >
              All ({totalSkus})
            </button>
            <button
              onClick={() => setFilterStatus('in_stock')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'in_stock' ? 'bg-[#0A0A0A] text-[#D4AF37]' : 'text-gray-600 hover:text-black'
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setFilterStatus('low')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'low' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:text-black'
              }`}
            >
              Low ({lowStockCount})
            </button>
            <button
              onClick={() => setFilterStatus('out')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'out' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:text-black'
              }`}
            >
              Out ({outOfStockCount})
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedForReceive(null)
              setShowReceiveModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0A0A] border border-[#D4AF37] text-[#D4AF37] font-black text-xs hover:bg-[#1A1A1A] transition-all shadow-sm cursor-pointer ml-auto"
          >
            <QrCode size={15} />
            Receive Stock &amp; Barcode
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#E8D399] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A0A0A] text-[#D4AF37] text-[10px] font-black uppercase tracking-wider">
                <th className="py-3 px-4">SKU / Item</th>
                <th className="py-3 px-3">Variant / Size</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Selling Price</th>
                <th className="py-3 px-3 text-center">Live Stock</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <RefreshCw size={20} className="animate-spin text-[#0A0A0A] mx-auto mb-2" />
                    Loading SKU inventory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No matching inventory SKUs found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isLow = item.stock > 0 && item.stock <= 5
                  const isOut = item.stock <= 0

                  return (
                    <tr key={item.id} className="hover:bg-[#FBFAF6]/80 transition-colors">
                      {/* Product Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-black">{item.name}</div>
                        {item.category && (
                          <div className="text-[10px] text-gray-500">{item.category}</div>
                        )}
                      </td>

                      {/* Variant */}
                      <td className="py-3.5 px-3">
                        {item.variant_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                            {item.variant_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">— Single SKU —</span>
                        )}
                      </td>

                      {/* Barcode */}
                      <td className="py-3.5 px-3">
                        {item.barcode ? (
                          <span className="font-mono text-[11px] font-black text-black bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {item.barcode}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedForReceive({
                                productId: item.product_id,
                                variantId: item.variant_id || null,
                              })
                              setShowReceiveModal(true)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 cursor-pointer"
                          >
                            <Plus size={11} /> Generate Barcode
                          </button>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-3 font-bold text-black">
                        {formatCurrency(item.price)}
                      </td>

                      {/* Live Stock */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${
                            isOut
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : isLow
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {item.stock} {item.unit || 'units'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Print labels */}
                          {item.barcode && (
                            <button
                              type="button"
                              onClick={() => setPrintModalItem(item)}
                              title="Print Barcode Labels"
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-[#0A0A0A] text-gray-700 hover:text-[#D4AF37] border border-gray-200 transition-all cursor-pointer"
                            >
                              <Printer size={15} />
                            </button>
                          )}

                          {/* Quick Receive / Restock */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedForReceive({
                                productId: item.product_id,
                                variantId: item.variant_id || null,
                              })
                              setShowReceiveModal(true)
                            }}
                            title="Receive Stock"
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-700 text-gray-700 hover:text-white border border-gray-200 transition-all cursor-pointer"
                          >
                            <QrCode size={15} />
                          </button>

                          {/* Adjust Stock */}
                          <button
                            type="button"
                            onClick={() => setAdjustModalItem(item)}
                            title="Adjust / Audit Stock"
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-800 text-gray-700 hover:text-white border border-gray-200 transition-all cursor-pointer"
                          >
                            <SlidersHorizontal size={15} />
                          </button>

                          {/* Movements History */}
                          <button
                            type="button"
                            onClick={() => setHistoryDrawerItem(item)}
                            title="Stock Movement Ledger"
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-800 text-gray-700 hover:text-white border border-gray-200 transition-all cursor-pointer"
                          >
                            <History size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Receive Stock & Barcode */}
      {showReceiveModal && (
        <CreateBarcodeModal
          isOpen={showReceiveModal}
          onClose={() => {
            setShowReceiveModal(false)
            setSelectedForReceive(null)
          }}
          products={distinctProducts}
          preselectedProductId={selectedForReceive?.productId}
          preselectedVariantId={selectedForReceive?.variantId}
          onSuccess={loadData}
        />
      )}

      {/* Modal: Print Barcode Labels */}
      {printModalItem && (
        <BarcodePrintModal
          isOpen={!!printModalItem}
          onClose={() => setPrintModalItem(null)}
          productName={printModalItem.name}
          variantName={printModalItem.variant_name}
          barcodeValue={printModalItem.barcode || ''}
          price={printModalItem.price}
          mrp={printModalItem.offer_price}
          defaultQuantity={Math.max(1, printModalItem.stock)}
        />
      )}

      {/* Modal: Adjust Stock */}
      {adjustModalItem && (
        <AdjustStockModal
          isOpen={!!adjustModalItem}
          onClose={() => setAdjustModalItem(null)}
          item={adjustModalItem}
          onSuccess={loadData}
        />
      )}

      {/* Drawer: Stock History */}
      {historyDrawerItem && (
        <StockHistoryDrawer
          isOpen={!!historyDrawerItem}
          onClose={() => setHistoryDrawerItem(null)}
          item={historyDrawerItem}
        />
      )}
    </div>
  )
}
