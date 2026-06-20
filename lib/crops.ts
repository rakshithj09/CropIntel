export const CROPS = {
  corn: 'Corn',
  soybean: 'Soybean',
  wheat: 'Wheat',
  rice: 'Rice',
  tomato: 'Tomato',
} as const

export type CropType = keyof typeof CROPS
