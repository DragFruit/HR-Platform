<?php
/**
 * Диагностика и починка служебного чата уведомлений (NotifyChat) на коробке Bitrix24.
 *
 * Запускать НА сервере crm.vbi.ru под админом, например:
 *   php -f /path/to/diagnose-notify-chats.php
 * или временно положить в /local/php_interface/ и открыть из CLI.
 *
 * Контекст: VBI HR — im.notify.system.add для части user_id возвращает unix-timestamp
 * вместо ID уведомления (уведомление не создаётся). У 59/70 сотрудников колокольчик ок.
 *
 * @see https://apidocs.bitrix24.ru/api-reference/chats/notifications/im-notify-system-add.html
 */

use Bitrix\Main\Loader;
use Bitrix\Im\V2\Chat\NotifyChat;

define('NO_KEEP_STATISTIC', true);
define('NOT_CHECK_PERMISSIONS', true);

// Подставьте путь к прологу коробки при запуске не из корня сайта:
$_SERVER['DOCUMENT_ROOT'] = $_SERVER['DOCUMENT_ROOT'] ?? '/home/bitrix/www';
require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';

if (!Loader::includeModule('im')) {
	fwrite(STDERR, "Модуль im не подключен\n");
	exit(1);
}

/** User ID, у которых с VBI HR probe im.notify.system.add даёт timestamp (2026-07-14). */
$FAIL_IDS = [848, 2574, 2579, 2673, 2680, 2697, 2708, 2778, 2801, 2806, 2812];

/** Контрольная выборка, у кого probe был OK. */
$OK_IDS = [1300, 2353, 2684, 2730];

$repair = in_array('--repair', $argv ?? [], true);

function userLabel(int $id): string
{
	$rs = CUser::GetByID($id);
	$u = $rs ? $rs->Fetch() : null;
	if (!$u) {
		return "#{$id} (user not found)";
	}
	$name = trim(($u['LAST_NAME'] ?? '') . ' ' . ($u['NAME'] ?? ''));
	$active = ($u['ACTIVE'] ?? '') === 'Y' ? 'Y' : 'N';
	return "#{$id} {$name} active={$active}";
}

function describeNotifyChat(int $userId): array
{
	$out = [
		'userId' => $userId,
		'find_ok' => false,
		'chat_id' => null,
		'error' => null,
		'add_result' => null,
		'add_ok' => false,
	];

	try {
		$find = NotifyChat::find(['TO_USER_ID' => $userId]);
		if (method_exists($find, 'isSuccess') && !$find->isSuccess()) {
			$out['error'] = implode('; ', method_exists($find, 'getErrorMessages') ? $find->getErrorMessages() : ['find failed']);
			return $out;
		}
		$chat = method_exists($find, 'getResult') ? $find->getResult() : null;
		if ($chat === null) {
			$byUser = NotifyChat::getByUser($userId);
			$chat = $byUser;
		}
		if (is_object($chat) && method_exists($chat, 'getChatId')) {
			$out['chat_id'] = (int)$chat->getChatId();
			$out['find_ok'] = $out['chat_id'] > 0;
		} elseif (is_array($chat) && isset($chat['ID'])) {
			$out['chat_id'] = (int)$chat['ID'];
			$out['find_ok'] = $out['chat_id'] > 0;
		} else {
			$out['error'] = 'NotifyChat не найден / пустой результат find+getByUser';
		}
	} catch (Throwable $e) {
		$out['error'] = $e->getMessage();
	}

	// Прямой CIMNotify::Add — истинный результат (не REST-обёртка).
	try {
		$result = CIMNotify::Add([
			'TO_USER_ID' => $userId,
			'FROM_USER_ID' => 0,
			'NOTIFY_TYPE' => IM_NOTIFY_SYSTEM,
			'NOTIFY_MODULE' => 'im',
			'NOTIFY_EVENT' => 'vbi_hr_diagnose',
			'NOTIFY_TAG' => 'VBI_HR_DIAG_' . $userId . '_' . time(),
			'NOTIFY_MESSAGE' => 'Диагностика VBI HR: тестовое системное уведомление (можно закрыть)',
		]);
		$out['add_result'] = $result;
		$out['add_ok'] = is_numeric($result) && (int)$result > 0 && (int)$result < 1_500_000_000;
	} catch (Throwable $e) {
		$out['error'] = trim(($out['error'] ? $out['error'] . '; ' : '') . $e->getMessage());
	}

	return $out;
}

function tryRepairNotifyChat(int $userId): array
{
	$log = [];
	try {
		// Пересоздать канал: drop + getByUser часто поднимает новый TYPE=S чат.
		$chat = NotifyChat::getByUser($userId);
		if (is_object($chat) && method_exists($chat, 'dropAll')) {
			$chat->dropAll();
			$log[] = 'dropAll() ok';
		} elseif (is_object($chat) && method_exists($chat, 'getChatId') && (int)$chat->getChatId() > 0) {
			$chatId = (int)$chat->getChatId();
			// Запасной путь через старые API, если dropAll недоступен.
			if (class_exists('CIMChat')) {
				$log[] = "chat_id={$chatId} (dropAll недоступен, проверьте вручную b_im_chat/b_im_relation)";
			}
		} else {
			$log[] = 'getByUser пуст — пробуем Add, Bitrix создаст чат сам';
		}
	} catch (Throwable $e) {
		$log[] = 'repair exception: ' . $e->getMessage();
	}

	$after = describeNotifyChat($userId);
	$after['repair_log'] = $log;
	return $after;
}

function printRow(string $group, array $row): void
{
	$label = userLabel((int)$row['userId']);
	$status = $row['add_ok'] ? 'ADD_OK' : 'ADD_FAIL';
	$chat = $row['find_ok'] ? ('chat=' . $row['chat_id']) : ('NO_CHAT ' . ($row['error'] ?? ''));
	echo sprintf(
		"[%s] %-10s %s | %s | add_result=%s\n",
		$group,
		$status,
		$label,
		$chat,
		var_export($row['add_result'], true)
	);
}

echo "=== VBI HR: NotifyChat diagnose ===\n";
echo 'repair=' . ($repair ? 'yes' : 'no') . "\n\n";

echo "--- FAIL ids (REST timestamp) ---\n";
foreach ($FAIL_IDS as $id) {
	$row = $repair ? tryRepairNotifyChat((int)$id) : describeNotifyChat((int)$id);
	printRow('FAIL', $row);
	if (!empty($row['repair_log'])) {
		echo '  repair: ' . implode(' | ', $row['repair_log']) . "\n";
	}
}

echo "\n--- OK control sample ---\n";
foreach ($OK_IDS as $id) {
	printRow('OK', describeNotifyChat((int)$id));
}

echo "\nГотово. Если ADD_FAIL + NO_CHAT — чинить b_im_chat/b_im_relation TYPE=S для user_id.\n";
echo "Если ADD_FAIL при живом chat_id — смотреть OnBeforeMessageNotifyAdd / NOTIFY_BLOCK в b_im_relation.\n";
