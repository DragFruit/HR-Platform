<?php
/**
 * Модуль vbihr — тип уведомлений «VBI HR → Заявки на отпуск».
 * Без правок /local/php_interface/init.php.
 */

IncludeModuleLangFile(__FILE__);

class vbihr extends CModule
{
	public $MODULE_ID = 'vbihr';
	public $MODULE_VERSION;
	public $MODULE_VERSION_DATE;
	public $MODULE_NAME;
	public $MODULE_DESCRIPTION;
	public $PARTNER_NAME = 'VBI';
	public $PARTNER_URI = 'https://vbi.ru';
	public $MODULE_GROUP_RIGHTS = 'N';

	public function __construct()
	{
		$arModuleVersion = [];
		include __DIR__ . '/version.php';
		$this->MODULE_VERSION = $arModuleVersion['VERSION'] ?? '1.0.0';
		$this->MODULE_VERSION_DATE = $arModuleVersion['VERSION_DATE'] ?? '';
		$this->MODULE_NAME = GetMessage('VBIHR_MODULE_NAME');
		if ($this->MODULE_NAME === '' || $this->MODULE_NAME === null) {
			$this->MODULE_NAME = 'VBI HR';
		}
		$this->MODULE_DESCRIPTION = GetMessage('VBIHR_MODULE_DESC');
		if ($this->MODULE_DESCRIPTION === '' || $this->MODULE_DESCRIPTION === null) {
			$this->MODULE_DESCRIPTION = 'Тип уведомлений «Заявки на отпуск» для платформы Vibe';
		}
	}

	public function DoInstall()
	{
		global $APPLICATION;

		if (IsModuleInstalled($this->MODULE_ID)) {
			$APPLICATION->ThrowException('Модуль vbihr уже установлен');
			return false;
		}

		$this->InstallFiles();
		RegisterModule($this->MODULE_ID);
		$this->InstallEvents();

		$APPLICATION->IncludeAdminFile(
			$this->MODULE_NAME,
			__DIR__ . '/step.php'
		);

		return true;
	}

	public function DoUninstall()
	{
		global $APPLICATION;

		$this->UnInstallEvents();
		UnRegisterModule($this->MODULE_ID);

		$APPLICATION->IncludeAdminFile(
			$this->MODULE_NAME,
			__DIR__ . '/unstep.php'
		);

		return true;
	}

	public function InstallEvents()
	{
		RegisterModuleDependences(
			'im',
			'OnGetNotifySchema',
			$this->MODULE_ID,
			'VbiHr\\NotifySchema',
			'onGetNotifySchema'
		);
		return true;
	}

	public function UnInstallEvents()
	{
		UnRegisterModuleDependences(
			'im',
			'OnGetNotifySchema',
			$this->MODULE_ID,
			'VbiHr\\NotifySchema',
			'onGetNotifySchema'
		);
		return true;
	}

	public function InstallFiles()
	{
		$docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
		if ($docRoot === '') {
			return true;
		}

		$src = dirname(__DIR__) . '/tools/vacation-notify.php';
		$destDir = $docRoot . '/local/vbi-hr';
		if (!is_dir($destDir) && !@mkdir($destDir, 0755, true) && !is_dir($destDir)) {
			return true;
		}
		if (is_readable($src)) {
			@copy($src, $destDir . '/vacation-notify.php');
		}
		return true;
	}

	public function UnInstallFiles()
	{
		return true;
	}
}
