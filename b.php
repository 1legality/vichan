<?php

$files = scandir('static/banners/', SCANDIR_SORT_NONE);
$files = array_diff($files, ['.', '..']);
$files = array_filter($files, function($f) {
	return preg_match('/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i', $f);
});

if (empty($files)) {
	http_response_code(404);
	exit;
}

$name = $files[array_rand($files)];
header("Location: /static/banners/$name", true, 307);
header('Cache-Control: no-cache');
