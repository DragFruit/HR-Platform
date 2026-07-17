<?php
/**
 * Мост: VBI HR → типизированный колокольчик на коробке Bitrix24.
 *
 * Кладётся на crm.vbi.ru как:
 *   /local/vbi-hr/vacation-notify.php
 *
 * POST JSON:
 *   {
 *     "secret": "...",          // тот же BITRIX_VACATION_NOTIFY_BRIDGE_SECRET
 *     "USER_ID": 848,
 *     "MESSAGE": "...",
 *     "TAG": "VBI_HR_VAC_123_new",
 *     "SUB_TAG": "VBI_HR|vacation|123|new"
 *   }
 *
 * Ответ: { "ok": true, "notifyId": 123 } или { "ok": false, "error": "..." }
 *
 * Рядом положите notify-schema.php и подключите его из init.php (см. README).
 */

define('NO_KEEP_STATISTIC', true);
define('NOT_CHECK_PERMISSIONS', true);
define('BX_SECURITY_SESSION_READONLY', true);

$_SERVER['DOCUMENT_ROOT'] = $_SERVER['DOCUMENT_ROOT'] ?? '/home/bitrix/www';
require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const VBIHR_NOTIFY_MODULE = 'vbihr';
const VBIHR_NOTIFY_EVENT = 'vacation';

/** Секрет: файл рядом или env. Не коммитьте боевой секрет в git. */
function vbiHrBridgeSecret(): string
{
	$fromEnv = getenv('BITRIX_VACATION_NOTIFY_BRIDGE_SECRET');
	if (is_string($fromEnv) && $fromEnv !== '') {
		return $fromEnv;
	}
	$path = __DIR__ . '/bridge.secret';
	if (is_readable($path)) {
		return trim((string)file_get_contents($path));
	}
	return '';
}

function vbiHrJsonExit(array $payload, int $http = 200): void
{
	http_response_code($http);
	echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

$fields = [
	'TO_USER_ID' => $userId,
	'FROM_USER_ID' => 0,
	'NOTIFY_TYPE' => IM_NOTIFY_SYSTEM,
	'NOTIFY_MODULE' => VBIHR_NOTIFY_MODULE,
	'NOTIFY_EVENT' => VBIHR_NOTIFY_EVENT,
	'NOTIFY_MESSAGE' => $message,
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

// Защита от «ложного» timestamp (как у REST для части учёток).
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

vbiHrJsonExit(['ok' => true, 'notifyId' => $n, 'module' => VBIHR_NOTIFY_MODULE, 'event' => VBIHR_NOTIFY_EVENT]);
