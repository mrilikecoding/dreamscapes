/**
 * Baby Sleep Sounds Audio Engine
 * Generates various noise types using Web Audio API
 * Uses Perlin noise for natural-sounding variation
 */

class SleepSoundEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeSounds = new Map(); // soundType → sound object
        this.volume = 0.5;
        this.perlin = new PerlinNoise();
        this.simplex = new SimplexNoise();
        this.animationFrame = null;
        this.time = 0;
    }

    get isPlaying() {
        return this.activeSounds.size > 0;
    }

    async initialize() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.audioContext.destination);

        // Resume context if suspended (required for autoplay policies)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    setVolume(value) {
        this.volume = value;
        if (this.masterGain) {
            // Smooth volume transition
            this.masterGain.gain.linearRampToValueAtTime(
                value,
                this.audioContext.currentTime + 0.1
            );
        }
    }

    setSoundVolume(soundType, value) {
        const sound = this.activeSounds.get(soundType);
        if (sound && sound.gainNode) {
            sound.gainNode.gain.linearRampToValueAtTime(
                value,
                this.audioContext.currentTime + 0.1
            );
        }
    }

    getSoundVolume(soundType) {
        const sound = this.activeSounds.get(soundType);
        if (sound && sound.gainNode) {
            return sound.gainNode.gain.value;
        }
        return 1.0; // Default volume
    }

    stop(soundType = null) {
        if (soundType) {
            // Stop specific sound
            const sound = this.activeSounds.get(soundType);
            if (sound) {
                sound.stop();
                this.activeSounds.delete(soundType);
            }
        } else {
            // Stop all sounds
            for (const sound of this.activeSounds.values()) {
                sound.stop();
            }
            this.activeSounds.clear();
        }

        // Clean up animation frame only when all sounds stopped
        if (!this.isPlaying && this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    async play(soundType) {
        await this.initialize();

        // If this sound is already playing, do nothing
        if (this.activeSounds.has(soundType)) {
            return;
        }

        const generators = {
            'white-noise': () => this.createWhiteNoise(),
            'pink-noise': () => this.createPinkNoise(),
            'brown-noise': () => this.createBrownNoise(),
            'heartbeat': () => this.createHeartbeat(),
            'womb': () => this.createWombSound(),
            'shush': () => this.createShushSound(),
            'rain': () => this.createRainSound(),
            'ocean': () => this.createOceanWaves(),
            'stream': () => this.createStreamSound()
        };

        if (generators[soundType]) {
            const sound = generators[soundType]();
            this.activeSounds.set(soundType, sound);
        }
    }

    /**
     * White Noise - Equal power across all frequencies
     * Uses AudioWorklet for efficient generation with Perlin modulation
     */
    createWhiteNoise() {
        const bufferSize = 2 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);

        // Generate white noise with subtle Perlin modulation
        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;
            const perlinMod = 1 + 0.1 * this.perlin.noise1d(t * 0.5);
            data[i] = (Math.random() * 2 - 1) * perlinMod;
        }

        return this.createLoopingSource(buffer);
    }

    /**
     * Pink Noise - Power decreases 3dB per octave (1/f spectrum)
     * Better for sleep - studies show improved deep sleep
     */
    createPinkNoise() {
        const bufferSize = 2 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);

        // Pink noise using Voss-McCartney algorithm
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;

            const t = i / this.audioContext.sampleRate;
            const perlinMod = 1 + 0.15 * this.perlin.fbm(t * 0.3, 3);

            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11 * perlinMod;
            b6 = white * 0.115926;
        }

        return this.createLoopingSource(buffer);
    }

    /**
     * Brown Noise - Power decreases 6dB per octave (1/f² spectrum)
     * Deep, rumbling sound like distant thunder
     */
    createBrownNoise() {
        const bufferSize = 2 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);

        let lastOut = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            const t = i / this.audioContext.sampleRate;
            const perlinMod = 1 + 0.2 * this.perlin.fbm(t * 0.2, 4);

            // Brown noise is integrated white noise
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            data[i] = lastOut * 3.5 * perlinMod;
        }

        // Apply low-pass filter for extra smoothness
        const source = this.createLoopingSource(buffer);

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        filter.Q.value = 0.5;

        // Reconnect: source → filter → gainNode → masterGain
        source.node.disconnect();
        source.gainNode.disconnect();
        source.node.connect(filter);
        filter.connect(source.gainNode);
        source.gainNode.connect(this.masterGain);

        return source;
    }

    /**
     * Heartbeat Sound - 70 BPM mimicking maternal heartbeat
     * Familiar and calming for newborns
     */
    createHeartbeat() {
        const bpm = 70;
        const beatDuration = 60 / bpm;
        const bufferDuration = beatDuration * 4; // 4 beats per loop
        const bufferSize = Math.floor(bufferDuration * this.audioContext.sampleRate);
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);

        for (let beat = 0; beat < 4; beat++) {
            const beatStart = Math.floor(beat * beatDuration * this.audioContext.sampleRate);

            // Add subtle variation with Perlin
            const variation = 1 + 0.05 * this.perlin.noise1d(beat * 0.5);

            // Lub (first heart sound) - longer, lower
            this.addHeartPulse(data, beatStart, 0.08, 60, 0.7 * variation);

            // Dub (second heart sound) - shorter, higher
            this.addHeartPulse(data, beatStart + Math.floor(0.15 * this.audioContext.sampleRate), 0.05, 80, 0.5 * variation);
        }

        // Add low-frequency rumble between beats
        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;
            data[i] += 0.05 * this.perlin.fbm(t * 2, 2) * Math.sin(t * 30);
        }

        const source = this.createLoopingSource(buffer);

        // Apply low-pass filter
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        filter.Q.value = 1;

        // Reconnect: source → filter → gainNode → masterGain
        source.node.disconnect();
        source.gainNode.disconnect();
        source.node.connect(filter);
        filter.connect(source.gainNode);
        source.gainNode.connect(this.masterGain);

        return source;
    }

    addHeartPulse(data, startSample, duration, frequency, amplitude) {
        const samples = Math.floor(duration * this.audioContext.sampleRate);
        for (let i = 0; i < samples && (startSample + i) < data.length; i++) {
            const t = i / this.audioContext.sampleRate;
            // Envelope: quick attack, slower decay
            const envelope = Math.exp(-t * 20) * (1 - Math.exp(-t * 100));
            data[startSample + i] += amplitude * envelope * Math.sin(2 * Math.PI * frequency * t);
        }
    }

    /**
     * Womb Sound - Low frequency rumble simulating intrauterine environment
     * The womb is surprisingly loud (~80-90 dB)
     */
    createWombSound() {
        const bufferSize = 4 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);

        // Multiple layers of low-frequency rumble
        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;

            // Base rumble using multiple sine waves
            let sample = 0;
            sample += 0.3 * Math.sin(2 * Math.PI * 25 * t);
            sample += 0.2 * Math.sin(2 * Math.PI * 40 * t);
            sample += 0.15 * Math.sin(2 * Math.PI * 60 * t);

            // Blood flow whooshing using Perlin noise
            const whoosh = this.perlin.fbm(t * 1.5, 4, 2, 0.6);
            sample += 0.25 * whoosh;

            // Add filtered noise
            const noise = (Math.random() * 2 - 1) * 0.1;
            sample += noise;

            // Modulate amplitude with slow breathing rhythm
            const breathMod = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.2 * t);

            data[i] = sample * breathMod;
        }

        const source = this.createLoopingSource(buffer);

        // Heavy low-pass filtering
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150;
        filter.Q.value = 0.7;

        // Reconnect: source → filter → gainNode → masterGain
        source.node.disconnect();
        source.gainNode.disconnect();
        source.node.connect(filter);
        filter.connect(source.gainNode);
        source.gainNode.connect(this.masterGain);

        return source;
    }

    /**
     * Shushing Sound - Rhythmic shush mimicking blood flow
     * Traditional calming technique backed by science
     */
    createShushSound() {
        const shushRate = 0.8; // Shushes per second
        const bufferDuration = 6; // 6 seconds
        const bufferSize = Math.floor(bufferDuration * this.audioContext.sampleRate);
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);

        const shushDuration = 0.6;
        const shushCount = Math.floor(bufferDuration * shushRate);

        for (let s = 0; s < shushCount; s++) {
            const startTime = s / shushRate;
            const startSample = Math.floor(startTime * this.audioContext.sampleRate);
            const samples = Math.floor(shushDuration * this.audioContext.sampleRate);

            // Add variation
            const variation = 1 + 0.1 * this.perlin.noise1d(s * 0.7);

            for (let i = 0; i < samples && (startSample + i) < bufferSize; i++) {
                const t = i / this.audioContext.sampleRate;

                // Envelope for shush
                const attack = 1 - Math.exp(-t * 30);
                const decay = Math.exp(-(t - 0.1) * 5);
                const envelope = Math.min(attack, decay);

                // Shush is filtered noise with frequency sweep
                const freqMod = 1 + 0.5 * (1 - t / shushDuration);
                const noise = Math.random() * 2 - 1;

                data[startSample + i] += envelope * noise * 0.5 * variation * freqMod;
            }
        }

        const source = this.createLoopingSource(buffer);

        // Band-pass filter for shush characteristics
        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 4000;

        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 500;

        // Reconnect: source → highpass → lowpass → gainNode → masterGain
        source.node.disconnect();
        source.gainNode.disconnect();
        source.node.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(source.gainNode);
        source.gainNode.connect(this.masterGain);

        return source;
    }

    /**
     * Rain Sound - Gentle rainfall with natural variation
     * Uses layered pink noise with Perlin modulation
     */
    createRainSound() {
        const bufferSize = 6 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(
            2, // Stereo
            bufferSize,
            this.audioContext.sampleRate
        );
        const dataL = buffer.getChannelData(0);
        const dataR = buffer.getChannelData(1);

        // Pink noise base for rain
        let b0L = 0, b1L = 0, b2L = 0, b3L = 0, b4L = 0, b5L = 0, b6L = 0;
        let b0R = 0, b1R = 0, b2R = 0, b3R = 0, b4R = 0, b5R = 0, b6R = 0;

        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;

            // Generate pink noise for left channel
            let whiteL = Math.random() * 2 - 1;
            b0L = 0.99886 * b0L + whiteL * 0.0555179;
            b1L = 0.99332 * b1L + whiteL * 0.0750759;
            b2L = 0.96900 * b2L + whiteL * 0.1538520;
            b3L = 0.86650 * b3L + whiteL * 0.3104856;
            b4L = 0.55000 * b4L + whiteL * 0.5329522;
            b5L = -0.7616 * b5L - whiteL * 0.0168980;

            // Generate pink noise for right channel (different random)
            let whiteR = Math.random() * 2 - 1;
            b0R = 0.99886 * b0R + whiteR * 0.0555179;
            b1R = 0.99332 * b1R + whiteR * 0.0750759;
            b2R = 0.96900 * b2R + whiteR * 0.1538520;
            b3R = 0.86650 * b3R + whiteR * 0.3104856;
            b4R = 0.55000 * b4R + whiteR * 0.5329522;
            b5R = -0.7616 * b5R - whiteR * 0.0168980;

            // Perlin modulation for natural variation (rain intensity)
            const intensityMod = 0.7 + 0.3 * this.perlin.fbm(t * 0.1, 3);

            // Occasional louder drops using simplex noise
            const dropChance = this.simplex.noise2d(t * 5, 0) * 0.5 + 0.5;
            const dropIntensity = dropChance > 0.9 ? 1.5 : 1;

            dataL[i] = (b0L + b1L + b2L + b3L + b4L + b5L + b6L + whiteL * 0.5362)
                       * 0.11 * intensityMod * dropIntensity;
            dataR[i] = (b0R + b1R + b2R + b3R + b4R + b5R + b6R + whiteR * 0.5362)
                       * 0.11 * intensityMod * dropIntensity;

            b6L = whiteL * 0.115926;
            b6R = whiteR * 0.115926;
        }

        const source = this.createLoopingSource(buffer);

        // Light filtering for rain character
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 6000;
        filter.Q.value = 0.5;

        // Reconnect: source → filter → gainNode → masterGain
        source.node.disconnect();
        source.gainNode.disconnect();
        source.node.connect(filter);
        filter.connect(source.gainNode);
        source.gainNode.connect(this.masterGain);

        return source;
    }

    /**
     * Ocean Waves - Rhythmic waves with natural variation
     * Uses amplitude modulation with Perlin noise
     */
    createOceanWaves() {
        const bufferSize = 12 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(
            2, // Stereo
            bufferSize,
            this.audioContext.sampleRate
        );
        const dataL = buffer.getChannelData(0);
        const dataR = buffer.getChannelData(1);

        // Wave parameters
        const waveFrequency = 0.08; // Waves per second

        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;

            // Wave envelope - smooth rise and fall
            const wavePhase = t * waveFrequency * 2 * Math.PI;
            const waveMod = Math.pow((Math.sin(wavePhase) + 1) / 2, 2);

            // Add Perlin variation to wave timing and intensity
            const waveVariation = 1 + 0.3 * this.perlin.fbm(t * 0.05, 4);

            // Generate brown noise base for wave sound
            const whiteL = Math.random() * 2 - 1;
            const whiteR = Math.random() * 2 - 1;

            // Filtered noise with wave modulation
            const noiseL = whiteL * waveMod * waveVariation;
            const noiseR = whiteR * waveMod * waveVariation;

            // Add low frequency rumble for wave body
            const rumble = 0.3 * Math.sin(wavePhase * 0.5) * this.perlin.fbm(t * 0.2, 2);

            // Subtle hiss for foam/spray (higher during wave peaks)
            const hiss = 0.1 * (Math.random() * 2 - 1) * Math.pow(waveMod, 3);

            dataL[i] = noiseL + rumble + hiss;
            dataR[i] = noiseR + rumble * 0.9 + hiss;
        }

        // Apply integration for brown noise effect
        let prevL = 0, prevR = 0;
        for (let i = 0; i < bufferSize; i++) {
            prevL = (prevL + dataL[i] * 0.02) / 1.02;
            prevR = (prevR + dataR[i] * 0.02) / 1.02;
            dataL[i] = prevL * 3;
            dataR[i] = prevR * 3;
        }

        const source = this.createLoopingSource(buffer);

        // Filter for ocean character
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.7;

        // Reconnect: source → filter → gainNode → masterGain
        source.node.disconnect();
        source.gainNode.disconnect();
        source.node.connect(filter);
        filter.connect(source.gainNode);
        source.gainNode.connect(this.masterGain);

        return source;
    }

    /**
     * Stream/Brook Sound - Gentle water with bubbling
     * Uses multiple layers with Perlin-modulated filtering
     */
    createStreamSound() {
        const bufferSize = 8 * this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(
            2,
            bufferSize,
            this.audioContext.sampleRate
        );
        const dataL = buffer.getChannelData(0);
        const dataR = buffer.getChannelData(1);

        // Generate pink noise base with gentle modulation
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;
            const white = Math.random() * 2 - 1;

            // Pink noise
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;

            let pinkNoise = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;

            // Flow modulation - gentle variations
            const flowMod = 0.8 + 0.2 * this.perlin.fbm(t * 0.3, 4);

            // Bubbling - occasional higher frequency bursts
            const bubbleChance = this.simplex.noise2d(t * 8, 0);
            const bubble = bubbleChance > 0.7 ?
                0.2 * Math.sin(2 * Math.PI * (800 + 400 * bubbleChance) * t) *
                Math.exp(-((t * 8) % 1) * 10) : 0;

            // Stereo variation
            const stereoOffset = 0.1 * this.perlin.noise1d(t * 2);

            dataL[i] = (pinkNoise * flowMod + bubble) * (1 + stereoOffset);
            dataR[i] = (pinkNoise * flowMod + bubble * 0.8) * (1 - stereoOffset);
        }

        const source = this.createLoopingSource(buffer);

        // Light high-pass to remove rumble, keep water character
        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 100;

        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 4000;

        // Reconnect: source → highpass → lowpass → gainNode → masterGain
        source.node.disconnect();
        source.gainNode.disconnect();
        source.node.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(source.gainNode);
        source.gainNode.connect(this.masterGain);

        return source;
    }

    createLoopingSource(buffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Create per-sound gain node for individual volume control
        // Start at 0 to allow fade-in and prevent audio pops
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0;

        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        source.start();

        return {
            node: source,
            gainNode: gainNode,
            stop: () => {
                source.stop();
                source.disconnect();
                gainNode.disconnect();
            }
        };
    }

    // Fade sound volume from current level to target over duration
    fadeSoundVolume(soundType, targetVolume, durationMs = 300) {
        const sound = this.activeSounds.get(soundType);
        if (sound && sound.gainNode) {
            sound.gainNode.gain.linearRampToValueAtTime(
                targetVolume,
                this.audioContext.currentTime + (durationMs / 1000)
            );
        }
    }

    // Get audio data for visualization
    getAnalyserData() {
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.masterGain.connect(this.analyser);
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    getWaveformData() {
        if (!this.analyser) {
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.masterGain.connect(this.analyser);
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);
        return dataArray;
    }
}

// Export
window.SleepSoundEngine = SleepSoundEngine;
