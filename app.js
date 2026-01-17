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

        // Screensaver state
        this.screensaverActive = false;
        this.screensaverCanvas = null;
        this.screensaverCtx = null;
        this.screensaverMode = 'stars';
        this.screensaverAnimationId = null;
        this.screensaverEntities = [];

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
        this.setupScreensaver();
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

    // ==========================================
    // Screensaver
    // ==========================================

    setupScreensaver() {
        this.screensaverCanvas = document.getElementById('screensaverCanvas');
        this.screensaverCtx = this.screensaverCanvas.getContext('2d');

        const overlay = document.getElementById('screensaverOverlay');
        const btn = document.getElementById('screensaverBtn');
        const modeSelect = document.getElementById('screensaverMode');

        btn.addEventListener('click', () => this.startScreensaver());
        overlay.addEventListener('click', () => this.stopScreensaver());

        modeSelect.addEventListener('change', (e) => {
            this.screensaverMode = e.target.value;
            if (this.screensaverActive) {
                this.initScreensaverEntities();
            }
        });

        // Handle resize
        window.addEventListener('resize', () => {
            if (this.screensaverActive) {
                this.resizeScreensaverCanvas();
                this.initScreensaverEntities();
            }
        });
    }

    resizeScreensaverCanvas() {
        this.screensaverCanvas.width = window.innerWidth * window.devicePixelRatio;
        this.screensaverCanvas.height = window.innerHeight * window.devicePixelRatio;
        this.screensaverCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    startScreensaver() {
        this.screensaverActive = true;
        this.screensaverMode = document.getElementById('screensaverMode').value;

        const overlay = document.getElementById('screensaverOverlay');
        overlay.classList.add('active');
        overlay.classList.remove('hide-hint');

        // Hide hint after 3 seconds
        setTimeout(() => {
            overlay.classList.add('hide-hint');
        }, 3000);

        this.resizeScreensaverCanvas();
        this.initScreensaverEntities();
        this.animateScreensaver();
    }

    stopScreensaver() {
        this.screensaverActive = false;
        document.getElementById('screensaverOverlay').classList.remove('active');

        if (this.screensaverAnimationId) {
            cancelAnimationFrame(this.screensaverAnimationId);
            this.screensaverAnimationId = null;
        }
    }

    initScreensaverEntities() {
        this.screensaverEntities = [];
        const width = window.innerWidth;
        const height = window.innerHeight;

        switch (this.screensaverMode) {
            case 'stars':
                // Create 150 stars with random positions and properties
                for (let i = 0; i < 150; i++) {
                    this.screensaverEntities.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        size: 0.5 + Math.random() * 2,
                        twinkleSpeed: 0.5 + Math.random() * 2,
                        twinkleOffset: Math.random() * Math.PI * 2,
                        brightness: 0.3 + Math.random() * 0.7
                    });
                }
                break;

            case 'aurora':
                // Create aurora wave bands
                for (let i = 0; i < 5; i++) {
                    this.screensaverEntities.push({
                        yBase: height * (0.2 + i * 0.12),
                        amplitude: 30 + Math.random() * 50,
                        frequency: 0.002 + Math.random() * 0.003,
                        speed: 0.0003 + Math.random() * 0.0005,
                        hue: 120 + i * 20 + Math.random() * 30, // Green to cyan range
                        alpha: 0.1 + Math.random() * 0.15,
                        offset: Math.random() * 1000
                    });
                }
                break;

            case 'fireflies':
                // Create 40 fireflies
                for (let i = 0; i < 40; i++) {
                    this.screensaverEntities.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: (Math.random() - 0.5) * 0.5,
                        size: 2 + Math.random() * 3,
                        pulseSpeed: 0.5 + Math.random() * 1.5,
                        pulseOffset: Math.random() * Math.PI * 2,
                        hue: 40 + Math.random() * 20 // Warm yellow-orange
                    });
                }
                break;

            case 'nebula':
                // Nebula uses Perlin noise, no entities needed
                // But we'll store some color parameters
                this.screensaverEntities = [
                    { hue: 260, name: 'purple' },  // Purple
                    { hue: 200, name: 'blue' },    // Blue
                    { hue: 320, name: 'pink' }     // Pink
                ];
                break;

            case 'rain':
                // Create 100 raindrops
                for (let i = 0; i < 100; i++) {
                    this.screensaverEntities.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        length: 10 + Math.random() * 20,
                        speed: 2 + Math.random() * 3,
                        opacity: 0.1 + Math.random() * 0.2
                    });
                }
                break;
        }
    }

    animateScreensaver() {
        if (!this.screensaverActive) return;

        const width = window.innerWidth;
        const height = window.innerHeight;
        const ctx = this.screensaverCtx;

        // Clear with slight fade for trails
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);

        switch (this.screensaverMode) {
            case 'stars':
                this.drawStars(ctx, width, height);
                break;
            case 'aurora':
                // Aurora needs full clear for clean gradient
                ctx.fillStyle = 'rgba(0, 0, 8, 1)';
                ctx.fillRect(0, 0, width, height);
                this.drawAurora(ctx, width, height);
                break;
            case 'fireflies':
                this.drawFireflies(ctx, width, height);
                break;
            case 'nebula':
                ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
                ctx.fillRect(0, 0, width, height);
                this.drawNebula(ctx, width, height);
                break;
            case 'rain':
                ctx.fillStyle = 'rgba(0, 0, 10, 0.3)';
                ctx.fillRect(0, 0, width, height);
                this.drawRain(ctx, width, height);
                break;
        }

        this.time += 0.016; // ~60fps time increment
        this.screensaverAnimationId = requestAnimationFrame(() => this.animateScreensaver());
    }

    drawStars(ctx, width, height) {
        this.screensaverEntities.forEach(star => {
            const twinkle = Math.sin(this.time * star.twinkleSpeed + star.twinkleOffset);
            const alpha = star.brightness * (0.5 + twinkle * 0.5);

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();

            // Add subtle glow for larger stars
            if (star.size > 1.5) {
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.1})`;
                ctx.fill();
            }
        });
    }

    drawAurora(ctx, width, height) {
        this.screensaverEntities.forEach(band => {
            ctx.beginPath();

            const points = [];
            for (let x = 0; x <= width; x += 5) {
                const noise1 = this.perlin.fbm(x * band.frequency + this.time * band.speed + band.offset, 3);
                const noise2 = this.perlin.fbm(x * band.frequency * 0.5 + this.time * band.speed * 0.7 + band.offset + 500, 2);
                const y = band.yBase + noise1 * band.amplitude + noise2 * band.amplitude * 0.5;
                points.push({ x, y });
            }

            // Draw gradient band
            const gradient = ctx.createLinearGradient(0, band.yBase - 100, 0, band.yBase + 100);
            gradient.addColorStop(0, `hsla(${band.hue}, 80%, 50%, 0)`);
            gradient.addColorStop(0.5, `hsla(${band.hue}, 80%, 60%, ${band.alpha})`);
            gradient.addColorStop(1, `hsla(${band.hue}, 80%, 50%, 0)`);

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();

            ctx.fillStyle = gradient;
            ctx.fill();
        });
    }

    drawFireflies(ctx, width, height) {
        this.screensaverEntities.forEach(fly => {
            // Update position with gentle wandering
            fly.x += fly.vx + this.perlin.noise1d(this.time + fly.pulseOffset) * 0.3;
            fly.y += fly.vy + this.perlin.noise1d(this.time * 1.3 + fly.pulseOffset + 100) * 0.3;

            // Wrap around edges
            if (fly.x < 0) fly.x = width;
            if (fly.x > width) fly.x = 0;
            if (fly.y < 0) fly.y = height;
            if (fly.y > height) fly.y = 0;

            // Pulse glow
            const pulse = Math.sin(this.time * fly.pulseSpeed + fly.pulseOffset);
            const alpha = 0.3 + pulse * 0.7;

            if (alpha > 0.2) {
                // Outer glow
                const glowGradient = ctx.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, fly.size * 8);
                glowGradient.addColorStop(0, `hsla(${fly.hue}, 100%, 70%, ${alpha * 0.5})`);
                glowGradient.addColorStop(0.5, `hsla(${fly.hue}, 100%, 50%, ${alpha * 0.2})`);
                glowGradient.addColorStop(1, `hsla(${fly.hue}, 100%, 50%, 0)`);

                ctx.beginPath();
                ctx.arc(fly.x, fly.y, fly.size * 8, 0, Math.PI * 2);
                ctx.fillStyle = glowGradient;
                ctx.fill();

                // Core
                ctx.beginPath();
                ctx.arc(fly.x, fly.y, fly.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${fly.hue}, 100%, 90%, ${alpha})`;
                ctx.fill();
            }
        });
    }

    drawNebula(ctx, width, height) {
        const scale = 0.003;
        const timeScale = this.time * 0.05;

        // Draw nebula clouds using Perlin noise sampling
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;

            const noise = this.perlin.fbm(x * scale + timeScale, 4);
            const noise2 = this.perlin.fbm(y * scale + timeScale + 500, 4);

            if (noise > 0.1) {
                const colorIndex = Math.floor((noise2 + 1) * 1.5) % 3;
                const hue = this.screensaverEntities[colorIndex].hue;
                const size = 20 + noise * 80;
                const alpha = 0.02 + noise * 0.03;

                const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
                gradient.addColorStop(0, `hsla(${hue}, 60%, 50%, ${alpha})`);
                gradient.addColorStop(1, `hsla(${hue}, 60%, 30%, 0)`);

                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }
        }
    }

    drawRain(ctx, width, height) {
        ctx.strokeStyle = 'rgba(150, 180, 255, 0.3)';
        ctx.lineWidth = 1;

        this.screensaverEntities.forEach(drop => {
            // Update position
            drop.y += drop.speed;
            drop.x += 0.5; // Slight wind

            // Reset when off screen
            if (drop.y > height) {
                drop.y = -drop.length;
                drop.x = Math.random() * width;
            }
            if (drop.x > width) {
                drop.x = 0;
            }

            // Draw raindrop
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + 1, drop.y + drop.length);
            ctx.strokeStyle = `rgba(150, 180, 255, ${drop.opacity})`;
            ctx.stroke();
        });
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
