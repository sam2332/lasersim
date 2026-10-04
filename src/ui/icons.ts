import { createElement, type IconNode } from 'lucide';

export function icon(node: IconNode, size = 18): SVGElement {
  return createElement(node, { width: size, height: size, 'stroke-width': 1.75 });
}

export function iconButton(node: IconNode, title: string, onClick: () => void, label?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.append(icon(node));
  if (label) {
    const span = document.createElement('span');
    span.textContent = label;
    b.append(span);
  }
  b.addEventListener('click', onClick);
  return b;
}
