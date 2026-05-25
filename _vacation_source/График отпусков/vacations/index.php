<?php
require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php';

$APPLICATION->SetTitle('График отпусков');

global $USER;
if (!is_object($USER) || !$USER->IsAuthorized()) {
	ShowError('Для просмотра графика отпусков необходимо авторизоваться.');
	require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php';
	return;
}

$vacationsConfig = require __DIR__ . '/config.php';
$vacationsManagerGroupIds = $vacationsConfig['manager_group_ids'] ?? [];
$vacationsHrGroupIds = $vacationsConfig['hr_group_ids'] ?? [];

function vacationsUserHasAnyGroup(array $userGroupIds, array $targetGroupIds): bool
{
	$targets = array_fill_keys(array_map('intval', $targetGroupIds), true);
	foreach ($userGroupIds as $groupId) {
		if (isset($targets[(int)$groupId])) {
			return true;
		}
	}
	return false;
}

function vacationsIsIntranetManager(int $userId): bool
{
	if ($userId <= 0 || !CModule::IncludeModule('intranet') || !class_exists('CIntranetUtils')) {
		return false;
	}

	if (method_exists('CIntranetUtils', 'GetSubordinateDepartments')) {
		$departments = CIntranetUtils::GetSubordinateDepartments($userId, true);
		if (is_array($departments) && $departments !== []) {
			return true;
		}
	}

	return false;
}

$currentUserId = (int)$USER->GetID();
$userGroupIds = CUser::GetUserGroup($currentUserId);
$isAdmin = in_array(1, array_map('intval', $userGroupIds), true);
$userRow = CUser::GetByID($currentUserId)->Fetch();
$currentUserName = trim(implode(' ', array_filter([
	(string)($userRow['LAST_NAME'] ?? ''),
	(string)($userRow['NAME'] ?? ''),
	(string)($userRow['SECOND_NAME'] ?? ''),
])));

$roles = ['employee'];
if (
	$isAdmin
	|| vacationsUserHasAnyGroup($userGroupIds, $vacationsManagerGroupIds)
	|| vacationsIsIntranetManager($currentUserId)
) {
	$roles[] = 'manager';
}
if ($isAdmin || vacationsUserHasAnyGroup($userGroupIds, $vacationsHrGroupIds)) {
	$roles[] = 'hr';
}

$roles = array_values(array_unique($roles));
$defaultRole = in_array('manager', $roles, true) ? 'manager' : (in_array('hr', $roles, true) ? 'hr' : 'employee');

$appPath = __DIR__ . '/app.html';
$isSidePanel = (string)($_GET['sidepanel'] ?? '') === 'Y';
$publicPath = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/vacations/index.php'))), '/');
$publicPath = $publicPath === '' ? '' : $publicPath;
$appParams = [
	'roles' => implode(',', $roles),
	'role' => $defaultRole,
	'bxUserId' => $currentUserId,
	'employee' => $currentUserName,
	'sessid' => bitrix_sessid(),
	'api' => $publicPath . '/api',
	'v' => (file_exists($appPath) ? (string)filemtime($appPath) : '0') . '-' . time(),
];
$appUrl = $publicPath . '/app.html?' . http_build_query($appParams);
?>
<style>
	.vacations-content-page {
		margin: 0;
	}

	.vacations-content-frame {
		display: block;
		width: 100%;
		height: <?= $isSidePanel ? 'calc(100vh - 54px)' : 'calc(100vh - 180px)'; ?>;
		min-height: <?= $isSidePanel ? '720px' : 'calc(100vh - 180px)'; ?>;
		border: 0;
		background: #fff;
	}

	.vacations-content-warning {
		padding: 16px 18px;
		border: 1px solid #f1c40f;
		background: #fff9db;
		color: #5c4b00;
		border-radius: 6px;
	}
</style>

<div class="vacations-content-page">
	<?php if (file_exists($appPath)): ?>
		<iframe
			class="vacations-content-frame"
			src="<?= htmlspecialcharsbx($appUrl); ?>"
			title="График отпусков"
		></iframe>
	<?php else: ?>
		<div class="vacations-content-warning">
			Файл интерфейса не найден. Скопируйте текущий <code>index.html</code> в <code>/vacations/app.html</code>.
		</div>
	<?php endif; ?>
</div>

<?php require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php';
