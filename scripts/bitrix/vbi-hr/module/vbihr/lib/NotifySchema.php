<?php

namespace VbiHr;

/**
 * Схема уведомлений IM: блок «VBI HR» → «Заявки на отпуск».
 * Регистрируется при установке модуля (RegisterModuleDependences).
 */
class NotifySchema
{
	public static function onGetNotifySchema()
	{
		try {
			$disabled = [];
			if (defined('IM_NOTIFY_FEATURE_MAIL')) {
				$disabled[] = constant('IM_NOTIFY_FEATURE_MAIL');
			}
			if (defined('IM_NOTIFY_FEATURE_XMPP')) {
				$disabled[] = constant('IM_NOTIFY_FEATURE_XMPP');
			}

			return [
				'vbihr' => [
					'NAME' => 'VBI HR',
					'NOTIFY' => [
						'vacation' => [
							'NAME' => 'Заявки на отпуск',
							'PUSH' => 'Y',
							'MAIL' => 'N',
							'XMPP' => 'N',
							'DISABLED' => $disabled,
						],
					],
				],
			];
		} catch (\Throwable $e) {
			// Никогда не валим портал из обработчика схемы.
			return [];
		}
	}
}
