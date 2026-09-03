import { create } from 'zustand'
import { alarmSound } from '../lib/alarmAudio'

export interface LowStockItem {
  id: string | number
  name: string
  variantName?: string
  stock: number
  alertThreshold: number
  barcode?: string
  category?: string
}

interface AlarmState {
  lowStockItems: LowStockItem[]
  isAlarmActive: boolean
  silencedItemIds: Set<string | number>
  setLowStockItems: (items: LowStockItem[]) => void
  silenceAlarm: () => void
  resetSilencedState: () => void
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  lowStockItems: [],
  isAlarmActive: false,
  silencedItemIds: new Set<string | number>(),

  setLowStockItems: (items) => {
    const { silencedItemIds } = get()
    
    // Alarm triggers if there is at least one low-stock item that has not been acknowledged/silenced
    const hasUnsilencedLowStock = items.some(
      (item) => !silencedItemIds.has(item.id)
    )

    if (items.length > 0 && hasUnsilencedLowStock) {
      alarmSound.startAlert()
      set({ lowStockItems: items, isAlarmActive: true })
    } else {
      set({ lowStockItems: items })
      if (items.length === 0) {
        alarmSound.stopAlert()
        set({ isAlarmActive: false, silencedItemIds: new Set() })
      }
    }
  },

  silenceAlarm: () => {
    const currentItemIds = get().lowStockItems.map((i) => i.id)
    alarmSound.stopAlert()
    set({
      isAlarmActive: false,
      silencedItemIds: new Set(currentItemIds),
    })
  },

  resetSilencedState: () => {
    set({ silencedItemIds: new Set() })
  },
}))
