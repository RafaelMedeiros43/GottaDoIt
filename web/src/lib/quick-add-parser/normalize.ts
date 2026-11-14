/** Uma palavra do texto, com a posição no texto original. */
export interface Word {
  /** Texto original, sem pontuação final. */
  raw: string
  /** Em minúsculas e sem acentos, para comparar. */
  norm: string
  start: number
  end: number
}

/** Minúsculas e sem acentos: "Amanhã" → "amanha". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Parte o texto em palavras. A pontuação final ("amanhã,") fica de fora. */
export function splitWords(input: string): Word[] {
  const words: Word[] = []

  for (const match of input.matchAll(/\S+/g)) {
    const raw = match[0].replace(/[,.;!?]+$/, '')
    if (raw === '') continue
    words.push({ raw, norm: normalize(raw), start: match.index, end: match.index + raw.length })
  }

  return words
}

/** Inteiro escrito só com dígitos, ou null. */
export function toInt(text: string | undefined): number | null {
  return text !== undefined && /^\d{1,4}$/.test(text) ? Number(text) : null
}
