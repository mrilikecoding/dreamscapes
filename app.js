/**
 * Baby Sleep Sounds Application
 * Main application logic, UI control, and visualization
 */

class DreamscapeApp {
    constructor() {
        this.engine = new SleepSoundEngine();
        this.activeSounds = new Set(); // Set of active sound type strings
        this.timerInterval = null;
        this.timerRemaining = 0;
        this.visualizerActive = false;
        this.canvas = null;
        this.ctx = null;
        this.perlin = new PerlinNoise();
        this.time = 0;

        this.soundNames = {
            'white-noise': 'White Noise',
            'pink-noise': 'Pink Noise',
            'brown-noise': 'Brown Noise',
            'heartbeat': 'Heartbeat',
            'womb': 'Womb Sounds',
            'shush': 'Shushing',
            'rain': 'Gentle Rain',
            'ocean': 'Ocean Waves',
            'stream': 'Babbling Brook'
        };

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.startIdleAnimation();
    }

    setupCanvas() {
        this.canvas = document.getElementById('visualizerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    setupEventListeners() {
        // Sound card clicks
        document.querySelectorAll('.sound-card').forEach(card => {
            card.addEventListener('click', () => this.handleSoundClick(card));
        });

        // Volume control
        const volumeSlider = document.getElementById('volumeSlider');
        volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value / 100;
            this.engine.setVolume(value);
        });

        // Timer control
        const timerSelect = document.getElementById('timerSelect');
        timerSelect.addEventListener('change', (e) => {
            this.setTimer(parseInt(e.target.value));
        });

        // Handle page visibility change to save battery
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.engine.isPlaying) {
                // Continue playing audio but reduce visualization
                this.visualizerActive = false;
            } else if (!document.hidden && this.engine.isPlaying) {
                this.visualizerActive = true;
                this.startVisualization();
            }
        });
    }

    async handleSoundClick(card) {
        const soundType = card.dataset.sound;

        // If this sound is already active, toggle it off
        if (this.activeSounds.has(soundType)) {
            this.stopSound(soundType, card);
            return;
        }

        // Add this sound to the mix
        await this.playSound(soundType, card);
    }

    async playSound(soundType, card) {
        // Update UI - add active to this card (don't remove from others)
        card.classList.add('active');

        // Add to active sounds set
        this.activeSounds.add(soundType);

        // Update now playing display
        this.updateNowPlayingDisplay();
        document.getElementById('nowPlaying').classList.add('playing');

        // Play the sound
        await this.engine.play(soundType);

        // Add per-sound volume slider
        this.addVolumeSlider(card, soundType);

        // Start visualization
        this.visualizerActive = true;
        this.startVisualization();
    }

    stopSound(soundType = null, card = null) {
        if (soundType) {
            // Stop specific sound
            this.engine.stop(soundType);
            this.activeSounds.delete(soundType);

            // Update UI for this card only
            if (card) {
                card.classList.remove('active');
                this.removeVolumeSlider(card);
            } else {
                // Find and update the card if not provided
                const cardEl = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
                if (cardEl) {
                    cardEl.classList.remove('active');
                    this.removeVolumeSlider(cardEl);
                }
            }

            // Update now playing display
            this.updateNowPlayingDisplay();

            // If no sounds left, switch to idle
            if (this.activeSounds.size === 0) {
                document.getElementById('nowPlaying').classList.remove('playing');
                this.visualizerActive = false;
                this.startIdleAnimation();
                this.clearTimer();
            }
        } else {
            // Stop all sounds
            this.engine.stop();
            this.activeSounds.clear();

            // Update UI - remove active from all cards and remove sliders
            document.querySelectorAll('.sound-card').forEach(c => {
                c.classList.remove('active');
                this.removeVolumeSlider(c);
            });
            document.getElementById('currentSoundName').textContent = 'Select a sound';
            document.getElementById('nowPlaying').classList.remove('playing');

            // Switch to idle animation
            this.visualizerActive = false;
            this.startIdleAnimation();

            // Clear timer
            this.clearTimer();
        }
    }

    updateNowPlayingDisplay() {
        const displayEl = document.getElementById('currentSoundName');
        if (this.activeSounds.size === 0) {
            displayEl.textContent = 'Select a sound';
        } else {
            // Show comma-separated list of active sound names
            const names = Array.from(this.activeSounds).map(type => this.soundNames[type]);
            displayEl.textContent = names.join(', ');
        }
    }

    addVolumeSlider(card, soundType) {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'sound-volume-slider';
        slider.min = 0;
        slider.max = 100;
        slider.value = 100;
        slider.setAttribute('aria-label', `Volume for ${this.soundNames[soundType]}`);

        slider.addEventListener('input', (e) => {
            this.engine.setSoundVolume(soundType, e.target.value / 100);
        });

        // Prevent card click when interacting with slider
        slider.addEventListener('click', (e) => e.stopPropagation());

        card.appendChild(slider);
    }

    removeVolumeSlider(card) {
        const slider = card.querySelector('.sound-volume-slider');
        if (slider) {
            slider.remove();
        }
    }

    setTimer(minutes) {
        this.clearTimer();

        if (minutes === 0) {
            document.getElementById('timerDisplay').textContent = '';
            return;
        }

        this.timerRemaining = minutes * 60;
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.timerRemaining--;
            this.updateTimerDisplay();

            if (this.timerRemaining <= 0) {
                this.fadeOutAndStop();
            }
        }, 1000);
    }

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerRemaining = 0;
        document.getElementById('timerDisplay').textContent = '';
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerRemaining / 60);
        const seconds = this.timerRemaining % 60;
        const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timerDisplay').textContent = display;
    }

    fadeOutAndStop() {
        const fadeDuration = 10000; // 10 second fade
        const startVolume = this.engine.volume;
        const startTime = Date.now();

        const fadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / fadeDuration, 1);
            const newVolume = startVolume * (1 - progress);

            this.engine.setVolume(newVolume);
            document.getElementById('volumeSlider').value = newVolume * 100;

            if (progress >= 1) {
                clearInterval(fadeInterval);
                this.stopSound();
                document.getElementById('timerSelect').value = '0';
                // Reset volume for next play
                this.engine.setVolume(startVolume);
                document.getElementById('volumeSlider').value = startVolume * 100;
            }
        }, 100);
    }

    startVisualization() {
        if (!this.visualizerActive) return;

        const animate = () => {
            if (!this.visualizerActive || !this.engine.isPlaying) return;

            this.drawActiveVisualization();
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    drawActiveVisualization() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        // Clear canvas
        this.ctx.fillStyle = '#0f0f1a';
        this.ctx.fillRect(0, 0, width, height);

        // Get audio data
        const waveformData = this.engine.getWaveformData();
        const frequencyData = this.engine.getAnalyserData();

        // Draw frequency bars
        this.drawFrequencyBars(width, height, frequencyData);

        // Draw waveform
        this.drawWaveform(width, height, waveformData);

        this.time += 0.01;
    }

    drawFrequencyBars(width, height, data) {
        const barCount = Math.min(data.length, 64);
        const barWidth = width / barCount;
        const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.3)');
        gradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.6)');
        gradient.addColorStop(1, 'rgba(167, 139, 250, 0.8)');

        this.ctx.fillStyle = gradient;

        for (let i = 0; i < barCount; i++) {
            const value = data[i] / 255;
            const barHeight = value * height * 0.7;
            const x = i * barWidth;
            const y = height - barHeight;

            // Add some Perlin-based variation
            const perlinMod = 1 + 0.1 * this.perlin.noise1d(i * 0.1 + this.time);

            this.ctx.fillRect(x + 1, y, barWidth - 2, barHeight * perlinMod);
        }
    }

    drawWaveform(width, height, data) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(167, 139, 250, 0.8)';
        this.ctx.lineWidth = 2;

        const sliceWidth = width / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.stroke();

        // Add glow effect
        this.ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)';
        this.ctx.lineWidth = 6;
        this.ctx.stroke();
    }

    startIdleAnimation() {
        const animate = () => {
            if (this.visualizerActive) return;

            this.drawIdleAnimation();
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    drawIdleAnimation() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        // Clear canvas with fade effect
        this.ctx.fillStyle = 'rgba(15, 15, 26, 0.1)';
        this.ctx.fillRect(0, 0, width, height);

        // Draw gentle wave using Perlin noise
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
        this.ctx.lineWidth = 2;

        const centerY = height / 2;

        for (let x = 0; x < width; x++) {
            const noise = this.perlin.fbm(x * 0.01 + this.time * 0.3, 3, 2, 0.5);
            const y = centerY + noise * 30;

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        // Second wave layer
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(167, 139, 250, 0.2)';

        for (let x = 0; x < width; x++) {
            const noise = this.perlin.fbm(x * 0.008 + this.time * 0.2 + 100, 3, 2, 0.5);
            const y = centerY + noise * 20;

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        // Draw floating particles
        this.drawParticles(width, height);

        this.time += 0.02;
    }

    drawParticles(width, height) {
        const particleCount = 20;

        for (let i = 0; i < particleCount; i++) {
            const baseX = (this.perlin.noise1d(i * 100) * 0.5 + 0.5) * width;
            const baseY = (this.perlin.noise1d(i * 200) * 0.5 + 0.5) * height;

            const x = baseX + this.perlin.noise1d(this.time * 0.5 + i * 10) * 30;
            const y = baseY + this.perlin.noise1d(this.time * 0.3 + i * 20) * 20;

            const size = 2 + this.perlin.noise1d(i * 50) * 2;
            const alpha = 0.2 + this.perlin.noise1d(this.time + i) * 0.3;

            this.ctx.beginPath();
            this.ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DreamscapeApp();
});

// Handle first user interaction (required for Web Audio API)
let audioInitialized = false;
document.addEventListener('click', async () => {
    if (!audioInitialized && window.app) {
        await window.app.engine.initialize();
        audioInitialized = true;
    }
}, { once: true });
