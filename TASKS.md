# LaserSim task list

Living roadmap. Check items off as they land; add notes under an item when something is deferred.
Order = priority (best first). The particle chamber comes first by request.

## Done so far

- [x] Ray optics core (mirrors, lenses with independent faces, prisms, dispersion, black holes)
- [x] Wiring + logic simulator (gates, flip-flops, switches, clocks, lamps, hex display)
- [x] Photonics (Jones polarization, wave plates, PBS, gratings, dichroics, amplifier, isolators…)
- [x] Sandboxed JavaScript microcontrollers (QuickJS + CodeMirror editor)
- [x] Example presets for optics, photonics, logic and chips

## 0. Particle containment chamber

### Phase 1: chamber + realistic gas/liquid/solid
- [x] Species table with real mass, LJ σ/ε (He, Ne, Ar, Kr, Xe, N₂, O₂, CH₄, CO₂, H₂O≈)
- [x] 2D Lennard-Jones molecular dynamics (velocity Verlet, cell lists, cutoff 2.5σ, Lorentz–Berthelot mixing)
- [x] Adaptive timestep + force clamp (stable at high T and when spawning crowded)
- [x] Maxwell–Boltzmann velocities at spawn temperature
- [x] Thermal walls (diffuse re-emission at wall temperature) vs insulated (specular) walls
- [x] Live stats: N, temperature (K), pressure from wall impulse (atm), density
- [x] Resizable chamber element (corner handle), steel or glass walls
- [x] Particle tools: species picker, spawn / erase / heat / cool / push brushes, brush size, spawn temperature
- [x] Particle rendering (GPU particle container), colour by species or by speed
- [x] Particles saved with the scene (compact snapshot on edits; undo/redo safe)
- [x] Wiring: heater + vent inputs, over-pressure + over-temperature outputs
- [x] Gravity (exaggerated) → barometric density gradient, liquids pool
- [x] Presets: states of matter, vacuum evaporation, gas diffusion, pressure relief valve, barometric atmosphere
  - Verified: ideal-gas law within 3%, energy drift ~2% over 400 t0, argon crystal at 40 K (5.2 neighbours), liquid at 115 K, gas at 300 K

### Phase 2: machinery
- [x] Piston wall driven by a signal (adiabatic compression heats gas, PV work)
  - Verified: halving the volume of insulated helium raised T ×2.17 (theory ×2.00 for γ = 2 in 2D)
- [x] Valves + pipes between chambers (pressure equalisation, effusion)
  - Verified: He crosses ~4× faster than Xe (Graham), effused gas runs hotter; jammed mouths bounce molecules back
- [x] Vacuum pump / gas inlet ports (vent = pump to vacuum, inlet with species/rate/T and back-pressure)
  - Pressure now from the virial theorem (ideal-gas ratio 1.02, low noise); feedback regulator holds 60 atm ±8
- [x] Thermostat (target temperature) option (Berendsen; pulled forward into phase 1)
- [ ] Move simulation into a Web Worker for 20k+ particles
  - Deferred: main thread handles 3 chambers × 420 molecules in ~3 ms/frame; revisit when scenes need >5k particles

### Phase 2b: combustion (requested)
- [x] Flammable species (H₂, CH₄, CO, CH₂O) + radicals (H, O, OH, CH₃, HCO) with real heats of formation
- [x] Collision-driven reactions: line-of-centres energy > Ea (Arrhenius emerges); H₂/O₂ radical chain with branching + 3-body recombination; reduced CH₄ → CH₃ → CH₂O → HCO → CO → CO₂
- [x] Momentum/energy conserving products; mass-balance check on every reaction (all pass)
- [x] Spark: plasma dissociation (O₂ → 2O, H₂ → 2H, …) + heating; spark brush tool; wireable spark-plug input (rising edge)
- [x] Flame rendering: hot molecules glow with blackbody colour, radicals glow, spark arc flash
- [x] Calibration: barriers ×0.25 (time-scale compression; selectable ×0.5 / ×1) and 30% translational heat share → H₂/O₂ flames ~3000–4000 K
  - Verified: unsparked H₂/O₂ and CH₄/O₂ never react; sparked H₂/O₂ burns ~90% to water; ignition is probabilistic (~75% per spark), as near real minimum ignition energy
- [x] Presets: Hydrogen–Oxygen Ignition, Methane in Air
- [ ] Spark-ignition engine preset (intake/compress/spark/exhaust cycle with clock + piston)
- [ ] HO₂ chemistry (would complete HCO + O₂ and high-pressure H₂ chemistry)

### Phase 3: light ↔ matter
- [ ] Beams scatter in gas (visible beams, Rayleigh ∝ 1/λ⁴)
- [ ] Gas absorbs light by species → heating
- [ ] Density → refractive index → beams bend through dense gas / shock waves (GRIN marching)
- [ ] Radiation pressure + optical tweezers
- [ ] Doppler laser cooling (red-detuned opposed beams)

### Phase 4: instruments for matter
- [ ] Speed histogram with Maxwell–Boltzmann overlay
- [ ] PV diagram plotter

## UI polish
- [x] Port tooltips (part · pin name, live ON/OFF, what it is wired to, wiring hint) + readable pin names everywhere

## A. Material sandbox (macro scale, Powder-Toy style) — foundation for city + plant
Decided with user: city is drawn in solid materials so an accident can melt it.
- [ ] Resizable "material field" element: cell grid (≈4 px cells) rendered as a GPU texture, nearest-neighbour + heat glow
- [ ] Materials with real data: phase, density, melting/boiling point, heat capacity, conductivity (steel, concrete, brick, glass, copper, aluminium, wood, sand, water, steam, lava, air, smoke, fire)
- [ ] Movement rules: fixed solids (structures), powders fall/pile, liquids flow/level, gases rise/diffuse
- [ ] Heat conduction between cells; phase changes with latent heat (melt, freeze, boil, condense)
- [ ] Combustion at macro scale (wood/fuel + air → fire → smoke), ignition from sparks/hot cells
- [ ] Pressure field + explosions (overpressure pushes/destroys cells, flings debris)
- [ ] Brushes: draw/erase/heat/cool/explode with material picker (reuse particle toolbar)
- [ ] Light interaction: beams heat absorbing cells; glass transmits; metals reflect
- [ ] Presets: melting steel with a laser, building collapse, water tower, forest fire

## B. Analog signals + power network
- [ ] Wires carry numbers (digital = 0/1); gauges/meters; analog-aware gates and chips
- [ ] Power lines carrying MW between generators, substations and loads

## C. Nuclear reactor (both levels) — PWR, BWR, RBMK and build-from-parts
- [ ] Neutron particles in the material field: fast/thermal energy groups, scattering, absorption, fission
- [ ] Nuclear materials with real cross-sections: UO₂ (U-235 enrichment), water, heavy water, graphite, B₄C/Cd control rods, Zircaloy cladding, steel
- [ ] Fission: ν ≈ 2.43 prompt neutrons, 200 MeV heat → cell temperature; delayed neutrons (6 groups, β = 0.0065)
- [ ] Wireable control rods (insertion %), SCRAM; rod tip effect for RBMK
- [ ] Feedback: Doppler (fuel temp), moderator temperature/void (negative for PWR/BWR, positive void for RBMK)
- [ ] Xenon-135 / Iodine-135 poisoning; decay heat after shutdown
- [ ] Plant-level panel: point-kinetics readouts (k_eff, period, reactivity in $), pressures, temperatures, alarms
- [ ] Coolant loops, pumps, steam generator / boiling, turbine + generator element → MW output
- [ ] Accidents emerge from physics: loss of coolant → overheating → cladding/fuel melt (corium) → steam explosion / hydrogen
- [ ] Presets: PWR, BWR, RBMK (incl. accident scenario), build-your-own core

## D. City + grid
- [ ] City districts drawn in materials with load blocks (homes, factories, hospital) and day/night demand
- [ ] Grid frequency (supply vs demand), substations, transmission lines, blackouts
- [ ] Other generators: gas/hydrogen burners (combustion), solar from light, batteries

## E. Atoms, electrons and light
- [ ] Periodic table 1–118 (prebuilt data module): mass, electron configuration, ionization energies
- [ ] Atom element: spawn by atomic number, Bohr-shell view, ions
- [ ] Real visible line spectra for common elements (H Balmer, He, Na D, Ne, Hg, Li, K, Ca, Sr, Ba, Cu, Ar, Kr, Xe…)
- [ ] Absorption/emission: beams lose their resonant lines, excited atoms glow their characteristic colours
- [ ] Photoionization: photon energy > ionization energy → ion + free electron
- [ ] Lasers from atoms: energy levels, pumping, population inversion, stimulated emission (He-Ne, ruby)

## 1. Wave optics (coherence, phase, interference)
- [ ] Track optical path length → phase per ray
- [ ] Coherent summation at detectors (complex amplitudes)
- [ ] Michelson + Mach–Zehnder presets, interferometric XOR gate

## 2. Sub-circuits (reusable packaged blocks with ports)
- [ ] Select group → package as block; block library; edit inside

## 3. Optical fibers
- [ ] Drawable spline cable, TIR guiding with loss and delay

## 4. Finite speed of light + pulses
- [ ] Light propagates over ticks, visible pulses, delay lines, LIDAR preset

## 5. Logic analyzer / oscilloscope
- [ ] Probe wires/detectors, scrolling waveforms

## 6. Build-your-own laser (gain + cavity, threshold, Q-switching)

## 7. Multi-bit buses + analog signals

## 8. Nonlinear optics (SHG ∝ I², saturable absorber, Kerr switching)

## 9. Thermal + damage model for components

## 10. Memory + CPU parts (RAM/ROM, tiny ISA + assembler, serial links)

## 11. Quantum optics mode (single photons, BB84)

## 12. Campaign / puzzle levels (inventory, scoring, level editor)

## 13. Charged particles + E/B fields (cyclotron, mass spectrometer, ion trap)

## 14. Measurement instruments (power meter, beam profiler, spectrum analyzer, polarimeter)

## 15. Rendering upgrades (WebGPU tracing, volumetric haze)

## 16. Recording + export (GIF/MP4, poster PNG, SVG schematic)

## 17. Live multiplayer boards (Yjs)

## 18. Branching history / named snapshots
