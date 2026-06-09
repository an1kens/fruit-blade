/**
 * Visual and gameplay definitions for each fruit type.
 * Sprite art in assets/fruits/ when loaded; procedural fallback otherwise.
 */
export const FRUIT_DEFS = {
  apple: {
    name: 'Apple',
    radius: 40,
    colors: { main: '#e53935', highlight: '#ff6f60', stem: '#5d4037', leaf: '#43a047' },
    juice: ['#ff4757', '#ff8a80', '#ffcdd2'],
    scoreBonus: 0,
    sliceSound: 'crisp',
  },
  banana: {
    name: 'Banana',
    radius: 48,
    colors: { main: '#fdd835', highlight: '#fff59d', tip: '#8d6e63' },
    juice: ['#ffeb3b', '#fff176', '#fff9c4'],
    scoreBonus: 5,
    sliceSound: 'soft',
  },
  orange: {
    name: 'Orange',
    radius: 38,
    colors: { main: '#fb8c00', highlight: '#ffb74d', segment: '#ef6c00' },
    juice: ['#ff9800', '#ffb74d', '#ffe0b2'],
    scoreBonus: 0,
    sliceSound: 'squish',
  },
  watermelon: {
    name: 'Watermelon',
    radius: 52,
    colors: { main: '#2e7d32', highlight: '#66bb6a', flesh: '#ef5350', seed: '#212121' },
    juice: ['#ff5252', '#ff8a80', '#ffcdd2'],
    scoreBonus: 15,
    sliceSound: 'wet',
  },
  pineapple: {
    name: 'Pineapple',
    radius: 46,
    colors: { main: '#f9a825', highlight: '#ffca28', cross: '#6d4c41', leaf: '#388e3c' },
    juice: ['#ffb300', '#ffee58', '#fff9c4'],
    scoreBonus: 10,
    sliceSound: 'crisp',
  },
  strawberry: {
    name: 'Strawberry',
    radius: 34,
    colors: { main: '#d32f2f', highlight: '#ef5350', seed: '#ffeb3b', leaf: '#2e7d32' },
    juice: ['#f50057', '#ff80ab', '#ffcdd2'],
    scoreBonus: 8,
    sliceSound: 'soft',
  },
  mango: {
    name: 'Mango',
    radius: 42,
    colors: { main: '#ff8f00', highlight: '#ffb300', blush: '#e65100' },
    juice: ['#ffb300', '#ffca28', '#ffe082'],
    scoreBonus: 12,
    sliceSound: 'squish',
  },
  kiwi: {
    name: 'Kiwi',
    radius: 36,
    colors: { main: '#8d6e63', highlight: '#a1887f', flesh: '#aed581', seed: '#212121' },
    juice: ['#aed581', '#c5e1a5', '#dcedc8'],
    scoreBonus: 6,
    sliceSound: 'soft',
  },
  coconut: {
    name: 'Coconut',
    radius: 44,
    colors: { main: '#6d4c41', highlight: '#8d6e63', flesh: '#fff8e1' },
    juice: ['#fff8e1', '#ffe082', '#ffecb3'],
    scoreBonus: 14,
    sliceSound: 'crisp',
  },
  peach: {
    name: 'Peach',
    radius: 40,
    colors: { main: '#ffab91', highlight: '#ffccbc', blush: '#ff7043' },
    juice: ['#ff8a65', '#ffccbc', '#fbe9e7'],
    scoreBonus: 7,
    sliceSound: 'squish',
  },
};

export function getRandomFruitType() {
  const keys = Object.keys(FRUIT_DEFS);
  return keys[Math.floor(Math.random() * keys.length)];
}

export function getFruitDef(type) {
  return FRUIT_DEFS[type] || FRUIT_DEFS.apple;
}
