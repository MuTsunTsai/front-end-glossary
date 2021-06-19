<?php

/**
 * Plugin Name: Front-end Glossary
 * Description: Create glossary tooltips using front-end rendering, maximizing compatibility with other plugins.
 * Author: Mu-Tsun Tsai
 */

define('DATA', 'feg_data');
define('VER', 'feg_data_version');

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
?>
	<script src="<?= plugin_dir_url(__FILE__) ?>js/main.js" async defer data-url="<?= esc_attr(get_rest_url(null, "front-end-glossary/$version")) ?>"></script>
	<style>
		.feg {
			border-bottom: 1px dashed gray;
			white-space: nowrap;
		}
	</style>
<?php
}

add_action('wp_head', 'feg_head', 1);

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
			$result .= "<li><p><a id='glossary-$id'>{$entry['s']} / {$entry['j']} / {$entry['c']}</a> : ";
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
