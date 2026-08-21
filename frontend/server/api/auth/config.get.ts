import {
  isBitrixAuthConfigured,
  isStagingUsingProductionBitrixApp,
  stagingBitrixMisconfigMessage
} from '../../utils/bitrixConfig';

export default defineEventHandler(() => {
  const oauthMisconfigured = isStagingUsingProductionBitrixApp();
  // Форма логин/пароль: тот же OAuth-клиент, без PHP на портале.
  // Выключить: BITRIX_PASSWORD_LOGIN=0
  const passwordLoginEnv = String(process.env.BITRIX_PASSWORD_LOGIN || '1').trim();
  const bitrixPasswordLoginEnabled =
    isBitrixAuthConfigured() && !oauthMisconfigured && passwordLoginEnv !== '0';

  return {
    bitrixAuthEnabled: isBitrixAuthConfigured(),
    bitrixPasswordLoginEnabled,
    oauthMisconfigured,
    oauthMisconfiguredHint: oauthMisconfigured ? stagingBitrixMisconfigMessage() : undefined
  };
});
