<?php
/**
 * Регистрация типа уведомлений «VBI HR → Заявки на отпуск» в схеме IM.
 *
 * Подключить на коробке crm.vbi.ru из /local/php_interface/init.php:
 *
 *   require_once $_SERVER['DOCUMENT_ROOT'] . '/local/vbi-hr/notify-schema.php';
 *
 * После этого в Настройки → Уведомления (расширенные) появится блок VBI HR
 * со строкой «Заявки на отпуск». Галка «Неопознанные» для отпусков не нужна.
 *
 * Важно: REST im.notify.system.add этот тип НЕ проставляет.
 * Отправку делать через vacation-notify.php (CIMNotify с NOTIFY_MODULE/EVENT).
 */

use Bitrix\Main\EventManager;

if (!defined('B_PROLOG_INCLUDED') && !defined('ADMIN_SECTION')) {
	// Файл могут подключить до пролога — событие всё равно повесим при загрузке main.
}

$register = static function (): void {
	if (!class_exists(EventManager::class)) {
		return;
	}

	EventManager::getInstance()->addEventHandlerCompatible(
		'im',
		'OnGetNotifySchema',
		static function (): array {
			return [
				'vbihr' => [
					'NAME' => 'VBI HR',
					'NOTIFY' => [
						'vacation' => [
							'NAME' => 'Заявки на отпуск',
							'PUSH' => 'Y',
							'MAIL' => 'N',
							'XMPP' => 'N',
							// Колокольчик на сайте/в приложении — да; почту/xmpp режем.
							'DISABLED' => defined('IM_NOTIFY_FEATURE_MAIL')
								? [IM_NOTIFY_FEATURE_MAIL, IM_NOTIFY_FEATURE_XMPP]
								: [],
						],
					],
				],
			];
		}
	);
};

if (class_exists(EventManager::class)) {
	$register();
} else {
	// init.php обычно уже после main — запасной вариант.
	AddEventHandler('main', 'OnBeforeProlog', static function () use ($register): void {
		static $done = false;
		if ($done) {
			return;
		}
		$done = true;
		$register();
	});
}
