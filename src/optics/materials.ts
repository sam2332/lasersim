import type { Vec2 } from '../core/math';
import type { Material, OutRay } from '../core/types';
import { fractionAlong, linear, retard, rotateState } from './polarization';

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


// ---------------------------------------------------------------------------
// Photonics
// ---------------------------------------------------------------------------

/** Absorptive linear polarizer (Malus's law). */
export function polarizer(axis: number): Material {
  return {
    interact: ({ ray }) => {
      const f = fractionAlong(ray.pol, axis);
      return f > 1e-4 ? [{ dir: ray.dir, intensity: ray.intensity * f, pol: linear(axis) }] : [];
    },
  };
}

/** Birefringent wave plate: retardance π = half-wave, π/2 = quarter-wave. */
export function waveplate(axis: number, retardance: number): Material {
  return {
    interact: ({ ray }) => [{ dir: ray.dir, intensity: ray.intensity, pol: retard(ray.pol, axis, retardance) }],
  };
}

/** Faraday rotator: rotates polarization the same way regardless of direction (non-reciprocal). */
export function faraday(angle: number): Material {
  return {
    interact: ({ ray }) => [{ dir: ray.dir, intensity: ray.intensity, pol: rotateState(ray.pol, angle) }],
  };
}

/**
 * Polarizing splitter / reflective polarizer: transmits the component along
 * `axis`, reflects the orthogonal one.
 */
export function polarizingSplitter(axis: number): Material {
  return {
    interact: ({ ray, hit }) => {
      const t = fractionAlong(ray.pol, axis);
      return [
        { dir: ray.dir, intensity: ray.intensity * t, pol: linear(axis) },
        { dir: reflect(ray.dir, hit.normal), intensity: ray.intensity * (1 - t), pol: linear(axis + Math.PI / 2) },
      ];
    },
  };
}

/** Dichroic mirror: reflects a colour band, transmits everything else. */
export function dichroic(center: number, width: number): Material {
  return {
    interact: ({ ray, hit }) => {
      const r = Math.exp(-(((ray.wavelength - center) / width) ** 2));
      return [
        { dir: reflect(ray.dir, hit.normal), intensity: ray.intensity * r },
        { dir: ray.dir, intensity: ray.intensity * (1 - r) },
      ];
    },
  };
}

/** Transmission diffraction grating: sin θm = sin θi + m·λ/d. */
export function grating(linesPerMm: number, maxOrder: number): Material {
  const spacing = 1e6 / linesPerMm; // nm
  const weight = (m: number) => (m === 0 ? 0.3 : Math.abs(m) === 1 ? 0.25 : 0.1 / (Math.abs(m) - 1));
  return {
    interact: ({ ray, hit }) => {
      let n = hit.normal;
      if (ray.dir.x * n.x + ray.dir.y * n.y < 0) n = { x: -n.x, y: -n.y };
      const t = { x: -n.y, y: n.x };
      const sinI = ray.dir.x * t.x + ray.dir.y * t.y;
      const out: OutRay[] = [];
      let total = 0;
      for (let m = -maxOrder; m <= maxOrder; m++) {
        const s = sinI + (m * ray.wavelength) / spacing;
        if (Math.abs(s) >= 1) continue;
        const c = Math.sqrt(1 - s * s);
        out.push({ dir: { x: t.x * s + n.x * c, y: t.y * s + n.y * c }, intensity: weight(m) });
        total += weight(m);
      }
      for (const o of out) o.intensity = (ray.intensity * o.intensity) / Math.max(total, 1);
      return out;
    },
  };
}

/** Sends light straight back where it came from (corner cube). */
export const retroreflector: Material = {
  interact: ({ ray }) => [{ dir: { x: -ray.dir.x, y: -ray.dir.y }, intensity: ray.intensity * 0.95 }],
};

/** Passes light travelling along the surface's oriented normal, absorbs the reverse. */
export const oneWay: Material = {
  interact: ({ ray, hit }) => (ray.dir.x * hit.normal.x + ray.dir.y * hit.normal.y > 0 ? [{ dir: ray.dir, intensity: ray.intensity }] : []),
};

/** Scales intensity (gain > 1 amplifies, < 1 attenuates). */
export function gain(factor: number): Material {
  return {
    interact: ({ ray }) => (factor > 0.001 ? [{ dir: ray.dir, intensity: ray.intensity * factor }] : []),
  };
}

/** Re-emits light at a new wavelength (nonlinear crystal / phosphor). */
export function converter(wavelength: number, efficiency: number): Material {
  return {
    interact: ({ ray }) => [{ dir: ray.dir, intensity: ray.intensity * efficiency, wavelength }],
  };
}

/** Sensor that only counts light near `center` nm (colour-selective photodiode). */
export function colorSensor(center: number, width: number): Material {
  return {
    interact: ({ ray, hit, deposit }) => {
      deposit(hit.element.id, ray.intensity * Math.exp(-(((ray.wavelength - center) / width) ** 2)));
      return [];
    },
  };
}
