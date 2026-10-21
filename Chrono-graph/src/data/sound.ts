// Web Audio API Retro Arcade Sound Synthesizer (Zero External Dependencies)

class SoundEngine {
  private ctx: AudioContext | null = null
  private isMuted: boolean = true
  private ambienceOsc1: OscillatorNode | null = null
  private ambienceOsc2: OscillatorNode | null = null
  private isAmbiencePlaying: boolean = false
  private ambienceInterval: number | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  public getMuted(): boolean {
    return this.isMuted
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted
    if (muted) {
      this.stopAmbience()
    } else {
      this.getContext()
      this.startAmbience()
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted)
    return this.isMuted
  }

  // Quick 8-bit commit tick
  public playCommitTick(pitch = 880): void {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(pitch, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, ctx.currentTime + 0.02)

      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.04)
    } catch {
      // Audio context policy
    }
  }

  // Deep Earthquake sub-bass impact (80Hz -> 25Hz punch)
  public playEarthquakeBassHit(): void {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(95, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.6)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(140, ctx.currentTime)
      filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5)

      gain.gain.setValueAtTime(0.22, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.7)
    } catch {
      // Audio context policy
    }
  }

  // Ethereal retro synthwave ambience arpeggio
  public startAmbience(): void {
    if (this.isMuted || this.isAmbiencePlaying) return
    const ctx = this.getContext()
    if (!ctx) return

    this.isAmbiencePlaying = true
    const chords = [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [130.81, 164.81, 196.0], // C
      [196.0, 246.94, 293.66], // G
    ]
    let chordIdx = 0

    const playStep = () => {
      if (!this.isAmbiencePlaying || this.isMuted || !this.ctx) return
      const chord = chords[chordIdx % chords.length]
      chordIdx++

      chord.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime)

        gain.gain.setValueAtTime(0.008, this.ctx!.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx!.currentTime + 1.8)

        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.start(this.ctx!.currentTime + i * 0.15)
        osc.stop(this.ctx!.currentTime + 2.0)
      })
    }

    playStep()
    this.ambienceInterval = window.setInterval(playStep, 2400)
  }

  public stopAmbience(): void {
    this.isAmbiencePlaying = false
    if (this.ambienceInterval) {
      clearInterval(this.ambienceInterval)
      this.ambienceInterval = null
    }
    if (this.ambienceOsc1) {
      try {
        this.ambienceOsc1.stop()
      } catch {}
      this.ambienceOsc1 = null
    }
    if (this.ambienceOsc2) {
      try {
        this.ambienceOsc2.stop()
      } catch {}
      this.ambienceOsc2 = null
    }
  }
}

export const sound = new SoundEngine()
