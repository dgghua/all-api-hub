export const DIALOGUEDUI_SUB2API_HOSTNAME = "token.dialoguedui.com"
export const DIALOGUEDUI_SUB2API_ORIGIN =
  `https://${DIALOGUEDUI_SUB2API_HOSTNAME}` as const

/**
 * Identifies the single Sub2API deployment with the custom check-in contract.
 */
export function isDialogueduiSub2ApiUrl(value: string): boolean {
  try {
    return new URL(value).origin.toLowerCase() === DIALOGUEDUI_SUB2API_ORIGIN
  } catch {
    return false
  }
}
