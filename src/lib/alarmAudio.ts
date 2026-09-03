/**
 * Synthesized Web Audio API Alarm Sound Manager
 * Provides reliable, zero-latency, dependency-free audio alerts that run offline.
 */
class AlarmSoundManager {
  private ctx: AudioContext | null = null
  private intervalId: number | null = null
  private isAlarmPlaying: boolean = false

  private initContext() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  // Dual-tone urgent alert pulse (A5 -> E5)
  private playBeep() {
    if (!this.ctx) return

    try {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume()
      }

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sawtooth'
      // Dual tone: 880 Hz (A5) shifting to 659.25 Hz (E5)
      osc.frequency.setValueAtTime(880, this.ctx.currentTime)
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.15)

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start()
      osc.stop(this.ctx.currentTime + 0.36)
    } catch (err) {
      console.warn('AudioContext beep execution skipped:', err)
    }
  }

  public startAlert() {
    if (this.isAlarmPlaying) return
    this.initContext()
    this.isAlarmPlaying = true
    this.playBeep()

    // Repeat alert pulse every 1.5 seconds until silenced
    this.intervalId = window.setInterval(() => {
      this.playBeep()
    }, 1500)
  }

  public stopAlert() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isAlarmPlaying = false
  }

  public isPlaying() {
    return this.isAlarmPlaying
  }
}

export const alarmSound = new AlarmSoundManager()
