import { AUTO_DETECT_FAILURE_REASONS } from "~/constants/autoDetect"
import { isDenxioSub2ApiUrl } from "~/constants/denxio"
import { isDialogueduiSub2ApiUrl } from "~/constants/dialoguedui"
import { UI_CONSTANTS } from "~/constants/ui"
import { sub2ApiAccountBootstrap } from "~/services/apiAdapters/sub2api/accountBootstrap"
import { AuthTypeEnum } from "~/types"

import type { AccountCompletionCapability } from "../contracts/accountCompletion"

export const sub2ApiAccountCompletion: AccountCompletionCapability = {
  async complete(request, helpers) {
    const { url, detected, context } = request

    const accessToken = helpers.trimString(detected.accessToken)
    if (!accessToken) {
      throw helpers.createCompletionError(
        AUTO_DETECT_FAILURE_REASONS.AccessTokenMissing,
        new Error("access token missing"),
      )
    }

    let siteStatus = null
    try {
      siteStatus = await sub2ApiAccountBootstrap.fetchSiteStatus(
        helpers.createServiceRequest({
          baseUrl: url,
          context,
          auth: {
            authType: AuthTypeEnum.AccessToken,
          },
        }),
      )
    } catch (error) {
      throw helpers.createCompletionError(
        AUTO_DETECT_FAILURE_REASONS.SiteStatusFetchFailed,
        error,
      )
    }

    const supportsCheckIn =
      isDialogueduiSub2ApiUrl(url) || isDenxioSub2ApiUrl(url)

    return {
      username: helpers.trimString(detected.user?.username),
      siteName: await helpers.fetchSiteName(siteStatus),
      accessToken,
      userId: detected.userId.toString(),
      exchangeRate:
        sub2ApiAccountBootstrap.extractDefaultExchangeRate(siteStatus) ??
        UI_CONSTANTS.EXCHANGE_RATE.DEFAULT,
      authType: AuthTypeEnum.AccessToken,
      checkIn: helpers.createInitialCheckInConfig({
        enableDetection: supportsCheckIn,
        autoCheckInEnabled: supportsCheckIn,
      }),
      ...(detected.sub2apiAuth ? { sub2apiAuth: detected.sub2apiAuth } : {}),
    }
  },
}
