import gsap from 'gsap';

let host: HTMLElement | null = null;

export function toast(message: string, kind: 'info' | 'success' = 'info'): void {
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    document.body.append(host);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  t.textContent = message;
  host.append(t);
  gsap.fromTo(t, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.to(t, { opacity: 0, y: -8, delay: 2.4, duration: 0.4, onComplete: () => t.remove() });
}
