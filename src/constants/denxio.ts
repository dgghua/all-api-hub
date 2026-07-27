export const DENXIO_SUB2API_HOSTNAME = "api.denxio.top"
export const DENXIO_SUB2API_ORIGIN =
  `https://${DENXIO_SUB2API_HOSTNAME}` as const

export function isDenxioSub2ApiUrl(value: string): boolean {
  try {
    return new URL(value).origin.toLowerCase() === DENXIO_SUB2API_ORIGIN
  } catch {
    return false
  }
}
