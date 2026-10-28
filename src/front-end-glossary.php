<?php

/**
 * Plugin Name: Front-end Glossary
 * Description: Create glossary tooltips using front-end rendering, maximizing compatibility with other plugins.
 * Version: 1.0.0
 * Author: Mu-Tsun Tsai
 * Requires at least: 5.8
 * Update URI: https://github.com/MuTsunTsai/front-end-glossary
 */

define('DATA', 'feg_data');
define('VER', 'feg_data_version');
define('FEG_FILE', __FILE__);

require_once __DIR__ . '/inc/class-feg-updater.php';
FEG_Updater::init();

/////////////////////////////////////////////////////////////////////////////////////////////
// Activation
/////////////////////////////////////////////////////////////////////////////////////////////

function feg_activate() {
	add_option(DATA, '[]');
	add_option(VER, time());
	register_uninstall_hook(__FILE__, 'feg_uninstall');
}

function feg_uninstall() {
	delete_option(DATA);
	delete_option(VER);
}

register_activation_hook(__FILE__, 'feg_activate');

/////////////////////////////////////////////////////////////////////////////////////////////
// API
/////////////////////////////////////////////////////////////////////////////////////////////

function feg_rest_api(WP_REST_Request $request) {
	$data = get_option(DATA);
	$response = new WP_REST_Response($data);
	$response->header('Cache-Control', 'immutable');
	return $response;
}

add_action('rest_api_init', function () {
	register_rest_route('front-end-glossary', '/(?P<version>\d+)', array(
		'methods' => 'GET',
		'callback' => 'feg_rest_api',
		'permission_callback' => '__return_true',
	));
});

/////////////////////////////////////////////////////////////////////////////////////////////
// Action
/////////////////////////////////////////////////////////////////////////////////////////////

function feg_head() {
	$version = get_option(VER);
	// 加上外掛版本號，更新後瀏覽器才不會繼續使用快取中的舊腳本
	$plugin_version = get_file_data(FEG_FILE, array('Version' => 'Version'))['Version'];
?>
	<script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js" defer></script>
	<script src="<?= plugin_dir_url(__FILE__) ?>js/main.js?ver=<?= esc_attr($plugin_version) ?>" defer data-url="<?= esc_attr(get_rest_url(null, "front-end-glossary/$version")) ?>"></script>
	<style>
		/* 預設樣式；佈景主題的樣式表載入得比較晚，可以直接覆寫 */
		.feg {
			border-bottom: 1px dashed gray;
			white-space: nowrap;
		}

		.feg-popover {
			z-index: 1080;
			max-width: min(20rem, calc(100vw - 1rem));
			padding: .5rem .75rem;
			font-size: .875rem;
			background: #fff;
			border: 1px solid rgba(0, 0, 0, .2);
			box-shadow: 0 .25rem .5rem rgba(0, 0, 0, .15);
		}

		.feg-popover[hidden] {
			display: none;
		}

		.feg-popover__title {
			display: block;
			font-weight: bold;
		}

		.feg-popover__more {
			display: block;
			margin-top: .25rem;
		}
	</style>
<?php
}

add_action('wp_head', 'feg_head', 1);


/////////////////////////////////////////////////////////////////////////////////////////////
// 後端轉換
/////////////////////////////////////////////////////////////////////////////////////////////

// function glo_transform(string $content) {
// 	global $TRP_LANGUAGE;

// 	// 載入文件
// 	$doc = new DOMDocument();
// 	libxml_use_internal_errors(true); // 關閉跟 HTML5 有關的警告
// 	$doc->loadHTML($content);
// 	$body = $doc->getElementsByTagName('body')->item(0);

// 	// 輸出結果
// 	$html = '';
//     foreach ($body->childNodes as $node) $html .= $doc->saveHTML($node);
// 	$html = str_replace('-->', '--&gt;', $html);
	
// 	return "<!-- 測試 $TRP_LANGUAGE $html -->" . $content;
// }
// add_filter('the_content', 'glo_transform', PHP_INT_MAX);

/////////////////////////////////////////////////////////////////////////////////////////////
// Options
/////////////////////////////////////////////////////////////////////////////////////////////

function feg_options_html() {
	if (!current_user_can('manage_options')) return;
	$data = get_option(DATA);
?>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/css/bootstrap.min.css" integrity="undefined" crossorigin="anonymous">
	<style>
		html,
		body {
			scroll-padding: 50px;
		}

		body {
			background-color: #f1f1f1 !important;
		}

		.item {
			padding: 0 .25rem;
			line-height: 1.5;
		}
	</style>
	<script src="https://cdn.jsdelivr.net/npm/vue@2.6.12/dist/vue.js"></script>
	<div class="wrap">
		<h1><?= esc_html(get_admin_page_title()) ?></h1>
		<form action="options.php" method="post" id="feg_form">
			<input type="hidden" name="<?= DATA ?>" value="<?= esc_attr($data) ?>" id="feg_data">
			<input type="hidden" name="<?= VER ?>" value="<?= get_option(VER) ?>" id="feg_data_version">

			<div id="feg_app"></div>

			<?php
			settings_fields('feg');
			submit_button('儲存');
			?>
		</form>
		<script src="<?= plugin_dir_url(__FILE__) ?>js/admin.js"></script>
	</div>
<?php
}

add_action('admin_init', function () {
	register_setting('feg', DATA);
	register_setting('feg', VER, array(
		'type' => 'number'
	));
});

add_action('admin_menu', function () {
	add_menu_page(
		'Front-end Glossary',
		'Glossary',
		'manage_options',
		'feg',
		'feg_options_html',
		'dashicons-book-alt'
	);
});

/////////////////////////////////////////////////////////////////////////////////////////////
// Shortcode
/////////////////////////////////////////////////////////////////////////////////////////////

function feg_shortcode() {
	$json = json_decode(get_option(DATA), true);
	$result = "<ul>\n";
	foreach ($json as $entry) {
		if ($entry['j'] == '') $entry['j'] = '？';
		$id = str_replace(' ', '-', $entry['s']);
		if ($entry['a']) {
			$result .= "<li><p><a id='glossary-$id'>{$entry['s']}</a> : ";
		} else {
			$result .= "<li><p><a id='glossary-$id'>{$entry['s']} / <span lang='ja'>{$entry['j']}</span> / {$entry['c']}</a> : ";
		}
		$result .= "<span class='en-us-only cross-ref'>{$entry['d']}</span>";
		$result .= "<span class='cross-ref'><span class='zh-tw-only'>{$entry['t']}</span>";
		if ($entry['e'] != '') {
			$result .= "<br><span class='zh-tw feg-exp'>{$entry['e']}</span>";
		}
		$result .= "</span></p></li>\n";
	}
	$result .= "</ul>";
	return $result;
}

add_shortcode("feglossary", 'feg_shortcode');
