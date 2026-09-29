<?php

// The web installer writes passwords, salts and board settings here.
require __DIR__ . '/secrets.php';

// Container addresses can change after a restart. Keep these values current
// without rewriting the configuration saved by the installer.
foreach (array(
    'server' => 'VICHAN_MYSQL_HOST',
    'user' => 'VICHAN_MYSQL_USER',
    'password' => 'VICHAN_MYSQL_PASSWORD',
    'database' => 'VICHAN_MYSQL_NAME',
) as $key => $variable) {
    $value = getenv($variable);
    if ($value !== false) {
        $config['db'][$key] = $value;
    }
}

foreach (array(
    'host' => 'VICHAN_CACHE_HOST',
    'port' => 'VICHAN_CACHE_PORT',
    'password' => 'VICHAN_CACHE_PASSWORD',
) as $key => $variable) {
    $value = getenv($variable);
    if ($value !== false) {
        $config['cache']['redis'][$key] = $key === 'port' ? (int) $value : $value;
    }
}
unset($key, $variable, $value);

$config['twig_auto_reload'] = true;
$config['cookies']['secure_login_only'] = 0;
