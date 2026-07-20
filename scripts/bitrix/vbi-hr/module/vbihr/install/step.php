<?php
if (!check_bitrix_sessid()) {
	return;
}
$lang = defined('LANGUAGE_ID') ? LANGUAGE_ID : 'ru';
echo CAdminMessage::ShowNote('Модуль VBI HR установлен. В настройках уведомлений появится «VBI HR → Заявки на отпуск».');
echo '<p>Положите секрет в <code>/local/vbi-hr/bridge.secret</code> и пропишите URL моста в env HR-сервера.</p>';
echo '<p><a href="module_admin.php?lang=' . htmlspecialcharsbx($lang) . '">К списку модулей</a></p>';
