import { isDialogueduiSub2ApiUrl } from "~/constants/dialoguedui"
import { SITE_TYPES } from "~/constants/siteType"
import { createAccountApiRequestFromStoredAccount } from "~/services/accounts/utils/apiServiceRequest"
import {
  fetchDialogueduiCheckInStatus,
  submitDialogueduiCheckIn,
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

export const dialogueduiSub2ApiProvider: AutoCheckinProvider = {
  canCheckIn(account) {
    return Boolean(
      account.site_type === SITE_TYPES.SUB2API &&
        isDialogueduiSub2ApiUrl(account.site_url) &&
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
      const current = await fetchDialogueduiCheckInStatus(request)
      if (current.signedToday) {
        return {
          status: CHECKIN_RESULT_STATUS.ALREADY_CHECKED,
          messageKey:
            AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.alreadyCheckedToday,
          data: current,
        }
      }

      if (current.config?.enabled === false) {
        return {
          status: CHECKIN_RESULT_STATUS.FAILED,
          messageKey: AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.checkinFailed,
          data: current,
        }
      }

      const result = await submitDialogueduiCheckIn(request)
      return {
        status: result.alreadyChecked
          ? CHECKIN_RESULT_STATUS.ALREADY_CHECKED
          : CHECKIN_RESULT_STATUS.SUCCESS,
        messageKey: result.alreadyChecked
          ? AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.alreadyCheckedToday
          : AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.checkinSuccessful,
        data: result,
      }
    } catch (error) {
      return resolveProviderErrorResult({ error })
    }
  },
}
