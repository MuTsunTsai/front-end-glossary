<?php
/**
 * 從 GitHub Releases 更新外掛。
 *
 * 外掛標頭的 Update URI 指向 github.com，WordPress（5.8+）便會透過
 * update_plugins_github.com filter 詢問新版本，而不是去 WordPress.org 查詢。
 * 新版本由 GitHub Actions 在推送 v* tag 時打包並上傳為 Release 附件（front-end-glossary.zip），
 * 見 .github/workflows/release.yml。
 *
 * repo 若為私有，在 wp-config.php 定義 FEG_GITHUB_TOKEN（需有 Contents 讀取權限）。
 */

defined('ABSPATH') || exit;

final class FEG_Updater {

	const REPO = 'MuTsunTsai/front-end-glossary';
	const ASSET_NAME = 'front-end-glossary.zip';
	const TRANSIENT = 'feg_github_release';

	public static function init() {
		add_filter('update_plugins_github.com', array(__CLASS__, 'check_update'), 10, 3);
		add_filter('http_request_args', array(__CLASS__, 'authorize'), 10, 2);
		add_filter('upgrader_source_selection', array(__CLASS__, 'fix_folder_name'), 10, 4);
		// 在「控制台 › 更新」按下「再次檢查」時清除快取；必須早於 WordPress 在同一個 hook 上執行的 wp_update_plugins()
		add_action('load-update-core.php', array(__CLASS__, 'flush_on_force_check'), 1);
		add_action('delete_site_transient_update_plugins', array(__CLASS__, 'flush'));
		add_action('upgrader_process_complete', array(__CLASS__, 'after_upgrade'), 10, 2);
	}

	/**
	 * 更新（或以上傳 zip 覆蓋安裝）本外掛後：清除版本快取，並清除頁面快取。
	 *
	 * 快取的頁面仍是舊版外掛輸出的 <head>（例如沒有載入 Popper），搭配新版的 main.js 會無法運作。
	 * 網站若使用 WP Fastest Cache，透過它的公開勾點清除全部快取；沒安裝該外掛時，這個勾點不會有任何作用。
	 *
	 * @param WP_Upgrader $upgrader
	 * @param array       $options
	 */
	public static function after_upgrade($upgrader, $options) {
		self::flush();
		if (!isset($options['type']) || 'plugin' !== $options['type']) return;
		$plugin = plugin_basename(FEG_FILE);
		$plugins = isset($options['plugins']) ? (array) $options['plugins'] : array();
		if (isset($options['plugin'])) $plugins[] = $options['plugin'];
		$is_ours = in_array($plugin, $plugins, true)
			|| (isset($upgrader->result['destination_name']) && dirname($plugin) === $upgrader->result['destination_name']);
		if ($is_ours) do_action('wpfc_clear_all_cache', true);
	}

	public static function flush_on_force_check() {
		if (!empty($_GET['force-check'])) { // 只是清除快取
			self::flush();
		}
	}

	/**
	 * 回報可用的新版本。
	 *
	 * @param array|false $update
	 * @param array       $plugin_data 外掛的標頭資料。
	 * @param string      $plugin_file 外掛主檔案相對於外掛資料夾的路徑。
	 * @return array|false
	 */
	public static function check_update($update, $plugin_data, $plugin_file) {
		if (plugin_basename(FEG_FILE) !== $plugin_file) return $update;
		$release = self::latest_release();
		if (!$release) return $update;
		return array(
			'slug' => dirname($plugin_file),
			'version' => $release['version'],
			'url' => $release['url'],
			'package' => $release['package'],
		);
	}

	/**
	 * Release 的 zip 根目錄是 front-end-glossary/；網站上的外掛資料夾若是別的名稱（例如當初手動上傳時取的），
	 * 更新時改成原本的名稱，外掛才不會因為路徑改變而被停用。
	 *
	 * @param string      $source        解壓縮後的來源資料夾。
	 * @param string      $remote_source 解壓縮的工作資料夾。
	 * @param WP_Upgrader $upgrader
	 * @param array       $hook_extra
	 * @return string|WP_Error
	 */
	public static function fix_folder_name($source, $remote_source, $upgrader, $hook_extra) {
		global $wp_filesystem;
		$plugin = plugin_basename(FEG_FILE);
		if (!isset($hook_extra['plugin']) || $plugin !== $hook_extra['plugin']) return $source;
		$folder = dirname($plugin);
		if ('.' === $folder || basename($source) === $folder) return $source;
		$target = trailingslashit($remote_source) . $folder . '/';
		return $wp_filesystem->move($source, $target) ? $target : $source;
	}

	/**
	 * 取得最新的 Release，結果快取 1 小時。
	 * 「控制台 › 更新」頁面每次開啟都可能重新檢查，快取可避免超過 GitHub API 未驗證請求每小時 60 次的限制。
	 *
	 * @return array{version: string, url: string, package: string}|null
	 */
	private static function latest_release() {
		$cached = get_site_transient(self::TRANSIENT);
		if (is_array($cached)) return empty($cached['version']) ? null : $cached;

		$release = null;
		$response = wp_remote_get('https://api.github.com/repos/' . self::REPO . '/releases/latest', array(
			'timeout' => 10,
			'headers' => array('Accept' => 'application/vnd.github+json'),
		));
		if (200 === wp_remote_retrieve_response_code($response)) {
			$data = json_decode(wp_remote_retrieve_body($response), true);
			foreach (isset($data['assets']) ? $data['assets'] : array() as $asset) {
				if (self::ASSET_NAME !== $asset['name']) continue;
				$release = array(
					'version' => ltrim((string) $data['tag_name'], 'v'),
					'url' => (string) $data['html_url'],
					// 私有 repo 的附件只能透過 API 下載
					'package' => self::token() ? (string) $asset['url'] : (string) $asset['browser_download_url'],
				);
				break;
			}
		}

		set_site_transient(self::TRANSIENT, $release ? $release : array(), HOUR_IN_SECONDS);
		return $release;
	}

	/**
	 * 對 GitHub API 的請求附上 token（私有 repo 才需要）。
	 *
	 * @param array  $args
	 * @param string $url
	 * @return array
	 */
	public static function authorize($args, $url) {
		$token = self::token();
		if (!$token || 0 !== strpos($url, 'https://api.github.com/repos/' . self::REPO . '/')) return $args;
		$args['headers']['Authorization'] = 'Bearer ' . $token;
		if (false !== strpos($url, '/releases/assets/')) {
			$args['headers']['Accept'] = 'application/octet-stream';
		}
		return $args;
	}

	public static function flush() {
		delete_site_transient(self::TRANSIENT);
	}

	/**
	 * @return string
	 */
	private static function token() {
		return defined('FEG_GITHUB_TOKEN') ? (string) FEG_GITHUB_TOKEN : '';
	}
}
