import { describe, expect, it } from 'vitest'
import type { Polygon } from 'geojson'
import {
  formatDistance,
  haversineMeters,
  isInBounds,
  isPointInPolygon,
  padBounds,
  walkingSeconds,
} from './geo'

const EJERCITO = { lat: -33.4499, lng: -70.6543 }
const REPUBLICA = { lat: -33.4472, lng: -70.6618 }

describe('haversineMeters', () => {
  it('distancia 0 al mismo punto', () => {
    expect(haversineMeters(EJERCITO, EJERCITO)).toBe(0)
  })
  it('Ejército ↔ República ≈ 760 m (±15%)', () => {
    const d = haversineMeters(EJERCITO, REPUBLICA)
    expect(d).toBeGreaterThan(600)
    expect(d).toBeLessThan(900)
  })
  it('es simétrica', () => {
    expect(haversineMeters(EJERCITO, REPUBLICA)).toBeCloseTo(
      haversineMeters(REPUBLICA, EJERCITO),
      6,
    )
  })
})

describe('isInBounds / padBounds', () => {
  const bounds = { west: -70.66, south: -33.451, east: -70.65, north: -33.449 }
  it('dentro y fuera', () => {
    expect(isInBounds(EJERCITO, bounds)).toBe(true)
    expect(isInBounds(REPUBLICA, bounds)).toBe(false)
  })
  it('padBounds expande en las 4 direcciones y conserva el centro', () => {
    const padded = padBounds(bounds, 0.5)
    expect(padded.west).toBeLessThan(bounds.west)
    expect(padded.east).toBeGreaterThan(bounds.east)
    expect(padded.south).toBeLessThan(bounds.south)
    expect(padded.north).toBeGreaterThan(bounds.north)
    expect((padded.west + padded.east) / 2).toBeCloseTo((bounds.west + bounds.east) / 2, 10)
    // un punto justo fuera del borde original queda dentro del expandido
    expect(isInBounds({ lat: -33.4485, lng: -70.662 }, bounds)).toBe(false)
    expect(isInBounds({ lat: -33.4485, lng: -70.662 }, padded)).toBe(true)
  })
})

describe('isPointInPolygon', () => {
  const square: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-70.66, -33.46],
        [-70.65, -33.46],
        [-70.65, -33.45],
        [-70.66, -33.45],
        [-70.66, -33.46],
      ],
    ],
  }
  it('dentro y fuera del anillo exterior', () => {
    expect(isPointInPolygon({ lat: -33.455, lng: -70.655 }, square)).toBe(true)
    expect(isPointInPolygon({ lat: -33.455, lng: -70.67 }, square)).toBe(false)
    expect(isPointInPolygon({ lat: -33.44, lng: -70.655 }, square)).toBe(false)
  })
  it('respeta agujeros (patios interiores)', () => {
    const withHole: Polygon = {
      ...square,
      coordinates: [
        square.coordinates[0],
        [
          [-70.657, -33.457],
          [-70.653, -33.457],
          [-70.653, -33.453],
          [-70.657, -33.453],
          [-70.657, -33.457],
        ],
      ],
    }
    expect(isPointInPolygon({ lat: -33.455, lng: -70.655 }, withHole)).toBe(false)
    expect(isPointInPolygon({ lat: -33.4595, lng: -70.6595 }, withHole)).toBe(true)
  })
})

describe('formato y caminata', () => {
  it('formatDistance en m y km', () => {
    expect(formatDistance(432.4)).toBe('432 m')
    expect(formatDistance(1740)).toBe('1.7 km')
  })
  it('walkingSeconds usa ~1.3 m/s', () => {
    expect(walkingSeconds(130)).toBeCloseTo(100, 0)
  })
})
