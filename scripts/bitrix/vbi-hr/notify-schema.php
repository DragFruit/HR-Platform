<?php
/**
 * НЕ ПОДКЛЮЧАТЬ из init.php и не копировать на портал.
 * Устаревший путь. Нужен только модуль: module/vbihr/ → /local/modules/vbihr/
 *
 * Если файл случайно require'нули — молча выходим, без http_response_code/echo
 * (иначе ломается весь сайт).
 */
return;
