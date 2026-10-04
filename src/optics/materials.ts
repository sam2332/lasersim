import type { Vec2 } from '../core/math';
import type { Material, OutRay } from '../core/types';

/**
 * Prebuilt surface materials. A material only decides what leaves a hit point;
 * new behaviours (filters, splitters, portals…) are new materials.
 */

export function reflect(d: Vec2, n: Vec2): Vec2 {
  const k = 2 * (d.x * n.x + d.y * n.y);
  return { x: d.x - k * n.x, y: d.y - k * n.y };
}

export const absorber: Material = {
  interact: () => [],
};

export function mirror(reflectivity = 0.97): Material {
  return {
    interact: ({ ray, hit }) => [{ dir: reflect(ray.dir, hit.normal), intensity: ray.intensity * reflectivity }],
  };
}

/** Absorbs light and deposits its energy on the element (targets). */
export const sensor: Material = {
  interact: ({ ray, hit, deposit }) => {
    deposit(hit.element.id, ray.intensity);
    return [];
  },
};

/** Partially reflects, transmits the rest unchanged. */
export function splitter(reflectRatio: number): Material {
  return {
    interact: ({ ray, hit }) => [
      { dir: reflect(ray.dir, hit.normal), intensity: ray.intensity * reflectRatio },
      { dir: ray.dir, intensity: ray.intensity * (1 - reflectRatio) },
    ],
  };
}

/** Wavelength filter: passes light near `center` nm, absorbs the rest. */
export function bandpass(center: number, width: number): Material {
  return {
    interact: ({ ray }) => {
      const pass = Math.exp(-(((ray.wavelength - center) / width) ** 2));
      return pass > 0.02 ? [{ dir: ray.dir, intensity: ray.intensity * pass }] : [];
    },
  };
}

/**
 * Refracting boundary of a closed glass body. The surface normal must point
 * outward (surfaces declare `orient`). `ior` gives the index per wavelength,
 * which is what splits white light into a rainbow.
 */
export function glass(ior: (nm: number) => number): Material {
  return {
    interact: ({ ray, hit, settings }) => {
      const d = ray.dir;
      let n = hit.normal;
      let cosi = -(d.x * n.x + d.y * n.y);
      const index = ior(ray.wavelength);
      let n1 = 1;
      let n2 = index;
      if (cosi < 0) {
        // Leaving the glass.
        n = { x: -n.x, y: -n.y };
        cosi = -cosi;
        n1 = index;
        n2 = 1;
      }
      const eta = n1 / n2;
      const k = 1 - eta * eta * (1 - cosi * cosi);
      if (k < 0) {
        // Total internal reflection.
        return [{ dir: reflect(d, n), intensity: ray.intensity }];
      }
      const cost = Math.sqrt(k);
      const refracted = {
        x: eta * d.x + (eta * cosi - cost) * n.x,
        y: eta * d.y + (eta * cosi - cost) * n.y,
      };
      // Schlick's approximation for the reflected share.
      const r0 = ((n1 - n2) / (n1 + n2)) ** 2;
      const c = n1 > n2 ? cost : cosi;
      const R = r0 + (1 - r0) * (1 - c) ** 5;
      const out: OutRay[] = [{ dir: refracted, intensity: ray.intensity * (1 - R) }];
      if (settings.fresnel && R * ray.intensity > 0.06) out.push({ dir: reflect(d, n), intensity: ray.intensity * R });
      return out;
    },
  };
}

