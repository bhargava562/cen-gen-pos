import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAlarmStore, type LowStockItem } from '../store/alarmStore'

export function useLowStockMonitor() {
  const setLowStockItems = useAlarmStore((state) => state.setLowStockItems)
  const isCheckingRef = useRef(false)

  const checkStockLevels = async () => {
    if (isCheckingRef.current) return
    isCheckingRef.current = true

    try {
      // 1. Fetch non-variant active products (exclude Unregistered)
      const { data: prods, error: prodErr } = await supabase
        .from('products')
        .select('id, name, stock_quantity, alert_threshold, barcode, has_variants, category')
        .eq('is_active', true)
        .eq('has_variants', false)

      if (prodErr) {
        console.warn('Low stock product check warning:', prodErr)
      }

      // 2. Fetch active variants
      const { data: variants, error: varErr } = await supabase
        .from('product_variants')
        .select('id, variant_name, stock, barcode, product_id, is_active, products(name, category, is_active)')
        .eq('is_active', true)

      if (varErr) {
        console.warn('Low stock variant check warning:', varErr)
      }

      const flagged: LowStockItem[] = []

      // Check standard products
      for (const p of prods || []) {
        if (p.category && p.category.trim().toLowerCase() === 'unregistered') {
          continue
        }
        const threshold = Number(p.alert_threshold) > 0 ? Number(p.alert_threshold) : 5
        const currentStock = Number(p.stock_quantity) || 0

        if (currentStock <= threshold) {
          flagged.push({
            id: `p-${p.id}`,
            name: p.name,
            stock: currentStock,
            alertThreshold: threshold,
            barcode: p.barcode,
            category: p.category,
          })
        }
      }

      // Check product variants
      for (const v of variants || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentProd = v.products as any
        if (parentProd && parentProd.is_active === false) {
          continue
        }
        if (parentProd?.category && parentProd.category.trim().toLowerCase() === 'unregistered') {
          continue
        }

        const threshold = 5
        const currentStock = Number(v.stock) || 0

        if (currentStock <= threshold) {
          flagged.push({
            id: `v-${v.id}`,
            name: parentProd?.name ? `${parentProd.name}` : 'Product Variant',
            variantName: v.variant_name,
            stock: currentStock,
            alertThreshold: threshold,
            barcode: v.barcode,
            category: parentProd?.category,
          })
        }
      }

      setLowStockItems(flagged)
    } catch (err) {
      console.warn('Stock monitor error:', err)
    } finally {
      isCheckingRef.current = false
    }
  }

  useEffect(() => {
    // Initial check
    void checkStockLevels()

    // 20-second interval continuous stock monitor
    const interval = setInterval(() => {
      void checkStockLevels()
    }, 20000)

    return () => clearInterval(interval)
  }, [])
}
