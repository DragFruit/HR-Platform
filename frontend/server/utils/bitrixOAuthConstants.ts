/** OAuth-приложение «VBI HR Platform» на бою (:80). На тесте (:8080) — другой CLIENT_ID. */
export const BITRIX_PRODUCTION_CLIENT_ID = 'local.6a3d853b126b27.83139285';

export const BITRIX_STAGING_CALLBACK =
  'http://45.12.74.25:8080/api/auth/bitrix/callback';

export function isProductionBitrixClientId(clientId: string): boolean {
  return clientId.trim() === BITRIX_PRODUCTION_CLIENT_ID;
}
