#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
presentation_uri="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).as_uri())' "$root_dir/index.html")"
profile_dir="$root_dir/.chrome_profile_aizi_v13"
extension_dir="$root_dir/auto_login_extension"

# Официальный Google Chrome 137+ блокирует --load-extension. Сначала используем
# Chrome for Testing / Chromium, где demo-расширение загружается штатно.
cache_root="$(python3 -c 'from pathlib import Path; print(Path.home() / ".cache")')"
testing_chrome="$(find "$cache_root/puppeteer/chrome" -type f -path '*/chrome-linux64/chrome' -perm -u+x 2>/dev/null | sort -V | tail -n 1)"

launch_chrome() {
    local chrome="$1"
    mkdir -p "$profile_dir"
    exec "$chrome" \
        --user-data-dir="$profile_dir" \
        --disable-extensions-except="$extension_dir" \
        --load-extension="$extension_dir" \
        --no-first-run \
        --no-default-browser-check \
        --new-window \
        --start-maximized \
        --autoplay-policy=no-user-gesture-required \
        --disable-features=BlockThirdPartyCookies,ThirdPartyStoragePartitioning,TrackingProtection3pcd \
        --allow-file-access-from-files \
        "$presentation_uri"
}

if [[ -n "$testing_chrome" && -x "$testing_chrome" ]]; then
    launch_chrome "$testing_chrome"
fi

for chrome in chromium chromium-browser; do
    if command -v "$chrome" >/dev/null 2>&1; then
        launch_chrome "$(command -v "$chrome")"
    fi
done

echo "Для live-интеграции требуется Chrome for Testing или Chromium." >&2
echo "Обычный Google Chrome 137+ не загружает demo-расширение из командной строки." >&2

exec xdg-open "$presentation_uri"
