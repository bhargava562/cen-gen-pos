import React, { useState, useEffect, useRef } from 'react'
import { Camera, X, AlertCircle, Sparkles, ScanLine } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { barcodeService } from '../../services/barcodeService'
import { BRAND_EN } from '../../lib/brand'

export interface ScannedItemPayload {
  product_id: number
  variant_id?: string | null
  product_name: string
  name_ta?: string
  variant_name?: string
  price: number
  offer_price?: number
  stock: number
  barcode: string
  unit?: string
  image_url?: string
  category?: string
}

export interface BarcodeScannerInputProps {
  onItemScanned: (item: ScannedItemPayload) => void
  disabled?: boolean
}

export const BarcodeScannerInput: React.FC<BarcodeScannerInputProps> = ({
  onItemScanned,
  disabled = false,
}) => {
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastScannedName, setLastScannedName] = useState('')

  // Camera scanner state
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Hardware Scanner buffer
  const bufferRef = useRef<{ code: string; lastTime: number }>({ code: '', lastTime: 0 })

  // Audio Beep generator via Web Audio API
  const playBeep = (isSuccess = true) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = isSuccess ? 'sine' : 'square'
      osc.frequency.setValueAtTime(isSuccess ? 1800 : 300, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isSuccess ? 0.08 : 0.25))

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + (isSuccess ? 0.08 : 0.25))
    } catch {
      // Audio context might be restricted before first user interaction
    }
  }

  // Handle scanned barcode lookup
  const processBarcode = async (barcodeVal: string) => {
    const clean = barcodeVal.trim()
    if (!clean) return

    setLoading(true)
    setErrorMsg('')

    try {
      const record = await barcodeService.lookupBarcode(clean)

      if (!record || !record.product) {
        playBeep(false)
        setErrorMsg(`Barcode "${clean}" not recognized in ${BRAND_EN} catalog`)
        return
      }

      const prod = record.product
      const varnt = record.variant

      const effectiveStock = varnt ? (Number(varnt.stock) || 0) : 999 // Handled at cart level

      const price = varnt?.price ? Number(varnt.price) : Number(prod.price)

      const payload: ScannedItemPayload = {
        product_id: record.product_id,
        variant_id: record.variant_id || null,
        product_name: prod.name,
        name_ta: prod.name_ta,
        variant_name: varnt?.variant_name,
        price: price,
        offer_price: prod.offer_price ? Number(prod.offer_price) : undefined,
        stock: effectiveStock,
        barcode: clean,
        image_url: prod.image_url,
        category: prod.category,
      }

      playBeep(true)
      setLastScannedName(`${prod.name}${varnt?.variant_name ? ` (${varnt.variant_name})` : ''}`)
      onItemScanned(payload)
      setManualCode('')

      setTimeout(() => setLastScannedName(''), 3000)
    } catch (err) {
      console.error('Barcode lookup failed:', err)
      playBeep(false)
      setErrorMsg((err as Error).message || 'Failed to scan barcode')
    } finally {
      setLoading(false)
    }
  }

  // Hardware Scanner Listener (USB / Bluetooth barcode readers send rapid keybursts ending with Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on a normal text input (other than our hidden/scanner input), let it pass
      const target = e.target as HTMLElement
      const isOurInput = target === inputRef.current
      const isInputOrTextarea = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if (isInputOrTextarea && !isOurInput) {
        return
      }

      const now = Date.now()
      const diff = now - bufferRef.current.lastTime

      if (e.key === 'Enter') {
        if (bufferRef.current.code.length >= 3 && diff < 200) {
          e.preventDefault()
          const scannedCode = bufferRef.current.code
          bufferRef.current = { code: '', lastTime: 0 }
          processBarcode(scannedCode)
        } else {
          bufferRef.current = { code: '', lastTime: 0 }
        }
        return
      }

      // Printable single character
      if (e.key.length === 1) {
        // If keystroke arrived within 50ms of previous one, it's a hardware scanner burst
        if (diff > 100) {
          bufferRef.current.code = e.key
        } else {
          bufferRef.current.code += e.key
        }
        bufferRef.current.lastTime = now
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Camera scanner lifecycle
  useEffect(() => {
    if (!isCameraOpen) {
      if (readerRef.current) {
        // ZXing cleanup handled
      }
      return
    }

    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    let isMounted = true

    reader
      .decodeFromVideoDevice(undefined, videoRef.current || undefined, (result, _err) => {
        if (!isMounted) return
        if (result) {
          const text = result.getText()
          if (text) {
            setIsCameraOpen(false)
            processBarcode(text)
          }
        }
      })
      .catch((err) => {
        console.error('Camera barcode reader error:', err)
        setErrorMsg('Could not access camera for scanning')
      })

    return () => {
      isMounted = false
      // reader.reset()
    }
  }, [isCameraOpen])

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center gap-2">
        {/* Scanner Search Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (manualCode.trim()) processBarcode(manualCode.trim())
          }}
          className="relative flex-1 flex items-center"
        >
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37] flex items-center pointer-events-none">
            <ScanLine size={18} />
          </div>

          <input
            ref={inputRef}
            type="text"
            placeholder="Scan barcode (USB / Bluetooth / Manual)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            disabled={disabled || loading}
            className="w-full pl-10 pr-24 py-3 rounded-2xl border-2 border-[#E8D399] bg-[#FBFAF6] font-bold text-sm text-black placeholder:text-gray-400 outline-none focus:border-[#0A0A0A] focus:bg-white shadow-xs transition-all"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {manualCode && (
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-[#0A0A0A] text-[#D4AF37] text-xs font-black hover:bg-[#1A1A1A] cursor-pointer"
              >
                {loading ? '...' : 'Add'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              title="Scan with Device Camera"
              className="p-2 rounded-xl bg-white border border-[#E8D399] text-gray-700 hover:text-black hover:border-black transition-all cursor-pointer"
            >
              <Camera size={16} />
            </button>
          </div>
        </form>
      </div>

      {/* Success Notification Pill */}
      {lastScannedName && (
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full animate-in fade-in duration-150">
          <Sparkles size={13} className="text-emerald-600" />
          Scanned: <span className="font-black text-black">{lastScannedName}</span> (+1 qty)
        </div>
      )}

      {/* Error Notification Pill */}
      {errorMsg && (
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-300 px-3 py-1 rounded-full animate-in fade-in duration-150">
          <AlertCircle size={13} className="text-rose-600" />
          {errorMsg}
        </div>
      )}

      {/* Camera Scanner Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0A0A0A] rounded-3xl max-w-md w-full border border-[#D4AF37] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-white">
            <div className="px-5 py-4 border-b border-[#D4AF37]/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-[#D4AF37]" />
                <span className="font-black text-sm text-white">Camera Barcode Scanner</span>
              </div>
              <button
                onClick={() => setIsCameraOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col items-center">
              <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden border-2 border-[#D4AF37] bg-black">
                <video ref={videoRef} className="w-full h-full object-cover" />
                {/* Visual Laser Guide */}
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_red] animate-pulse" />
              </div>
              <p className="text-xs text-[#D4AF37] mt-3 text-center font-bold">
                Point camera at any barcode label on the garment / item
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
