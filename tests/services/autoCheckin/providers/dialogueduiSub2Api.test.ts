import { beforeEach, describe, expect, it, vi } from "vitest"

import { SITE_TYPES } from "~/constants/siteType"
import {
  fetchDialogueduiCheckInStatus,
  submitDialogueduiCheckIn,
} from "~/services/apiService/sub2api"
import { resolveAutoCheckinProvider } from "~/services/checkin/autoCheckin/providers"
import { dialogueduiSub2ApiProvider } from "~/services/checkin/autoCheckin/providers/dialogueduiSub2Api"
import type { SiteAccount } from "~/types"
import { CHECKIN_RESULT_STATUS } from "~/types/autoCheckin"

vi.mock("~/services/apiService/sub2api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/services/apiService/sub2api")>()

  return {
    ...actual,
    fetchDialogueduiCheckInStatus: vi.fn(),
    submitDialogueduiCheckIn: vi.fn(),
  }
})

vi.mock("~/services/accounts/sub2apiAuthSession", () => ({
  accountSub2ApiAuthSession: {},
}))

const account = {
  id: "account-1",
  site_type: SITE_TYPES.SUB2API,
  site_url: "https://token.dialoguedui.com",
  authType: "access_token",
  account_info: { id: "7", access_token: "jwt-token" },
  checkIn: { enableDetection: true, autoCheckInEnabled: true },
} as unknown as SiteAccount

describe("dialogueduiSub2ApiProvider", () => {
  beforeEach(() => vi.clearAllMocks())

  it("registers only for the exact Sub2API deployment hostname", () => {
    const resolved = resolveAutoCheckinProvider(account)
    expect(resolved).not.toBeNull()
    expect(resolved!.canCheckIn(account)).toBe(true)
    expect(
      dialogueduiSub2ApiProvider.canCheckIn({
        ...account,
        site_url: "https://token.dialoguedui.com.evil.example",
      }),
    ).toBe(false)
    expect(
      dialogueduiSub2ApiProvider.canCheckIn({
        ...account,
        site_url: "http://token.dialoguedui.com",
      }),
    ).toBe(false)
  })

  it("returns already checked without submitting again", async () => {
    vi.mocked(fetchDialogueduiCheckInStatus).mockResolvedValueOnce({
      signedToday: true,
    })

    await expect(
      dialogueduiSub2ApiProvider.checkIn(account),
    ).resolves.toMatchObject({
      status: CHECKIN_RESULT_STATUS.ALREADY_CHECKED,
    })
    expect(submitDialogueduiCheckIn).not.toHaveBeenCalled()
  })

  it("submits check-in when today's status is pending", async () => {
    vi.mocked(fetchDialogueduiCheckInStatus).mockResolvedValueOnce({
      signedToday: false,
      config: { enabled: true },
    })
    vi.mocked(submitDialogueduiCheckIn).mockResolvedValueOnce({
      alreadyChecked: false,
    })

    await expect(
      dialogueduiSub2ApiProvider.checkIn(account),
    ).resolves.toMatchObject({
      status: CHECKIN_RESULT_STATUS.SUCCESS,
    })
    expect(submitDialogueduiCheckIn).toHaveBeenCalledOnce()
  })

  it("preserves request failures as failed provider results", async () => {
    vi.mocked(fetchDialogueduiCheckInStatus).mockRejectedValueOnce(
      new Error("请先登录后再签到"),
    )

    await expect(
      dialogueduiSub2ApiProvider.checkIn(account),
    ).resolves.toMatchObject({
      status: CHECKIN_RESULT_STATUS.FAILED,
      rawMessage: "请先登录后再签到",
    })
  })
})
