import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAdminAuthStore } from '../store/store'
import { BRAND_EN, BRAND_LOGO, BRAND_TA, BRAND_SUBTITLE } from '../lib/brand'
import { useLangStore } from '../store/langStore'

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang } = useLangStore()
  const l = (en: string, ta: string) => lang === 'ta' ? ta : en
  const login = useAdminAuthStore((state) => state.login)

  const [portalId, setPortalId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const role = await login(portalId.trim(), password)
    setLoading(false)
    if (role === 'admin') {
      const destination = from === '/pos' ? '/dashboard' : from
      navigate(destination, { replace: true })
    } else if (role === 'staff') {
      navigate('/dashboard', { replace: true })
    } else {
      setError(l('Invalid Admin or Staff credentials', 'தவறான நிர்வாகி அல்லது பணியாளர் விவரங்கள்'))
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A] px-4 py-8 font-sans text-white sm:px-6 lg:flex lg:items-center lg:justify-center">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#D4AF37]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[#D4AF37]/10 blur-3xl" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-[#D4AF37]/30 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.6)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden flex-col justify-between bg-[#0A0A0A] border-r border-[#D4AF37]/20 p-10 text-white lg:flex">
          <div>
            <div className="mb-8 inline-flex items-center justify-center rounded-2xl bg-[#141414] border border-[#D4AF37]/40 p-2 shadow-xl">
              <img src={BRAND_LOGO} alt={`${BRAND_EN} logo`} className="h-12 w-auto max-w-[180px] rounded-xl object-contain" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#D4AF37]">{BRAND_SUBTITLE}</p>
            <h2 className="mt-4 max-w-xs text-4xl font-black leading-tight tracking-tight text-white">Everything you need to run retail billing clearly.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/70">Manage barcodes, SKU variants, inventory ledger, POS billing, invoices, and customer communications from one secure portal.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37]"><ShieldCheck size={16} /> Secure retail workspace</div>
        </div>
        <div className="p-6 sm:p-10 lg:p-12 bg-white text-[#111111]">
          {/* Brand */}
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-[#0A0A0A] border border-[#D4AF37]/40 p-2 shadow-xl lg:hidden">
              <img src={BRAND_LOGO} alt={`${BRAND_EN} logo`} className="h-12 w-auto max-w-[160px] rounded-xl object-contain" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#B48811]">{BRAND_SUBTITLE}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#0A0A0A]">{BRAND_EN}</h1>
            <p className="mt-1 text-sm font-semibold text-[#7A786F]">{BRAND_TA}</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37] bg-[#FBFAF6] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#0A0A0A]">
              <ShieldCheck size={13} className="text-[#B48811]" />
              {l('Admin / Staff Portal', 'நிர்வாக நுழைவு')}
            </p>
          </div>

          {/* Server-level error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-[12px] mb-4 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <p className="text-[13px] font-bold text-[#111111]">{l('Enter your portal credentials', 'உங்கள் பயனர் விவரங்களை உள்ளிடவும்')}</p>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">
                <ShieldCheck size={14} />
                Portal ID
                <span className="font-black text-red-500">*</span>
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder="Enter portal ID"
                className="w-full rounded-2xl border-2 border-[#E8D399] bg-[#FBFAF6] px-4 py-3.5 text-sm font-semibold outline-none transition-colors placeholder:text-[#AAA69C] focus:border-[#0A0A0A] focus:bg-white text-[#111111]"
                value={portalId}
                onChange={(e) => { setPortalId(e.target.value); setError('') }}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
                <Lock size={14} />
                {l('Portal Password', 'நுழைவு கடவுச்சொல்')}
                <span className="text-red-500 font-black">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter portal password"
                  className="w-full rounded-2xl border-2 border-[#E8D399] bg-[#FBFAF6] px-4 py-3.5 pr-12 text-sm font-semibold outline-none transition-colors placeholder:text-[#AAA69C] focus:border-[#0A0A0A] focus:bg-white text-[#111111]"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111111] cursor-pointer"
                  aria-label={showPassword ? l('Hide password', 'கடவுச்சொல்லை மறை') : l('Show password', 'கடவுச்சொல்லை காட்டு')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] border border-[#D4AF37] py-3.5 font-black text-[#D4AF37] shadow-lg shadow-black/20 transition-all hover:bg-[#1A1A1A] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin inline-block" />
                  {l('Signing in...', 'உள்நுழைகிறது...')}
                </>
              ) : (
                <>
                  <Lock size={15} />
                  {l('Sign In to CLAD Portal', 'CLAD போர்ட்டலில் உள்நுழு')}
                </>
              )}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-[#888888]">
              {l('Enter your admin or staff credentials to access billing & inventory.', 'பில்லிங் மற்றும் சரக்கு இருப்பு நிர்வாகத்தை அணுக பயனர் விவரங்களை உள்ளிடவும்.')}
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
