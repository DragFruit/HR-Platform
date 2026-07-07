import { isBitrixAuthConfigured, isStagingUsingProductionBitrixApp, stagingBitrixMisconfigMessage } from '../../utils/bitrixConfig';

export default defineEventHandler(() => {
  const oauthMisconfigured = isStagingUsingProductionBitrixApp();

  return {
    bitrixAuthEnabled: isBitrixAuthConfigured(),
    oauthMisconfigured,
    oauthMisconfiguredHint: oauthMisconfigured ? stagingBitrixMisconfigMessage() : null
  };
});
