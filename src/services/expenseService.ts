import { supabase } from '../lib/supabase'

export interface ExpenseRecord {
  id: string
  expense_date: string // YYYY-MM-DD
  category_id: number | null
  category_name: string
  amount: number
  description: string
  payment_mode?: string
  recorded_by_name?: string
  created_at: string
  updated_at?: string
}

export interface ExpenseCategory {
  id: number
  name: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface ExpenseSummaryMetrics {
  today: number
  this_week: number
  this_month: number
  this_year: number
  total_all_time: number
}

export interface ExpenseFilterPayload {
  fromDate?: string
  toDate?: string
  categoryId?: number | string
}

// Fallback seed categories if table is initially empty
export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Maintenance',
  'Marketing',
  'Other',
  'Rent',
  'Salaries',
  'Supplies',
]

export const expenseService = {
  // 1. Fetch KPI Metrics (with client-side fallback calculation)
  async getMetrics(): Promise<ExpenseSummaryMetrics> {
    try {
      const { data, error } = await supabase.rpc('get_expense_summary_metrics')
      if (!error && data) {
        return {
          today: Number(data.today) || 0,
          this_week: Number(data.this_week) || 0,
          this_month: Number(data.this_month) || 0,
          this_year: Number(data.this_year) || 0,
          total_all_time: Number(data.total_all_time) || 0,
        }
      }
    } catch {
      // Fallback to direct client aggregation if RPC is unavailable
    }

    // Client-side fallback aggregation
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('expense_date, amount')

    const expenses = allExpenses || []
    const todayStr = new Date().toISOString().slice(0, 10)

    const now = new Date()
    const dayOfWeek = (now.getDay() + 6) % 7 // Monday = 0
    const monday = new Date(now)
    monday.setDate(now.getDate() - dayOfWeek)
    const weekStartStr = monday.toISOString().slice(0, 10)

    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const yearStartStr = `${now.getFullYear()}-01-01`

    let today = 0
    let this_week = 0
    let this_month = 0
    let this_year = 0
    let total_all_time = 0

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0
      total_all_time += amt
      if (exp.expense_date === todayStr) today += amt
      if (exp.expense_date >= weekStartStr && exp.expense_date <= todayStr) this_week += amt
      if (exp.expense_date >= monthStartStr && exp.expense_date <= todayStr) this_month += amt
      if (exp.expense_date >= yearStartStr && exp.expense_date <= todayStr) this_year += amt
    }

    return { today, this_week, this_month, this_year, total_all_time }
  },

  // 2. Fetch Expenses with Date Filtering
  async getExpenses(filters?: ExpenseFilterPayload): Promise<ExpenseRecord[]> {
    let query = supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.fromDate) {
      query = query.gte('expense_date', filters.fromDate)
    }
    if (filters?.toDate) {
      query = query.lte('expense_date', filters.toDate)
    }
    if (filters?.categoryId && filters.categoryId !== 'all') {
      query = query.eq('category_id', filters.categoryId)
    }

    const { data, error } = await query
    if (error) {
      console.warn('Could not query expenses table:', error.message)
      return []
    }
    return (data || []) as ExpenseRecord[]
  },

  // 3. Record a New Expense
  async createExpense(payload: {
    expense_date: string
    category_id: number | null
    category_name: string
    amount: number
    description?: string
    payment_mode?: string
    recorded_by_name?: string
  }): Promise<ExpenseRecord> {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        expense_date: payload.expense_date,
        category_id: payload.category_id || null,
        category_name: payload.category_name.trim(),
        amount: Math.max(0.01, payload.amount),
        description: (payload.description || '').trim(),
        payment_mode: payload.payment_mode || 'cash',
        recorded_by_name: payload.recorded_by_name || 'Staff',
      })
      .select()
      .single()

    if (error) throw error
    return data as ExpenseRecord
  },

  // 4. Delete an Expense
  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
  },

  // 5. Category Operations
  async getCategories(): Promise<ExpenseCategory[]> {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.warn('Could not query expense_categories:', error.message)
      return DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({
        id: i + 1,
        name,
        is_active: true,
      }))
    }

    if (!data || data.length === 0) {
      // Auto seed default categories if empty
      try {
        const seeds = DEFAULT_EXPENSE_CATEGORIES.map(name => ({ name, is_active: true }))
        const { data: inserted } = await supabase.from('expense_categories').insert(seeds).select()
        return (inserted || []) as ExpenseCategory[]
      } catch {
        return DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({
          id: i + 1,
          name,
          is_active: true,
        }))
      }
    }

    return (data || []) as ExpenseCategory[]
  },

  async createCategory(name: string): Promise<ExpenseCategory> {
    const cleanName = name.trim()
    if (!cleanName) throw new Error('Category name cannot be empty')

    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ name: cleanName, is_active: true })
      .select()
      .single()

    if (error) throw error
    return data as ExpenseCategory
  },

  async deleteCategory(id: number): Promise<void> {
    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}

// 6. CSV Ledger Export Utility
export function exportExpensesToCSV(expenses: ExpenseRecord[]): void {
  const headers = ['Date', 'Category', 'Description', 'Amount (INR)', 'Recorded By']
  const rows = expenses.map(e => [
    e.expense_date,
    `"${(e.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    Number(e.amount || 0).toFixed(2),
    `"${(e.recorded_by_name || 'Staff').replace(/"/g, '""')}"`,
  ])

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const link = document.createElement('a')
  link.href = encodeURI(csvContent)
  link.download = `CLAD-Expenses-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
