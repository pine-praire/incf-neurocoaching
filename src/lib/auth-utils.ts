const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function generateTempPassword(): string {
  const rand = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map(b => CHARS[b % CHARS.length])
      .join('')
  return `${rand(4)}-${rand(4)}-${rand(4)}`
}
