<?php
/**
 * Мост: VBI HR → типизированный колокольчик (CIMNotify, module=vbihr, event=vacation).
 *
 * URL после установки:
 *   https://crm.vbi.ru/local/vbi-hr/vacation-notify.php
 *
 * init.php НЕ нужен и НЕ трогаем.
 */

define('NO_KEEP_STATISTIC', true);
define('NOT_CHECK_PERMISSIONS', true);
define('BX_SECURITY_SESSION_READONLY', true);
define('StopStatistics', true);

if (!isset($_SERVER['DOCUMENT_ROOT']) || $_SERVER['DOCUMENT_ROOT'] === '') {
	$_SERVER['DOCUMENT_ROOT'] = '/home/bitrix/www';
}

$prolog = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/bitrix/modules/main/include/prolog_before.php';
if (!is_readable($prolog)) {
	http_response_code(500);
	header('Content-Type: application/json; charset=utf-8');
	echo '{"ok":false,"error":"PROLOG_NOT_FOUND"}';
	exit;
}

require $prolog;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if (!defined('VBIHR_NOTIFY_MODULE')) {
	define('VBIHR_NOTIFY_MODULE', 'vbihr');
}
if (!defined('VBIHR_NOTIFY_EVENT')) {
	define('VBIHR_NOTIFY_EVENT', 'vacation');
}

function vbiHrBridgeSecret(): string
{
	$fromEnv = getenv('BITRIX_VACATION_NOTIFY_BRIDGE_SECRET');
	if (is_string($fromEnv) && $fromEnv !== '') {
		return $fromEnv;
	}
	$candidates = [
		__DIR__ . '/bridge.secret',
		rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/') . '/local/vbi-hr/bridge.secret',
	];
	foreach ($candidates as $path) {
		if ($path !== '' && is_readable($path)) {
			return trim((string)file_get_contents($path));
		}
	}
	return '';
}

function vbiHrJsonExit(array $payload, int $http = 200): void
{
	http_response_code($http);
	echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

/**
 * CIMNotify::Add кладёт событие в очередь Pull, а отправка на websocket
 * обычно в epilog. У моста epilog нет (exit сразу) — без flush браузер
 * узнаёт об уведомлении только после F5, без всплышки и счётчика.
 */
function vbiHrFlushPull(): void
{
	try {
		if (!\Bitrix\Main\Loader::includeModule('pull')) {
			return;
		}
		if (class_exists('\Bitrix\Pull\Event') && is_callable(['\Bitrix\Pull\Event', 'send'])) {
			\Bitrix\Pull\Event::send();
			return;
		}
		if (isset($GLOBALS['APPLICATION']) && is_object($GLOBALS['APPLICATION'])
			&& method_exists($GLOBALS['APPLICATION'], 'FinalActions')) {
			// FinalActions может завершить скрипт — вызываем только если JSON ещё не отдан.
			$GLOBALS['APPLICATION']->FinalActions();
		}
	} catch (\Throwable $e) {
		// Уведомление уже в БД; сбой flush не должен ломать ответ моста.
	}
}

try {
	if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
		vbiHrJsonExit(['ok' => false, 'error' => 'POST_ONLY'], 405);
	}

	$raw = file_get_contents('php://input') ?: '';
	$data = json_decode($raw, true);
	if (!is_array($data)) {
		vbiHrJsonExit(['ok' => false, 'error' => 'INVALID_JSON'], 400);
	}

	$secret = vbiHrBridgeSecret();
	if ($secret === '' || !hash_equals($secret, (string)($data['secret'] ?? ''))) {
		vbiHrJsonExit(['ok' => false, 'error' => 'FORBIDDEN'], 403);
	}

	$userId = (int)($data['USER_ID'] ?? 0);
	$message = trim((string)($data['MESSAGE'] ?? ''));
	$tag = trim((string)($data['TAG'] ?? ''));
	$subTag = trim((string)($data['SUB_TAG'] ?? ''));

	if ($userId <= 0) {
		vbiHrJsonExit(['ok' => false, 'error' => 'USER_ID_EMPTY'], 400);
	}
	if ($message === '') {
		vbiHrJsonExit(['ok' => false, 'error' => 'MESSAGE_EMPTY'], 400);
	}

	if (!\Bitrix\Main\Loader::includeModule('im')) {
		vbiHrJsonExit(['ok' => false, 'error' => 'IM_MODULE'], 500);
	}

	if (!defined('IM_NOTIFY_SYSTEM') || !class_exists('CIMNotify')) {
		vbiHrJsonExit(['ok' => false, 'error' => 'CIMNotify_MISSING'], 500);
	}

	// Текст для push / OS-оповещения (без BB-кодов). Без PUSH_MESSAGE
	// уведомление часто только в ленте «Уведомления», без всплытия и звука.
	$pushMessage = trim(preg_replace('/\s+/u', ' ', strip_tags(
		preg_replace('/\[[^\]]*\]/', '', $message) ?? $message
	)));
	if ($pushMessage === '') {
		$pushMessage = $message;
	}
	if (function_exists('mb_strlen') && function_exists('mb_substr') && mb_strlen($pushMessage) > 180) {
		$pushMessage = mb_substr($pushMessage, 0, 177) . '...';
	} elseif (strlen($pushMessage) > 180) {
		$pushMessage = substr($pushMessage, 0, 177) . '...';
	}

	$fields = [
		'TO_USER_ID' => $userId,
		'FROM_USER_ID' => 0,
		'NOTIFY_TYPE' => IM_NOTIFY_SYSTEM,
		'NOTIFY_MODULE' => VBIHR_NOTIFY_MODULE,
		'NOTIFY_EVENT' => VBIHR_NOTIFY_EVENT,
		'NOTIFY_TITLE' => 'VBI HR',
		'NOTIFY_MESSAGE' => $message,
		'MESSAGE' => $message,
		'PUSH_MESSAGE' => $pushMessage,
	];

	if ($tag !== '') {
		$fields['NOTIFY_TAG'] = $tag;
	}
	if ($subTag !== '') {
		$fields['NOTIFY_SUB_TAG'] = $subTag;
	}

	$notifyId = \CIMNotify::Add($fields);

	if ($notifyId === false || $notifyId === null || $notifyId === 0) {
		vbiHrJsonExit(['ok' => false, 'error' => 'CIMNotify::Add failed'], 500);
	}

	$n = (int)$notifyId;
	$now = time();
	if ($n >= 1_500_000_000 && $n <= 2_500_000_000 && abs($n - $now) < 120) {
		vbiHrJsonExit([
			'ok' => false,
			'error' => 'fake_timestamp_result',
			'result' => $n,
			'hint' => 'Включите в настройках пользователя тип VBI HR → Заявки на отпуск',
		], 200);
	}

	vbiHrFlushPull();

	vbiHrJsonExit([
		'ok' => true,
		'notifyId' => $n,
		'module' => VBIHR_NOTIFY_MODULE,
		'event' => VBIHR_NOTIFY_EVENT,
		'pullFlushed' => true,
	]);
} catch (\Throwable $e) {
	vbiHrJsonExit([
		'ok' => false,
		'error' => 'EXCEPTION',
		'detail' => $e->getMessage(),
	], 500);
}
