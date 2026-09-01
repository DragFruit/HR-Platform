import {
  isBitrixAuthConfigured,
  isStagingUsingProductionBitrixApp,
  stagingBitrixMisconfigMessage
} from '../../utils/bitrixConfig';

export default defineEventHandler(() => {
  const oauthMisconfigured = isStagingUsingProductionBitrixApp();
  // Локальные пароли Vibe — по умолчанию да. Выключить: VIBE_PASSWORD_LOGIN=0
  const vibePasswordLoginEnabled = String(process.env.VIBE_PASSWORD_LOGIN || '1').trim() !== '0';
  // OAuth password grant к Bitrix — по умолчанию выкл (нужна сеть Vibe→crm и grant на портале)
  const bitrixPasswordLoginEnv = String(process.env.BITRIX_PASSWORD_LOGIN || '0').trim();
  const bitrixPasswordLoginEnabled =
    isBitrixAuthConfigured() &&
    !oauthMisconfigured &&
    bitrixPasswordLoginEnv === '1';

  return {
    bitrixAuthEnabled: isBitrixAuthConfigured(),
    vibePasswordLoginEnabled,
    bitrixPasswordLoginEnabled,
    oauthMisconfigured,
    oauthMisconfiguredHint: oauthMisconfigured ? stagingBitrixMisconfigMessage() : undefined
  };
});
