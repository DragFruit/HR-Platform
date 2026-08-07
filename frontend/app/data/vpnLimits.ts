/** Лимиты VPN-конфигов на одного сотрудника (сервер не резиновый). */
export const VPN_LIMITS = {
  wireguardPerUser: 1,
  amneziaPerUser: 2
} as const;

export const VPN_LIMIT_HINT =
  'Вам доступны 1 WireGuard и 2 AmneziaWG. Одного ключа хватит на разные устройства — просто не включайте VPN на двух сразу.';
