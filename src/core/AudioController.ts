export class AudioController {
  private context?: AudioContext;
  muted = false;

  private ensure(): AudioContext | undefined {
    if (this.muted) return undefined;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  tone(frequency = 220, duration = 0.08, gain = 0.025, type: OscillatorType = 'square'): void {
    const context = this.ensure();
    if (!context) return;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    volume.gain.setValueAtTime(gain, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  alarm(): void {
    this.tone(150, 0.16, 0.04, 'sawtooth');
    window.setTimeout(() => this.tone(112, 0.2, 0.035, 'sawtooth'), 170);
  }

  toggle(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }
}
