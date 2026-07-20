<?php
if (!check_bitrix_sessid()) {
	return;
}
$lang = defined('LANGUAGE_ID') ? LANGUAGE_ID : 'ru';
echo CAdminMessage::ShowNote('Модуль VBI HR удалён (обработчик схемы снят).');
echo '<p>Файлы <code>/local/vbi-hr/</code> остались — удалите вручную при необходимости.</p>';
echo '<p><a href="module_admin.php?lang=' . htmlspecialcharsbx($lang) . '">К списку модулей</a></p>';
