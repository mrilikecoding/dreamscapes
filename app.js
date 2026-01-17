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
        this.isPaused = false;
        this.pausedVolumes = new Map(); // Store volumes before pausing

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
        this.setupPresetListeners();
        this.renderPresetsList();
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

        // Pause button
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.addEventListener('click', () => this.togglePause());

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
            this.updateFadeoutControlState();
        });

        // Fade-out toggle - enable/disable duration select
        const fadeoutToggle = document.getElementById('fadeoutToggle');
        const fadeoutDuration = document.getElementById('fadeoutDuration');
        fadeoutToggle.addEventListener('change', (e) => {
            fadeoutDuration.disabled = !e.target.checked;
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

        // Update pause button state
        this.updatePauseButtonState();
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

            // Update pause button state
            this.updatePauseButtonState();
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

            // Update pause button state
            this.updatePauseButtonState();
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
        slider.value = 0;  // Start at 0 - user drags up to desired level
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
        this.updateFadeoutControlState();
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerRemaining / 60);
        const seconds = this.timerRemaining % 60;
        const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('timerDisplay').textContent = display;
    }

    updateFadeoutControlState() {
        const timerValue = parseInt(document.getElementById('timerSelect').value);
        const fadeoutControl = document.getElementById('fadeoutControl');
        const fadeoutToggle = document.getElementById('fadeoutToggle');
        const fadeoutDuration = document.getElementById('fadeoutDuration');
        const hasTimer = timerValue > 0;

        if (hasTimer) {
            fadeoutControl.classList.remove('disabled');
            fadeoutToggle.disabled = false;
            fadeoutDuration.disabled = !fadeoutToggle.checked;
        } else {
            fadeoutControl.classList.add('disabled');
            fadeoutToggle.disabled = true;
            fadeoutDuration.disabled = true;
        }
    }

    fadeOutAndStop() {
        const fadeEnabled = document.getElementById('fadeoutToggle').checked;
        const startVolume = this.engine.volume;

        if (!fadeEnabled) {
            // Immediate stop
            this.stopSound();
            document.getElementById('timerSelect').value = '0';
            return;
        }

        // Gradual fade
        const fadeDurationSec = parseInt(document.getElementById('fadeoutDuration').value);
        const fadeDuration = fadeDurationSec * 1000;
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

    togglePause() {
        if (this.isPaused) {
            this.resumeSounds();
        } else {
            this.pauseSounds();
        }
    }

    pauseSounds() {
        if (this.activeSounds.size === 0) return;

        this.isPaused = true;
        this.pausedVolumes.clear();

        // Store current volumes
        this.activeSounds.forEach(soundType => {
            this.pausedVolumes.set(soundType, this.engine.getSoundVolume(soundType));
        });

        // Store master volume
        this.pausedMasterVolume = this.engine.volume;

        // Fade out all sounds over 3 seconds
        this.activeSounds.forEach(soundType => {
            this.engine.fadeSoundVolume(soundType, 0, 3000);
        });

        // Update UI
        const pauseBtn = document.getElementById('pauseBtn');
        const pauseIcon = document.getElementById('pauseIcon');
        pauseBtn.classList.add('paused');
        pauseIcon.textContent = '▶';
    }

    resumeSounds() {
        if (!this.isPaused) return;

        this.isPaused = false;

        // Fade in all sounds to their stored volumes over 3 seconds
        this.pausedVolumes.forEach((volume, soundType) => {
            this.engine.fadeSoundVolume(soundType, volume, 3000);
        });

        // Update UI
        const pauseBtn = document.getElementById('pauseBtn');
        const pauseIcon = document.getElementById('pauseIcon');
        pauseBtn.classList.remove('paused');
        pauseIcon.textContent = '⏸';
    }

    updatePauseButtonState() {
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.disabled = this.activeSounds.size === 0;

        // Reset pause state if no sounds
        if (this.activeSounds.size === 0) {
            this.isPaused = false;
            pauseBtn.classList.remove('paused');
            document.getElementById('pauseIcon').textContent = '⏸';
        }
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

    // ==========================================
    // Preset Management
    // ==========================================

    setupPresetListeners() {
        const saveBtn = document.getElementById('savePresetBtn');
        saveBtn.addEventListener('click', () => this.promptSavePreset());

        const randomBtn = document.getElementById('randomMixBtn');
        randomBtn.addEventListener('click', () => this.generateRandomMix());

        // Delegate click events for preset items
        const presetsList = document.getElementById('presetsList');
        presetsList.addEventListener('click', (e) => {
            const loadBtn = e.target.closest('.preset-load-btn');
            const deleteBtn = e.target.closest('.preset-delete-btn');

            if (loadBtn) {
                const presetId = loadBtn.dataset.presetId;
                this.loadPresetById(presetId);
            } else if (deleteBtn) {
                const presetId = deleteBtn.dataset.presetId;
                this.confirmDeletePreset(presetId);
            }
        });
    }

    getPresets() {
        const stored = localStorage.getItem('dreamscape_presets');
        return stored ? JSON.parse(stored) : [];
    }

    savePresetsToStorage(presets) {
        localStorage.setItem('dreamscape_presets', JSON.stringify(presets));
    }

    getCurrentMixState() {
        const sounds = {};
        this.activeSounds.forEach(soundType => {
            const volume = this.engine.getSoundVolume(soundType);
            sounds[soundType] = volume;
        });
        return {
            sounds,
            masterVolume: this.engine.volume,
            timer: parseInt(document.getElementById('timerSelect').value),
            fadeoutEnabled: document.getElementById('fadeoutToggle').checked,
            fadeoutDuration: parseInt(document.getElementById('fadeoutDuration').value)
        };
    }

    promptSavePreset() {
        if (this.activeSounds.size === 0) {
            alert('Please play at least one sound before saving a preset.');
            return;
        }

        const name = prompt('Enter a name for this preset:');
        if (name && name.trim()) {
            this.savePreset(name.trim());
        }
    }

    async generateRandomMix() {
        // Stop any current sounds
        this.stopSound();

        // Get all available sound types
        const allSounds = Object.keys(this.soundNames);

        // Pick random number of sounds (2-4)
        const numSounds = 2 + Math.floor(Math.random() * 3);

        // Shuffle and pick sounds
        const shuffled = allSounds.sort(() => Math.random() - 0.5);
        const selectedSounds = shuffled.slice(0, numSounds);

        // Generate random volumes (0.3 - 1.0 to ensure audible)
        const soundVolumes = selectedSounds.map(() => 0.3 + Math.random() * 0.7);

        // Random master volume (0.4 - 0.8)
        const masterVolume = 0.4 + Math.random() * 0.4;
        this.engine.setVolume(masterVolume);
        document.getElementById('volumeSlider').value = masterVolume * 100;

        // Play each sound
        for (let i = 0; i < selectedSounds.length; i++) {
            const soundType = selectedSounds[i];
            const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
            if (card) {
                await this.playSound(soundType, card);
                const slider = card.querySelector('.sound-volume-slider');
                if (slider) {
                    slider.value = soundVolumes[i] * 100;
                }
            }
        }

        // Small delay then fade in
        await new Promise(resolve => setTimeout(resolve, 50));

        for (let i = 0; i < selectedSounds.length; i++) {
            this.engine.fadeSoundVolume(selectedSounds[i], soundVolumes[i], 400);
        }
    }

    savePreset(name) {
        const mixState = this.getCurrentMixState();
        const preset = {
            id: `preset_${Date.now()}`,
            name,
            sounds: mixState.sounds,
            masterVolume: mixState.masterVolume,
            timer: mixState.timer,
            fadeoutEnabled: mixState.fadeoutEnabled,
            fadeoutDuration: mixState.fadeoutDuration,
            createdAt: Date.now()
        };

        const presets = this.getPresets();
        presets.push(preset);
        this.savePresetsToStorage(presets);
        this.renderPresetsList();
    }

    loadPresetById(presetId) {
        const presets = this.getPresets();
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            this.loadPreset(preset);
        }
    }

    async loadPreset(preset) {
        // Stop all current sounds first
        this.stopSound();

        // Set master volume
        this.engine.setVolume(preset.masterVolume);
        document.getElementById('volumeSlider').value = preset.masterVolume * 100;

        // Restore timer settings (with backwards compatibility for old presets)
        if (preset.timer !== undefined) {
            document.getElementById('timerSelect').value = preset.timer;
            this.setTimer(preset.timer);
        }

        // Restore fade-out settings (with backwards compatibility)
        if (preset.fadeoutEnabled !== undefined) {
            document.getElementById('fadeoutToggle').checked = preset.fadeoutEnabled;
        }
        if (preset.fadeoutDuration !== undefined) {
            document.getElementById('fadeoutDuration').value = preset.fadeoutDuration;
        }
        this.updateFadeoutControlState();

        // Play each sound (starts at volume 0)
        for (const [soundType, volume] of Object.entries(preset.sounds)) {
            const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
            if (card) {
                await this.playSound(soundType, card);
                // Update the slider to target volume
                const slider = card.querySelector('.sound-volume-slider');
                if (slider) {
                    slider.value = volume * 100;
                }
            }
        }

        // Small delay to ensure all sounds are playing, then fade in together
        await new Promise(resolve => setTimeout(resolve, 50));

        // Fade all sounds to their target volumes smoothly
        for (const [soundType, volume] of Object.entries(preset.sounds)) {
            this.engine.fadeSoundVolume(soundType, volume, 400);
        }
    }

    confirmDeletePreset(presetId) {
        const presets = this.getPresets();
        const preset = presets.find(p => p.id === presetId);
        if (preset && confirm(`Delete preset "${preset.name}"?`)) {
            this.deletePreset(presetId);
        }
    }

    deletePreset(presetId) {
        const presets = this.getPresets();
        const filtered = presets.filter(p => p.id !== presetId);
        this.savePresetsToStorage(filtered);
        this.renderPresetsList();
    }

    renderPresetsList() {
        const container = document.getElementById('presetsList');
        const emptyMsg = document.getElementById('presetsEmpty');
        const presets = this.getPresets();

        // Clear existing preset items (but keep the empty message element)
        container.querySelectorAll('.preset-item').forEach(el => el.remove());

        if (presets.length === 0) {
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';

        // Sort by most recent first
        presets.sort((a, b) => b.createdAt - a.createdAt);

        presets.forEach(preset => {
            const item = document.createElement('div');
            item.className = 'preset-item';

            const soundCount = Object.keys(preset.sounds).length;
            const soundNames = Object.keys(preset.sounds)
                .map(type => this.soundNames[type])
                .join(', ');

            // Build timer info string
            let timerInfo = '';
            if (preset.timer && preset.timer > 0) {
                const timerMins = preset.timer >= 60 ? `${preset.timer / 60}h` : `${preset.timer}m`;
                timerInfo = ` · ${timerMins} timer`;
                if (preset.fadeoutEnabled && preset.fadeoutDuration) {
                    const fadeSecs = preset.fadeoutDuration;
                    const fadeStr = fadeSecs >= 60 ? `${fadeSecs / 60}m` : `${fadeSecs}s`;
                    timerInfo += ` (${fadeStr} fade)`;
                }
            }

            item.innerHTML = `
                <div class="preset-info">
                    <span class="preset-name">${this.escapeHtml(preset.name)}</span>
                    <span class="preset-details">${soundCount} sound${soundCount !== 1 ? 's' : ''}: ${soundNames}${timerInfo}</span>
                </div>
                <div class="preset-actions">
                    <button class="preset-load-btn" data-preset-id="${preset.id}" title="Load preset">
                        <span>Load</span>
                    </button>
                    <button class="preset-delete-btn" data-preset-id="${preset.id}" title="Delete preset">
                        <span>&times;</span>
                    </button>
                </div>
            `;

            container.appendChild(item);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
