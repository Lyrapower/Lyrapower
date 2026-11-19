/* ---------- 环境声与生成式配乐:风、长音垫底、五声拨弦带回声 ---------- */
const mus = {
  on: false, g: null, bus: null, pad: [], root: 146.83, scale: [0, 3, 5, 7, 10], timer: 0,
  KEY: { dusk: [146.83, [0, 2, 4, 7, 9]], cave: [130.81, [0, 3, 5, 7, 10]], frost: [164.81, [0, 2, 4, 7, 9]], ember: [110, [0, 3, 5, 7, 10]], dune: [123.47, [0, 2, 5, 7, 10]], abyss: [103.83, [0, 3, 5, 6, 10]] },
  start() {
    if (this.on || !sfx.ctx) return; const c = sfx.ctx;
    try {
      this.g = c.createGain(); this.g.gain.value = 0; this.g.connect(c.destination);
      const d = c.createDelay(1.5), fb = c.createGain(), lp = c.createBiquadFilter(); d.delayTime.value = .47; fb.gain.value = .4; lp.type = 'lowpass'; lp.frequency.value = 1700; d.connect(lp); lp.connect(fb); fb.connect(d); d.connect(this.g);
      this.bus = c.createGain(); this.bus.connect(this.g); this.bus.connect(d);
      const pf = c.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 520; pf.connect(this.g);
      this.pad = [0, 1, 2].map(i => { const o = c.createOscillator(), g = c.createGain(); o.type = i === 0 ? 'triangle' : 'sine'; g.gain.value = [.07, .045, .03][i]; o.connect(g); g.connect(pf); o.start(); return o; });
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .07; lg.gain.value = 140; lfo.connect(lg); lg.connect(pf.frequency); lfo.start();
      const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(), wl = c.createOscillator(), wg = c.createGain(); n.buffer = nb; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = .5; ng.gain.value = .028; wl.frequency.value = .11; wg.gain.value = 240; wl.connect(wg); wg.connect(bp.frequency); wl.start(); n.connect(bp); bp.connect(ng); ng.connect(this.g); n.start();
      this.on = true; this.retune(); this.vol(); this.tick();
    } catch (e) { this.on = false; }
  },
  vol() { if (this.on) this.g.gain.setTargetAtTime(save.sound ? .5 : 0, sfx.ctx.currentTime, .8); },
  retune() { const k = this.KEY[L && L.theme] || this.KEY.dusk; this.root = k[0]; this.scale = k[1]; if (!this.on) return; const t = sfx.ctx.currentTime; [this.root / 2, this.root * .75, this.root].forEach((f, i) => this.pad[i].frequency.setTargetAtTime(f, t, 1.2)); },
  pluck(semi, vol, when) { const c = sfx.ctx, t = c.currentTime + (when || 0), f = this.root * 2 * Math.pow(2, semi / 12), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.003; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + 1.9); o.connect(g); o2.connect(g); g.connect(this.bus); o.start(t); o2.start(t); o.stop(t + 2); o2.stop(t + 2); },
  tick() {
    clearTimeout(this.timer); this.timer = setTimeout(() => this.tick(), 1100 + Math.random() * 2600);
    if (!this.on || !save.sound || document.hidden || sfx.ctx.state !== 'running') return;
    const s = this.scale, i = Math.floor(Math.random() * s.length), oct = Math.random() < .3 ? 12 : 0; this.pluck(s[i] + oct, .05);
    if (Math.random() < .45) this.pluck(s[(i + 1 + Math.floor(Math.random() * 2)) % s.length] + oct, .035, .22 + Math.random() * .2);
  }
};
