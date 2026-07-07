import { isBitrixAuthConfigured } from '../../utils/bitrixConfig';

export default defineEventHandler(() => ({
  bitrixAuthEnabled: isBitrixAuthConfigured()
}));
