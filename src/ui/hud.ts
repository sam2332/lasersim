import confetti from 'canvas-confetti';
import gsap from 'gsap';
import { getDef } from '../core/registry';
import type { Scene } from '../core/types';

/** Goal progress ("2 / 3 orbs lit") and the celebration when everything is lit. */
export class Hud {
  private wasSolved = false;
  private lastKey = '';

  constructor(private readonly host: HTMLElement) {}

  update(scene: Scene, energy: Map<string, number>): void {
    const goals = scene.elements.flatMap((el) => {
      const def = getDef(el.type);
      return def?.goalMet ? [def.goalMet(el.props, energy.get(el.id) ?? 0)] : [];
    });
    const lit = goals.filter(Boolean).length;
    const solved = goals.length > 0 && lit === goals.length;

    const key = goals.map(Number).join('');
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.render(goals, lit, solved);
    }

    if (solved && !this.wasSolved) this.celebrate();
    this.wasSolved = solved;
  }

  private render(goals: boolean[], lit: number, solved: boolean): void {
    if (!goals.length) {
      this.host.innerHTML = '';
      this.host.classList.remove('visible');
      return;
    }
    this.host.classList.add('visible');
    this.host.classList.toggle('solved', solved);
    this.host.innerHTML = `
      <div class="hud-dots">${goals.map((g) => `<span class="dot ${g ? 'on' : ''}"></span>`).join('')}</div>
      <div class="hud-text">${solved ? 'All orbs ignited!' : `${lit} / ${goals.length} orbs lit`}</div>`;
  }

  private celebrate(): void {
    gsap.fromTo(this.host, { scale: 1.15 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const colors = ['#ff4d4d', '#ffb14d', '#fff35c', '#5cff8a', '#4dc3ff', '#8a6bff', '#ffd27a'];
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.75 }, colors, disableForReducedMotion: true });
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors }), 200);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors }), 350);
  }
}
