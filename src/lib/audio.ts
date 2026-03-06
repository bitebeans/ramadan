// A utility to play ascending sine wave tones for notifications using the Web Audio API
// No audio files needed, fulfilling the constraints.

class AudioNotifier {
    private audioContext: AudioContext | null = null;
    private isAllowed: boolean = false;

    public initialize(interactionEvent: boolean = true) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        // An audio context must be resumed after a user gesture
        if (this.audioContext.state === 'suspended' && interactionEvent) {
            this.audioContext.resume();
        }

        if (this.audioContext.state === 'running') {
            this.isAllowed = true;
        }
    }

    public async playNotificationPattern() {
        this.initialize(false);

        if (!this.audioContext || !this.isAllowed) {
            console.warn("Audio Context not allowed yet. User must interact first.");
            return;
        }

        const t = this.audioContext.currentTime;
        // Ascending major chord (C4, E4, G4, C5)
        this.playTone(261.63, t, 0.1);
        this.playTone(329.63, t + 0.1, 0.1);
        this.playTone(392.00, t + 0.2, 0.1);
        this.playTone(523.25, t + 0.3, 0.3);
    }

    private playTone(frequency: number, startTime: number, duration: number) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;

        // Envelope
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }
}

export const audioNotifier = new AudioNotifier();
