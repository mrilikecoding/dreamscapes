# Dreamscape — Baby Sleep Sounds

A science-backed web application that generates soothing sounds to help babies (and adults) sleep. Built with Web Audio API and Perlin noise for natural, non-repetitive audio.

## Features

### Sound Types

**Noise Spectrums (Science-Based)**
- **White Noise**: Equal energy across frequencies. Effective for masking environmental disturbances.
- **Pink Noise**: 1/f spectrum with decreasing power at higher frequencies. Studies suggest improved deep sleep quality.
- **Brown Noise**: 1/f² spectrum with even deeper frequencies. Like distant thunder or waterfalls.

**Womb Simulation**
- **Heartbeat**: 70 BPM rhythm mimicking maternal heartbeat — familiar and calming for newborns.
- **Womb Sounds**: Low-frequency rumble simulating the intrauterine environment (~80-90 dB in utero).
- **Shushing**: Rhythmic shush sounds mimicking blood flow — a time-tested soothing technique.

**Nature Sounds**
- **Gentle Rain**: Soft rainfall with natural pink noise characteristics.
- **Ocean Waves**: Rhythmic waves with predictable, calming patterns.
- **Babbling Brook**: Gentle water sounds with soothing irregularity.

### Technical Features

- **Perlin Noise Modulation**: All sounds use Perlin/Simplex noise for natural variation, preventing the audio from sounding artificial or repetitive.
- **Infinite Looping**: Seamless audio loops with no audible seams.
- **Real-time Visualization**: Beautiful frequency and waveform display.
- **Sleep Timer**: Auto-stop with gentle 10-second fade-out.
- **Responsive Design**: Works on desktop, tablet, and mobile.
- **Accessibility**: Keyboard navigation, reduced motion support, high contrast mode.

## The Science

### Why These Sounds Work

1. **Masking Effect**: Continuous sounds mask sudden environmental noises that can wake babies.

2. **Womb Familiarity**: The womb is surprisingly loud. Blood flow, heartbeat, and maternal sounds create ~80-90 dB of constant noise. Newborns find similar sounds comforting.

3. **Pink Noise & Sleep**: Research (Papalambros et al., 2017) suggests pink noise may enhance slow-wave sleep and memory consolidation.

4. **Predictable Rhythms**: Regular patterns help regulate breathing and heart rate, promoting relaxation.

### Safety Note

- Keep devices at a safe distance from the baby
- Recommended volume: conversational level (~50-60 dB)
- Use a sleep timer rather than running all night

## Technology

- **Web Audio API**: Real-time audio synthesis
- **Perlin Noise**: Natural, organic sound variation
- **Voss-McCartney Algorithm**: Pink noise generation
- **Canvas API**: Smooth visualizations

## Local Development

Simply open `index.html` in a modern browser. No build process required.

```bash
# Or use a local server
npx serve baby-sleep-sounds
```

## Deployment

The app automatically deploys to GitHub Pages via GitHub Actions when changes are pushed to the main branch.

## Browser Support

- Chrome 66+
- Firefox 60+
- Safari 14.1+
- Edge 79+

Requires Web Audio API support.

## License

MIT
