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

function vacationsOpenUserHasAnyGroup(array $userGroupIds, array $targetGroupIds): bool
{
	$targets = array_fill_keys(array_map('intval', $targetGroupIds), true);
	foreach ($userGroupIds as $groupId) {
		if (isset($targets[(int)$groupId])) {
			return true;
		}
	}
	return false;
}

function vacationsOpenIsIntranetManager(int $userId): bool
{
	if ($userId <= 0 || !CModule::IncludeModule('intranet') || !class_exists('CIntranetUtils')) {
		return false;
	}

	if (method_exists('CIntranetUtils', 'GetSubordinateDepartments')) {
		$departments = CIntranetUtils::GetSubordinateDepartments($userId, true);
		return is_array($departments) && $departments !== [];
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
	|| vacationsOpenUserHasAnyGroup($userGroupIds, $vacationsManagerGroupIds)
	|| vacationsOpenIsIntranetManager($currentUserId)
) {
	$roles[] = 'manager';
}
if ($isAdmin || vacationsOpenUserHasAnyGroup($userGroupIds, $vacationsHrGroupIds)) {
	$roles[] = 'hr';
}

$roles = array_values(array_unique($roles));
$defaultRole = in_array('manager', $roles, true) ? 'manager' : (in_array('hr', $roles, true) ? 'hr' : 'employee');
$appPath = __DIR__ . '/app.html';
$publicPath = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/vacations/open.php'))), '/');
$publicPath = $publicPath === '' ? '' : $publicPath;
$appUrl = $publicPath . '/app.html?' . http_build_query([
	'roles' => implode(',', $roles),
	'role' => $defaultRole,
	'bxUserId' => $currentUserId,
	'employee' => $currentUserName,
	'sessid' => bitrix_sessid(),
	'api' => $publicPath . '/api',
	'sidepanel' => 'Y',
	'v' => (file_exists($appPath) ? (string)filemtime($appPath) : '0') . '-' . time(),
]);
?>
<div style="padding: 20px;">
	Открываем график отпусков...
</div>

<script>
	(function () {
		var url = <?= json_encode($appUrl, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
		var viewportWidth = window.innerWidth;

		try {
			viewportWidth = Math.max(
				viewportWidth,
				window.parent ? window.parent.innerWidth : 0,
				window.top ? window.top.innerWidth : 0
			);
		} catch (error) {
			viewportWidth = window.innerWidth;
		}

		if (window.BX && BX.SidePanel && BX.SidePanel.Instance) {
			BX.SidePanel.Instance.open(url, {
				width: Math.max(viewportWidth - 15, 320),
				cacheable: false,
				allowChangeHistory: false,
				label: {
					text: '',
					color: '#ffffff',
					bgColor: '#2fc6f6',
					opacity: 100
				}
			});
			return;
		}

		window.location.href = url;
	})();
</script>

<?php require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php';
