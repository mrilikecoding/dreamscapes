/**
 * Baby Sleep Sounds Application
 * Main application logic, UI control, and visualization
 */

// Gentle transition duration to avoid startle reflex (in ms)
// 10 seconds ensures smooth, non-startling transitions for sleeping babies
const TRANSITION_DURATION = 10000;

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
        this.isTransitioning = false; // Prevent overlapping transitions
        this.activePresetId = null; // Currently loaded preset
        this.transitionAnimationId = null; // For canceling animations
        this.pauseAnimationId = null; // For pause ring animation
        this.presetTransitionTimeout = null; // For canceling preset transition cleanup
        this.pendingPresetCleanup = null; // Sounds to clean up after transition
        this.interruptedPresetEl = null; // Preset element that was interrupted mid-load

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

        // If this sound is already active, fade it out gently
        if (this.activeSounds.has(soundType)) {
            this.fadeOutAndRemoveSound(soundType, card);
            return;
        }

        // Add this sound to the mix - starts at volume 0, user adjusts slider
        await this.playSound(soundType, card);
    }

    fadeOutAndRemoveSound(soundType, card) {
        // Start fading out
        this.engine.fadeSoundVolume(soundType, 0, TRANSITION_DURATION);

        // Visual feedback - show it's fading
        if (card) {
            card.classList.add('fading-out');
        }

        // After fade completes, clean up
        setTimeout(() => {
            this.engine.stop(soundType);
            this.activeSounds.delete(soundType);

            if (card) {
                card.classList.remove('active', 'fading-out');
                this.removeVolumeSlider(card);
            }

            this.updateNowPlayingDisplay();

            // If no sounds left, switch to idle
            if (this.activeSounds.size === 0) {
                document.getElementById('nowPlaying').classList.remove('playing');
                this.visualizerActive = false;
                this.startIdleAnimation();
                this.clearTimer();
            }

            this.updatePauseButtonState();
        }, TRANSITION_DURATION + 100);
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
            document.getElementById('currentSoundName').textContent = '';
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
            displayEl.textContent = '';
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

        // Fade out all sounds over TRANSITION_DURATION to avoid startle reflex
        this.activeSounds.forEach(soundType => {
            this.engine.fadeSoundVolume(soundType, 0, TRANSITION_DURATION);
        });

        // Update UI
        const pauseBtn = document.getElementById('pauseBtn');
        const pauseIcon = document.getElementById('pauseIcon');
        const container = document.querySelector('.pause-btn-container');
        pauseBtn.classList.add('paused');
        container.classList.add('paused', 'transitioning');
        pauseIcon.textContent = '▶';

        // Animate the progress ring (filling up as sound fades out)
        this.animatePauseRing(0, 100, TRANSITION_DURATION, () => {
            container.classList.remove('transitioning');
        });
    }

    resumeSounds() {
        if (!this.isPaused) return;

        this.isPaused = false;

        // Fade in all sounds to their stored volumes over TRANSITION_DURATION
        this.pausedVolumes.forEach((volume, soundType) => {
            this.engine.fadeSoundVolume(soundType, volume, TRANSITION_DURATION);
        });

        // Update UI
        const pauseBtn = document.getElementById('pauseBtn');
        const pauseIcon = document.getElementById('pauseIcon');
        const container = document.querySelector('.pause-btn-container');
        pauseBtn.classList.remove('paused');
        container.classList.remove('paused');
        container.classList.add('transitioning');
        pauseIcon.textContent = '⏸';

        // Animate the progress ring (emptying as sound fades in)
        this.animatePauseRing(100, 0, TRANSITION_DURATION, () => {
            container.classList.remove('transitioning');
        });
    }

    // Animate the circular progress ring around pause button
    animatePauseRing(fromPercent, toPercent, duration, onComplete) {
        const ring = document.getElementById('pauseProgressFill');
        if (!ring) return;

        const circumference = 125.6; // 2 * PI * 20
        const startOffset = circumference * (1 - fromPercent / 100);
        const endOffset = circumference * (1 - toPercent / 100);
        const startTime = Date.now();

        // Cancel any existing animation
        if (this.pauseAnimationId) {
            cancelAnimationFrame(this.pauseAnimationId);
        }

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentOffset = startOffset + (endOffset - startOffset) * progress;
            ring.style.strokeDashoffset = currentOffset;

            if (progress < 1) {
                this.pauseAnimationId = requestAnimationFrame(animate);
            } else {
                this.pauseAnimationId = null;
                if (onComplete) onComplete();
            }
        };

        animate();
    }

    // Animate preset progress bar
    animatePresetProgress(presetEl, fromPercent, toPercent, duration) {
        const progressBar = presetEl.querySelector('.preset-progress');
        if (!progressBar) return;

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentWidth = fromPercent + (toPercent - fromPercent) * progress;
            progressBar.style.width = `${currentWidth}%`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    updatePauseButtonState() {
        const pauseBtn = document.getElementById('pauseBtn');
        const container = document.querySelector('.pause-btn-container');
        const ring = document.getElementById('pauseProgressFill');
        pauseBtn.disabled = this.activeSounds.size === 0;

        // Reset pause state if no sounds
        if (this.activeSounds.size === 0) {
            this.isPaused = false;
            pauseBtn.classList.remove('paused');
            if (container) {
                container.classList.remove('paused', 'transitioning');
            }
            if (ring) {
                ring.style.strokeDashoffset = '125.6'; // Reset to empty
            }
            document.getElementById('pauseIcon').textContent = '⏸';

            // Clear active preset when all sounds stop
            if (this.activePresetId) {
                const activePresetEl = document.querySelector(`.preset-item[data-preset-id="${this.activePresetId}"]`);
                if (activePresetEl) {
                    activePresetEl.classList.remove('active');
                    const progressBar = activePresetEl.querySelector('.preset-progress');
                    if (progressBar) progressBar.style.width = '0%';
                }
                this.activePresetId = null;
            }
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
        // Prevent overlapping transitions
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // Clear active preset since random mix isn't a saved preset
        if (this.activePresetId) {
            const activePresetEl = document.querySelector(`.preset-item[data-preset-id="${this.activePresetId}"]`);
            if (activePresetEl) {
                activePresetEl.classList.remove('active');
                const progressBar = activePresetEl.querySelector('.preset-progress');
                if (progressBar) {
                    this.animatePresetProgress(activePresetEl, 100, 0, TRANSITION_DURATION);
                }
            }
            this.activePresetId = null;
        }

        // Get currently playing sounds
        const currentSounds = this.engine.getActiveSoundTypes();

        // Get all available sound types
        const allSounds = Object.keys(this.soundNames);

        // Pick random number of sounds (2-4)
        const numSounds = 2 + Math.floor(Math.random() * 3);

        // Shuffle and pick sounds
        const shuffled = allSounds.sort(() => Math.random() - 0.5);
        const selectedSounds = shuffled.slice(0, numSounds);

        // Generate random volumes (0.3 - 1.0 to ensure audible)
        const soundVolumes = {};
        selectedSounds.forEach(s => {
            soundVolumes[s] = 0.3 + Math.random() * 0.7;
        });

        // Random master volume (0.4 - 0.8)
        const masterVolume = 0.4 + Math.random() * 0.4;
        this.engine.setVolume(masterVolume);
        document.getElementById('volumeSlider').value = masterVolume * 100;

        // Start fading out sounds that won't be in the new mix
        const soundsToFadeOut = currentSounds.filter(s => !selectedSounds.includes(s));
        for (const soundType of soundsToFadeOut) {
            this.engine.fadeSoundVolume(soundType, 0, TRANSITION_DURATION);
        }

        // For sounds that are in both old and new, cross-fade to new volume
        const soundsToCrossfade = currentSounds.filter(s => selectedSounds.includes(s));
        for (const soundType of soundsToCrossfade) {
            const targetVolume = soundVolumes[soundType];
            this.engine.fadeSoundVolume(soundType, targetVolume, TRANSITION_DURATION);
            const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
            if (card) {
                const slider = card.querySelector('.sound-volume-slider');
                if (slider) slider.value = targetVolume * 100;
            }
        }

        // Start new sounds (not currently playing) at volume 0 and fade in
        const soundsToStart = selectedSounds.filter(s => !currentSounds.includes(s));
        for (const soundType of soundsToStart) {
            const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
            if (card) {
                await this.playSound(soundType, card);
                const slider = card.querySelector('.sound-volume-slider');
                if (slider) slider.value = soundVolumes[soundType] * 100;
            }
        }

        // Small delay then fade in new sounds
        await new Promise(resolve => setTimeout(resolve, 50));
        for (const soundType of soundsToStart) {
            this.engine.fadeSoundVolume(soundType, soundVolumes[soundType], TRANSITION_DURATION);
        }

        // After transition completes, clean up faded-out sounds
        setTimeout(() => {
            for (const soundType of soundsToFadeOut) {
                this.engine.stop(soundType);
                this.activeSounds.delete(soundType);
                const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
                if (card) {
                    card.classList.remove('active');
                    this.removeVolumeSlider(card);
                }
            }
            this.updateNowPlayingDisplay();
            this.isTransitioning = false;
        }, TRANSITION_DURATION + 100);
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
        const newPresetId = preset.id;
        const newPresetEl = document.querySelector(`.preset-item[data-preset-id="${newPresetId}"]`);

        // If already transitioning, interrupt and clean up immediately
        if (this.isTransitioning) {
            // Cancel pending cleanup timeout
            if (this.presetTransitionTimeout) {
                clearTimeout(this.presetTransitionTimeout);
                this.presetTransitionTimeout = null;
            }

            // Immediately clean up any sounds that were fading out
            if (this.pendingPresetCleanup) {
                for (const soundType of this.pendingPresetCleanup.soundsToStop) {
                    // Only stop if volume is near zero (was fading out)
                    if (this.engine.getSoundVolume(soundType) < 0.05) {
                        this.engine.stop(soundType);
                        this.activeSounds.delete(soundType);
                        const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
                        if (card) {
                            card.classList.remove('active');
                            this.removeVolumeSlider(card);
                        }
                    }
                }

                // Clean up visual states of interrupted presets
                const interruptedEl = this.pendingPresetCleanup.loadingPresetEl;
                if (interruptedEl && interruptedEl !== newPresetEl) {
                    interruptedEl.classList.remove('loading', 'active');
                    interruptedEl.classList.add('fading-out');
                    // Animate the interrupted preset's bar back down from its current position
                    const interruptedProgressBar = interruptedEl.querySelector('.preset-progress');
                    const currentProgress = interruptedProgressBar ? parseFloat(interruptedProgressBar.style.width) || 0 : 0;
                    if (currentProgress > 0) {
                        this.animatePresetProgress(interruptedEl, currentProgress, 0, TRANSITION_DURATION);
                    }
                    // Track for cleanup after this transition completes
                    this.interruptedPresetEl = interruptedEl;
                }
                const fadingEl = this.pendingPresetCleanup.fadingPresetEl;
                if (fadingEl && fadingEl !== newPresetEl) {
                    fadingEl.classList.remove('fading-out');
                }
            }
        } else {
            // Not interrupting, clear any previous interrupted element
            this.interruptedPresetEl = null;
        }

        this.isTransitioning = true;

        // Get the old preset element (could be actively loading or already active)
        const oldPresetId = this.activePresetId;
        const oldPresetEl = oldPresetId ? document.querySelector(`.preset-item[data-preset-id="${oldPresetId}"]`) : null;

        // Get current progress bar positions for smooth continuation
        let oldPresetProgress = 100;
        let newPresetProgress = 0;

        if (oldPresetEl && oldPresetId !== newPresetId) {
            const oldProgressBar = oldPresetEl.querySelector('.preset-progress');
            if (oldProgressBar) {
                oldPresetProgress = parseFloat(oldProgressBar.style.width) || 100;
            }
            oldPresetEl.classList.add('fading-out');
            oldPresetEl.classList.remove('active', 'loading');
            this.animatePresetProgress(oldPresetEl, oldPresetProgress, 0, TRANSITION_DURATION);
        }

        if (newPresetEl) {
            const newProgressBar = newPresetEl.querySelector('.preset-progress');
            if (newProgressBar) {
                newPresetProgress = parseFloat(newProgressBar.style.width) || 0;
            }
            newPresetEl.classList.add('loading');
            newPresetEl.classList.remove('fading-out');
            this.animatePresetProgress(newPresetEl, newPresetProgress, 100, TRANSITION_DURATION);
        }

        // Get currently playing sounds (includes any mid-fade sounds)
        const currentSounds = this.engine.getActiveSoundTypes();
        const newSoundTypes = Object.keys(preset.sounds);

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

        // Start fading out sounds that won't be in the new mix
        // Audio engine's fadeSoundVolume will start from current volume automatically
        const soundsToFadeOut = currentSounds.filter(s => !newSoundTypes.includes(s));
        for (const soundType of soundsToFadeOut) {
            this.engine.fadeSoundVolume(soundType, 0, TRANSITION_DURATION);
        }

        // For sounds that are in both old and new, cross-fade to new volume
        const soundsToCrossfade = currentSounds.filter(s => newSoundTypes.includes(s));
        for (const soundType of soundsToCrossfade) {
            const targetVolume = preset.sounds[soundType];
            this.engine.fadeSoundVolume(soundType, targetVolume, TRANSITION_DURATION);
            // Update slider
            const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
            if (card) {
                const slider = card.querySelector('.sound-volume-slider');
                if (slider) slider.value = targetVolume * 100;
            }
        }

        // Start new sounds (not currently playing) at volume 0 and fade in
        const soundsToStart = newSoundTypes.filter(s => !currentSounds.includes(s));
        for (const soundType of soundsToStart) {
            const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
            if (card) {
                await this.playSound(soundType, card);
                const slider = card.querySelector('.sound-volume-slider');
                if (slider) slider.value = preset.sounds[soundType] * 100;
            }
        }

        // Small delay to ensure new sounds are playing, then fade them in
        await new Promise(resolve => setTimeout(resolve, 50));
        for (const soundType of soundsToStart) {
            this.engine.fadeSoundVolume(soundType, preset.sounds[soundType], TRANSITION_DURATION);
        }

        // Store cleanup info in case we get interrupted
        this.pendingPresetCleanup = {
            soundsToStop: soundsToFadeOut,
            loadingPresetEl: newPresetEl,
            fadingPresetEl: oldPresetEl,
            interruptedPresetEl: null // Will be set if we interrupt another transition
        };

        // After transition completes, clean up faded-out sounds and update preset states
        this.presetTransitionTimeout = setTimeout(() => {
            for (const soundType of soundsToFadeOut) {
                this.engine.stop(soundType);
                this.activeSounds.delete(soundType);
                const card = document.querySelector(`.sound-card[data-sound="${soundType}"]`);
                if (card) {
                    card.classList.remove('active');
                    this.removeVolumeSlider(card);
                }
            }
            this.updateNowPlayingDisplay();
            this.isTransitioning = false;
            this.pendingPresetCleanup = null;
            this.presetTransitionTimeout = null;

            // Update preset visual states
            if (oldPresetEl) {
                oldPresetEl.classList.remove('fading-out');
            }
            if (newPresetEl) {
                newPresetEl.classList.remove('loading');
                newPresetEl.classList.add('active');
            }
            // Clean up any interrupted preset from a previous transition
            if (this.interruptedPresetEl) {
                this.interruptedPresetEl.classList.remove('fading-out');
                this.interruptedPresetEl = null;
            }
            this.activePresetId = newPresetId;
        }, TRANSITION_DURATION + 100);
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
        const presetsRow = container.closest('.presets-row');
        const emptyMsg = document.getElementById('presetsEmpty');
        const presets = this.getPresets();

        // Clear existing preset items (but keep the empty message element)
        container.querySelectorAll('.preset-item').forEach(el => el.remove());

        if (presets.length === 0) {
            // Hide the entire presets row when empty
            if (presetsRow) presetsRow.style.display = 'none';
            return;
        }

        // Show presets row when there are presets
        if (presetsRow) presetsRow.style.display = '';
        emptyMsg.style.display = 'none';

        // Sort by most recent first
        presets.sort((a, b) => b.createdAt - a.createdAt);

        presets.forEach(preset => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.dataset.presetId = preset.id;

            // Mark as active if this preset is currently loaded
            if (this.activePresetId === preset.id) {
                item.classList.add('active');
            }

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
                <div class="preset-progress"></div>
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
                        twinkleSpeed: 0.1 + Math.random() * 0.3, // Much slower twinkle
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
                        frequency: 0.001 + Math.random() * 0.002,
                        speed: 0.0002 + Math.random() * 0.0003, // Slow but visible movement
                        hue: 120 + i * 20 + Math.random() * 30, // Green to cyan range
                        alpha: 0.15 + Math.random() * 0.2,
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
                        vx: (Math.random() - 0.5) * 0.1, // Much slower drift
                        vy: (Math.random() - 0.5) * 0.1,
                        size: 2 + Math.random() * 3,
                        pulseSpeed: 0.1 + Math.random() * 0.3, // Much slower pulse
                        pulseOffset: Math.random() * Math.PI * 2,
                        hue: 40 + Math.random() * 20 // Warm yellow-orange
                    });
                }
                break;

            case 'nebula':
                // Create nebula clouds - large soft circles that drift slowly
                const hues = [260, 200, 320, 280, 180]; // Purple, blue, pink, violet, cyan
                for (let i = 0; i < 25; i++) {
                    this.screensaverEntities.push({
                        x: Math.random() * width,
                        y: Math.random() * height,
                        size: 100 + Math.random() * 200,
                        hue: hues[Math.floor(Math.random() * hues.length)],
                        alpha: 0.06 + Math.random() * 0.08, // Brighter
                        driftX: (Math.random() - 0.5) * 0.15, // Slightly faster drift
                        driftY: (Math.random() - 0.5) * 0.15,
                        pulseSpeed: 0.05 + Math.random() * 0.05, // Slightly faster pulse
                        pulseOffset: Math.random() * Math.PI * 2
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
                // Full clear with dark background for nebula
                ctx.fillStyle = 'rgba(5, 0, 15, 1)';
                ctx.fillRect(0, 0, width, height);
                this.drawNebula(ctx, width, height);
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
            // Update position with gentle wandering - very slow
            fly.x += fly.vx + this.perlin.noise1d(this.time * 0.2 + fly.pulseOffset) * 0.08;
            fly.y += fly.vy + this.perlin.noise1d(this.time * 0.2 + fly.pulseOffset + 100) * 0.08;

            // Wrap around edges
            if (fly.x < 0) fly.x = width;
            if (fly.x > width) fly.x = 0;
            if (fly.y < 0) fly.y = height;
            if (fly.y > height) fly.y = 0;

            // Pulse glow
            const pulse = Math.sin(this.time * fly.pulseSpeed + fly.pulseOffset);
            const alpha = 0.3 + pulse * 0.7;

            if (alpha > 0.2) {
                // Outer glow - dimmer
                const glowGradient = ctx.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, fly.size * 6);
                glowGradient.addColorStop(0, `hsla(${fly.hue}, 80%, 60%, ${alpha * 0.25})`);
                glowGradient.addColorStop(0.5, `hsla(${fly.hue}, 80%, 45%, ${alpha * 0.1})`);
                glowGradient.addColorStop(1, `hsla(${fly.hue}, 80%, 40%, 0)`);

                ctx.beginPath();
                ctx.arc(fly.x, fly.y, fly.size * 6, 0, Math.PI * 2);
                ctx.fillStyle = glowGradient;
                ctx.fill();

                // Core - dimmer
                ctx.beginPath();
                ctx.arc(fly.x, fly.y, fly.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${fly.hue}, 80%, 70%, ${alpha * 0.6})`;
                ctx.fill();
            }
        });
    }

    drawNebula(ctx, width, height) {
        this.screensaverEntities.forEach(cloud => {
            // Slow drift
            cloud.x += cloud.driftX;
            cloud.y += cloud.driftY;

            // Wrap around edges
            if (cloud.x < -cloud.size) cloud.x = width + cloud.size;
            if (cloud.x > width + cloud.size) cloud.x = -cloud.size;
            if (cloud.y < -cloud.size) cloud.y = height + cloud.size;
            if (cloud.y > height + cloud.size) cloud.y = -cloud.size;

            // Gentle pulse
            const pulse = Math.sin(this.time * cloud.pulseSpeed + cloud.pulseOffset);
            const currentAlpha = cloud.alpha * (0.7 + pulse * 0.3);
            const currentSize = cloud.size * (0.9 + pulse * 0.1);

            // Draw soft cloud
            const gradient = ctx.createRadialGradient(
                cloud.x, cloud.y, 0,
                cloud.x, cloud.y, currentSize
            );
            gradient.addColorStop(0, `hsla(${cloud.hue}, 70%, 50%, ${currentAlpha})`);
            gradient.addColorStop(0.4, `hsla(${cloud.hue}, 60%, 40%, ${currentAlpha * 0.5})`);
            gradient.addColorStop(1, `hsla(${cloud.hue}, 50%, 30%, 0)`);

            ctx.beginPath();
            ctx.arc(cloud.x, cloud.y, currentSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
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
