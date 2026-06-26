import { isBitrixAuthConfigured, getAppPublicOrigin } from '../../utils/bitrixConfig';

export default defineEventHandler((event) => ({
  bitrixAuthEnabled: isBitrixAuthConfigured(),
  appPublicUrl: getAppPublicOrigin(event)
}));
