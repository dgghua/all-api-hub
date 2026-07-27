import { SITE_TYPES } from "~/constants/siteType"
import { denxioSub2ApiProvider } from "~/services/checkin/autoCheckin/providers/denxioSub2Api"
import { dialogueduiSub2ApiProvider } from "~/services/checkin/autoCheckin/providers/dialogueduiSub2Api"
import { newApiProvider } from "~/services/checkin/autoCheckin/providers/newApi"
import type { AutoCheckinProviderResult } from "~/services/checkin/autoCheckin/providers/types"
import { voApiV2Provider } from "~/services/checkin/autoCheckin/providers/voapiV2"
import {
  AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS,
} from "~/services/checkin/autoCheckin/providers/shared"
import type { SiteAccount } from "~/types"
import { CHECKIN_RESULT_STATUS } from "~/types/autoCheckin"
import type { TempWindowRequestSource } from "~/types/tempWindowFetch"

import { AnyrouterCheckInParams, anyrouterProvider } from "./anyrouter"
import { veloeraProvider } from "./veloera"
import { wongGongyiProvider } from "./wong"

/**
 * Auto check-in provider contract.
 *
 * Providers are selected by `SiteAccount.site_type` and should:
 * - Quickly decide eligibility via `canCheckIn`.
 * - Perform the check-in flow via `checkIn` and return a normalized result.
 */
export interface AutoCheckinProvider {
  canCheckIn(account: SiteAccount): boolean
  checkIn(
    account: SiteAccount | AnyrouterCheckInParams,
    context?: AutoCheckinProviderContext,
  ): Promise<AutoCheckinProviderResult>
}

export interface AutoCheckinProviderContext {
  tempWindowRequestSource: TempWindowRequestSource
}

const sub2ApiProviders: AutoCheckinProvider[] = [
  dialogueduiSub2ApiProvider,
  denxioSub2ApiProvider,
]

const sub2ApiRouterProvider: AutoCheckinProvider = {
  canCheckIn(account) {
    return sub2ApiProviders.some((p) => p.canCheckIn(account))
  },
  async checkIn(account, context) {
    const provider = sub2ApiProviders.find((p) => p.canCheckIn(account))
    if (!provider) {
      return {
        status: CHECKIN_RESULT_STATUS.FAILED,
        messageKey: AUTO_CHECKIN_PROVIDER_FALLBACK_MESSAGE_KEYS.checkinFailed,
      }
    }
    return provider.checkIn(account, context)
  },
}

const providers: Record<string, AutoCheckinProvider> = {
  [SITE_TYPES.ANYROUTER]: anyrouterProvider,
  [SITE_TYPES.VELOERA]: veloeraProvider,
  [SITE_TYPES.WONG_GONGYI]: wongGongyiProvider,
  [SITE_TYPES.NEW_API]: newApiProvider,
  [SITE_TYPES.VO_API_V2]: voApiV2Provider,
  [SITE_TYPES.SUB2API]: sub2ApiRouterProvider,
}

/**
 * Resolve the auto check-in provider based on the site type of the given account
 * @param account - The site account to resolve the provider for
 * @returns The resolved auto check-in provider, or null if no provider is found
 */
export function resolveAutoCheckinProvider(
  account: SiteAccount,
): AutoCheckinProvider | null {
  const provider = providers[account.site_type]
  return provider ?? null
}
