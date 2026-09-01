import { supabase } from '../lib/supabase'

export interface InventoryStockItem {
  id: string // compound id: prod-{id} or var-{id}
  product_id: number
  variant_id?: string | null
  entity_type: 'product' | 'variant'
  name: string
  name_ta?: string
  variant_name?: string
  sku?: string
  barcode?: string
  stock: number
  price: number
  offer_price?: number
  unit?: string
  unit_type?: string
  category?: string
  image_url?: string
  is_active: boolean
  updated_at?: string
}

export interface InventoryMovement {
  id: number
  product_id: number
  variant_id?: string | null
  barcode_id?: string | null
  movement_type: 'INITIAL_BARCODE_STOCK' | 'RESTOCK' | 'SALE' | 'RETURN' | 'DAMAGE' | 'CORRECTION' | 'VOID'
  quantity_delta: number
  quantity_before: number
  quantity_after: number
  unit_cost?: number | null
  reference_type?: string | null
  reference_id?: string | null
  note?: string
  created_by_name: string
  created_at: string
  product?: {
    id: number
    name: string
    name_ta?: string
    image_url?: string
  }
  variant?: {
    id: string
    variant_name: string
    sku?: string
  }
}

export interface StockAdjustmentPayload {
  product_id: number
  variant_id?: string | null
  new_quantity: number
  reason: 'RESTOCK' | 'DAMAGE' | 'CORRECTION' | 'RETURN'
  note?: string
  created_by_name?: string
}

export const inventoryService = {
  /**
   * Fetch complete SKU/variant level inventory list.
   */
  async fetchInventoryItems(): Promise<InventoryStockItem[]> {
    // 1. Fetch products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, name, name_ta, price, offer_price, stock_quantity, unit, unit_type, category, image_url, barcode, sku, is_active, updated_at')
      .order('name', { ascending: true })

    if (prodErr) {
      console.error('[inventoryService.fetchInventoryItems] Products error:', prodErr)
      throw prodErr
    }

    // 2. Fetch variants
    const { data: variants, error: varErr } = await supabase
      .from('product_variants')
      .select('id, product_id, variant_name, price, purchase_price, stock, barcode, sku, is_active, updated_at')
      .order('sort_order', { ascending: true })

    if (varErr) {
      console.error('[inventoryService.fetchInventoryItems] Variants error:', varErr)
      throw varErr
    }

    const items: InventoryStockItem[] = []
    const variantsByProduct = new Map<number, typeof variants>()

    for (const v of variants || []) {
      const list = variantsByProduct.get(v.product_id) || []
      list.push(v)
      variantsByProduct.set(v.product_id, list)
    }

    for (const p of products || []) {
      const prodVariants = variantsByProduct.get(p.id)

      if (prodVariants && prodVariants.length > 0) {
        // Multi-variant product: each variant is a sellable SKU
        for (const v of prodVariants) {
          items.push({
            id: `var-${v.id}`,
            product_id: p.id,
            variant_id: v.id,
            entity_type: 'variant',
            name: p.name,
            name_ta: p.name_ta,
            variant_name: v.variant_name,
            sku: v.sku || p.sku,
            barcode: v.barcode,
            stock: Number(v.stock) || 0,
            price: Number(v.price) || Number(p.price) || 0,
            offer_price: p.offer_price ? Number(p.offer_price) : undefined,
            unit: p.unit,
            unit_type: p.unit_type,
            category: p.category,
            image_url: p.image_url,
            is_active: v.is_active && p.is_active,
            updated_at: v.updated_at || p.updated_at
          })
        }
      } else {
        // Non-variant product
        items.push({
          id: `prod-${p.id}`,
          product_id: p.id,
          variant_id: null,
          entity_type: 'product',
          name: p.name,
          name_ta: p.name_ta,
          variant_name: undefined,
          sku: p.sku,
          barcode: p.barcode,
          stock: Number(p.stock_quantity) || 0,
          price: Number(p.price) || 0,
          offer_price: p.offer_price ? Number(p.offer_price) : undefined,
          unit: p.unit,
          unit_type: p.unit_type,
          category: p.category,
          image_url: p.image_url,
          is_active: p.is_active,
          updated_at: p.updated_at
        })
      }
    }

    return items
  },

  /**
   * Adjust stock for an item with an audit log reason.
   */
  async adjustStock(payload: StockAdjustmentPayload) {
    const { data, error } = await supabase.rpc('adjust_inventory_stock', {
      p_product_id: payload.product_id,
      p_variant_id: payload.variant_id || null,
      p_new_quantity: payload.new_quantity,
      p_reason: payload.reason,
      p_note: payload.note || '',
      p_created_by_name: payload.created_by_name || 'Admin'
    })

    if (error) {
      console.error('[inventoryService.adjustStock] Error:', error)
      throw error
    }

    return data
  },

  /**
   * Fetch movement audit ledger logs.
   */
  async fetchMovements(params?: {
    product_id?: number
    variant_id?: string | null
    movement_type?: string
    limit?: number
    offset?: number
  }): Promise<{ movements: InventoryMovement[]; total: number }> {
    let query = supabase
      .from('inventory_movements')
      .select(`
        id, product_id, variant_id, barcode_id, movement_type, quantity_delta, quantity_before, quantity_after,
        unit_cost, reference_type, reference_id, note, created_by_name, created_at,
        product:products (id, name, name_ta, image_url),
        variant:product_variants (id, variant_name, sku)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (params?.product_id) {
      query = query.eq('product_id', params.product_id)
    }

    if (params?.variant_id) {
      query = query.eq('variant_id', params.variant_id)
    }

    if (params?.movement_type) {
      query = query.eq('movement_type', params.movement_type)
    }

    if (params?.limit) {
      const from = params.offset || 0
      const to = from + params.limit - 1
      query = query.range(from, to)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[inventoryService.fetchMovements] Error:', error)
      throw error
    }

    const movements = (data || []).map((m) => ({
      ...m,
      product: Array.isArray(m.product) ? m.product[0] : m.product,
      variant: Array.isArray(m.variant) ? m.variant[0] : m.variant
    })) as InventoryMovement[]

    return { movements, total: count || 0 }
  }
}
