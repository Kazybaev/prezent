import http.server
import os
import platform
import socketserver
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8765
URL = f"http://localhost:{PORT}/index.html"
EXT_PATH = ROOT / "auto_login_extension"
PROFILE = ROOT / ".chrome_profile_aizi_v13"

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Permissions-Policy", "microphone=*, camera=*, fullscreen=*")
        super().end_headers()
    def log_message(self, *args):
        pass

def find_chrome():
    system = platform.system().lower()
    candidates = []
    if "windows" in system:
        roots = [os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")]
        names = [r"Google\Chrome\Application\chrome.exe", r"Microsoft\Edge\Application\msedge.exe"]
        for root in roots:
            if root:
                candidates += [Path(root) / name for name in names]
    elif "darwin" in system:
        candidates = [Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")]
    else:
        testing = sorted((Path.home() / ".cache/puppeteer/chrome").glob("*/chrome-linux64/chrome"), reverse=True)
        candidates = testing + [Path("/usr/bin/chromium"), Path("/usr/bin/chromium-browser")]
    for c in candidates:
        if c.exists():
            return str(c)
    return None

class Server(socketserver.TCPServer):
    allow_reuse_address = True


def create_server():
    os.chdir(ROOT)
    return Server(("127.0.0.1", PORT), Handler)

def launch_browser():
    chrome = find_chrome()
    if chrome:
        PROFILE.mkdir(exist_ok=True)
        args = [
            chrome,
            f"--user-data-dir={PROFILE}",
            f"--disable-extensions-except={EXT_PATH}",
            f"--load-extension={EXT_PATH}",
            "--no-first-run",
            "--no-default-browser-check",
            "--new-window",
            "--start-maximized",
            "--autoplay-policy=no-user-gesture-required",
            "--disable-features=BlockInsecurePrivateNetworkRequests,BlockThirdPartyCookies,ThirdPartyStoragePartitioning,TrackingProtection3pcd",
            URL,
        ]
        subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        webbrowser.open(URL)
        print("Chrome/Chromium не найден. Откройте презентацию вручную и установите расширение из папки auto_login_extension.")

def main():
    try:
        httpd = create_server()
    except OSError as exc:
        print(f"Не удалось запустить сервер на 127.0.0.1:{PORT}: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print("OTG Live Demo запущен:", URL)
    print("Закройте это окно после завершения презентации.")
    launch_browser()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nОстановлено.")
    finally:
        httpd.shutdown()
        httpd.server_close()

if __name__ == "__main__":
    main()
