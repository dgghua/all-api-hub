import { isDenxioSub2ApiUrl } from "~/constants/denxio"
import { SITE_TYPES } from "~/constants/siteType"
import { createAccountApiRequestFromStoredAccount } from "~/services/accounts/utils/apiServiceRequest"
import {
  beginDenxioCheckIn,
  claimDenxioCheckIn,
  fetchDenxioCheckInStatus,
} from "~/services/apiService/sub2api"
import type {
  AutoCheckinProvider,
  AutoCheckinProviderContext,
} from "~/services/checkin/autoCheckin/providers"
import {
  AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS,
  resolveProviderErrorResult,
} from "~/services/checkin/autoCheckin/providers/shared"
import type { SiteAccount } from "~/types"
import { CHECKIN_RESULT_STATUS } from "~/types/autoCheckin"
import { normalizeTempWindowRequestSource } from "~/utils/browser/tempWindowRequestSource"

const MAX_WAIT_MS = 60_000

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const denxioSub2ApiProvider: AutoCheckinProvider = {
  canCheckIn(account) {
    return Boolean(
      account.site_type === SITE_TYPES.SUB2API &&
        isDenxioSub2ApiUrl(account.site_url) &&
        account.checkIn?.enableDetection &&
        account.checkIn?.autoCheckInEnabled !== false &&
        account.account_info?.access_token,
    )
  },

  async checkIn(account, context?: AutoCheckinProviderContext) {
    const siteAccount = account as SiteAccount
    if (!this.canCheckIn(siteAccount)) {
      return {
        status: CHECKIN_RESULT_STATUS.FAILED,
        messageKey: AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.checkinFailed,
      }
    }

    const request = {
      ...createAccountApiRequestFromStoredAccount(siteAccount).request,
      baseUrl: new URL(siteAccount.site_url).origin,
      tempWindowRequestSource: normalizeTempWindowRequestSource(
        context?.tempWindowRequestSource,
      ),
    }

    try {
      const status = await fetchDenxioCheckInStatus(request)
      if (status.normal_done) {
        return {
          status: CHECKIN_RESULT_STATUS.ALREADY_CHECKED,
          messageKey:
            AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.alreadyCheckedToday,
          data: status,
        }
      }

      const beginData = await beginDenxioCheckIn(request)
      const waitSeconds = Math.min(
        typeof beginData.wait_seconds === "number" ? beginData.wait_seconds : 3,
        MAX_WAIT_MS / 1000,
      )

      await wait(waitSeconds * 1000)

      const claimData = await claimDenxioCheckIn(request, beginData.token)
      return {
        status: CHECKIN_RESULT_STATUS.SUCCESS,
        messageKey:
          AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.checkinSuccessful,
        data: { begin: beginData, claim: claimData },
      }
    } catch (error) {
      return resolveProviderErrorResult({ error })
    }
  },
}
