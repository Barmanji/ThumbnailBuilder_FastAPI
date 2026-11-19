import type { StyleInfo } from '@/lib/api'

export const FALLBACK_STYLES: StyleInfo[] = [
  {
    name: 'bold_dramatic',
    label: 'Bold & dramatic',
    description:
      'High contrast, cinematic lighting, dark moody background, powerful composition.',
  },
  {
    name: 'clean_minimal',
    label: 'Clean & minimal',
    description:
      'Bright lighting, light background, plenty of whitespace, sharp professional look.',
  },
  {
    name: 'vibrant_energetic',
    label: 'Vibrant & energetic',
    description:
      'Colorful gradients, dynamic angles, pop-art colors, excited expression.',
  },
]

export function styleLabel(styles: StyleInfo[], name: string): string {
  return styles.find((style) => style.name === name)?.label ?? name.replaceAll('_', ' ')
}
