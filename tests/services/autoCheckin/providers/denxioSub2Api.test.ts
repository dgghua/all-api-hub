import { beforeEach, describe, expect, it, vi } from "vitest"

import { SITE_TYPES } from "~/constants/siteType"
import {
  beginDenxioCheckIn,
  claimDenxioCheckIn,
  fetchDenxioCheckInStatus,
} from "~/services/apiService/sub2api"
import { resolveAutoCheckinProvider } from "~/services/checkin/autoCheckin/providers"
import { denxioSub2ApiProvider } from "~/services/checkin/autoCheckin/providers/denxioSub2Api"
import type { SiteAccount } from "~/types"
import { CHECKIN_RESULT_STATUS } from "~/types/autoCheckin"

vi.mock("~/services/apiService/sub2api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/services/apiService/sub2api")>()

  return {
    ...actual,
    fetchDenxioCheckInStatus: vi.fn(),
    beginDenxioCheckIn: vi.fn(),
    claimDenxioCheckIn: vi.fn(),
  }
})

vi.mock("~/services/accounts/sub2apiAuthSession", () => ({
  accountSub2ApiAuthSession: {},
}))

const account = {
  id: "account-1",
  site_type: SITE_TYPES.SUB2API,
  site_url: "https://api.denxio.top",
  authType: "access_token",
  account_info: { id: "7", access_token: "jwt-token" },
  checkIn: { enableDetection: true, autoCheckInEnabled: true },
} as unknown as SiteAccount

describe("denxioSub2ApiProvider", () => {
  beforeEach(() => vi.clearAllMocks())

  it("resolves through the Sub2API router for the denxio domain", () => {
    const resolved = resolveAutoCheckinProvider(account)
    expect(resolved).not.toBeNull()
    expect(resolved!.canCheckIn(account)).toBe(true)
  })

  it("rejects other Sub2API hostnames", () => {
    expect(
      denxioSub2ApiProvider.canCheckIn({
        ...account,
        site_url: "https://token.dialoguedui.com",
      }),
    ).toBe(false)
    expect(
      denxioSub2ApiProvider.canCheckIn({
        ...account,
        site_url: "http://api.denxio.top",
      }),
    ).toBe(false)
    expect(
      denxioSub2ApiProvider.canCheckIn({
        ...account,
        site_url: "https://api.denxio.top.evil.example",
      }),
    ).toBe(false)
  })

  it("rejects accounts with check-in disabled", () => {
    expect(
      denxioSub2ApiProvider.canCheckIn({
        ...account,
        checkIn: { enableDetection: false, autoCheckInEnabled: false },
      }),
    ).toBe(false)
  })

  it("returns already checked without proceeding to begin", async () => {
    vi.mocked(fetchDenxioCheckInStatus).mockResolvedValueOnce({
      signed_in_today: true,
    })

    await expect(
      denxioSub2ApiProvider.checkIn(account),
    ).resolves.toMatchObject({
      status: CHECKIN_RESULT_STATUS.ALREADY_CHECKED,
    })
    expect(beginDenxioCheckIn).not.toHaveBeenCalled()
    expect(claimDenxioCheckIn).not.toHaveBeenCalled()
  })

  it("executes begin-wait-claim flow when not yet checked in", async () => {
    vi.mocked(fetchDenxioCheckInStatus).mockResolvedValueOnce({
      signed_in_today: false,
    })
    vi.mocked(beginDenxioCheckIn).mockResolvedValueOnce({
      token: "session-token",
      wait_seconds: 1,
    })
    vi.mocked(claimDenxioCheckIn).mockResolvedValueOnce({})

    await expect(
      denxioSub2ApiProvider.checkIn(account),
    ).resolves.toMatchObject({
      status: CHECKIN_RESULT_STATUS.SUCCESS,
    })
    expect(beginDenxioCheckIn).toHaveBeenCalledOnce()
    expect(claimDenxioCheckIn).toHaveBeenCalledOnce()
    expect(claimDenxioCheckIn).toHaveBeenCalledWith(
      expect.anything(),
      "session-token",
    )
  })

  it("preserves request failures as failed provider results", async () => {
    vi.mocked(fetchDenxioCheckInStatus).mockRejectedValueOnce(
      new Error("请先登录后再签到"),
    )

    await expect(
      denxioSub2ApiProvider.checkIn(account),
    ).resolves.toMatchObject({
      status: CHECKIN_RESULT_STATUS.FAILED,
      rawMessage: "请先登录后再签到",
    })
  })
})
