import argparse
import importlib
import json
import os
import shutil
import site
import subprocess
import sys
import time
from urllib.parse import urlparse


AUTH_SEND_PATH = "/v1/auth/email-otp/send-verification-otp"
AUTH_SIGN_IN_PATH = "/v1/auth/sign-in/email-otp"
AUTH_GET_SESSION_PATH = "/v1/auth/get-session"
API_URL = os.environ.get("API_URL", "https://api.stagewise.io").rstrip("/")
BOOTSTRAP_TIMEOUT_SECONDS = 600
PROXY_ENV_NAMES = ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")
MMDB_MARKER = b"\xab\xcd\xefMaxMind.com"


def emit(event, **data):
    payload = {"event": event, **data}
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def configure_proxy_env(proxy_url):
    if not proxy_url:
        return
    for name in PROXY_ENV_NAMES:
        os.environ.setdefault(name, proxy_url)


def build_bootstrap_env(proxy_url=None):
    env = os.environ.copy()
    if proxy_url:
        for name in PROXY_ENV_NAMES:
            env[name] = proxy_url
    return env


def build_direct_env():
    env = os.environ.copy()
    for name in PROXY_ENV_NAMES:
        env.pop(name, None)
    return env


def run_bootstrap_command(args, message, env=None):
    emit("step", message=message)
    completed = subprocess.run(
        args,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=BOOTSTRAP_TIMEOUT_SECONDS,
        env=env,
    )
    output = (completed.stdout or "").strip()
    if output:
        emit("step", message=output[-900:])
    if completed.returncode != 0:
        raise RuntimeError(
            "Python 依赖安装命令失败："
            + " ".join(args)
            + "，退出码="
            + str(completed.returncode)
            + ("，输出：" + output[-900:] if output else "")
        )


def refresh_python_import_paths():
    candidates = []
    try:
        user_site = site.getusersitepackages()
        if isinstance(user_site, str):
            candidates.append(user_site)
        else:
            candidates.extend(user_site)
    except Exception:
        pass
    try:
        candidates.extend(site.getsitepackages())
    except Exception:
        pass

    added = []
    for candidate in candidates:
        if candidate and os.path.isdir(candidate) and candidate not in sys.path:
            sys.path.insert(0, candidate)
            added.append(candidate)
    if added:
        emit("step", message="已刷新 Python 依赖搜索路径: " + "; ".join(added))


def is_valid_mmdb(path):
    try:
        if not os.path.isfile(path) or os.path.getsize(path) < 1024 * 1024:
            return False
        import maxminddb

        with maxminddb.open_database(path) as reader:
            reader.metadata()
        return True
    except Exception:
        return False


def find_bundled_mmdb():
    candidates = []
    resource_dir = os.environ.get("STAGEWISE_CAMOUFOX_RESOURCE_DIR", "").strip()
    if resource_dir:
        candidates.append(os.path.join(resource_dir, "GeoLite2-City.mmdb"))
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates.extend(
        [
            os.path.join(script_dir, "camoufox", "GeoLite2-City.mmdb"),
            os.path.join(script_dir, "..", "..", "..", "assets", "camoufox", "GeoLite2-City.mmdb"),
            os.path.join(
                os.getcwd(),
                "apps",
                "browser",
                "assets",
                "camoufox",
                "GeoLite2-City.mmdb",
            ),
            os.path.join(os.getcwd(), "assets", "camoufox", "GeoLite2-City.mmdb"),
        ]
    )
    for candidate in candidates:
        normalized = os.path.abspath(candidate)
        if is_valid_mmdb(normalized):
            return normalized
    return ""


def prepare_camoufox_mmdb():
    try:
        import camoufox.locale as camoufox_locale
    except Exception:
        return

    target = str(camoufox_locale.MMDB_FILE)
    bundled = find_bundled_mmdb()
    if is_valid_mmdb(target):
        return
    if os.path.exists(target):
        try:
            os.remove(target)
            emit("step", message="已删除损坏的 Camoufox GeoIP 数据库: " + target)
        except Exception as exc:
            emit("step", message="删除损坏的 Camoufox GeoIP 数据库失败: " + str(exc))
    if not bundled:
        emit("step", message="未找到随包携带的 Camoufox GeoIP 数据库，将由 Camoufox 下载")
        return
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copyfile(bundled, target)
    emit("step", message="已使用随包 GeoIP 数据库: " + bundled)


def is_mmdb_open_error(exc):
    message = str(exc).lower()
    return "error opening database file" in message or "valid maxmind db" in message


def reset_camoufox_mmdb_after_error():
    try:
        import camoufox.locale as camoufox_locale
    except Exception:
        return False
    target = str(camoufox_locale.MMDB_FILE)
    if os.path.exists(target):
        try:
            os.remove(target)
            emit("step", message="Camoufox GeoIP 数据库损坏，已删除并准备重试: " + target)
        except Exception as exc:
            emit("step", message="删除损坏的 Camoufox GeoIP 数据库失败: " + str(exc))
            return False
    prepare_camoufox_mmdb()
    return True


def run_pip_install_with_proxy_fallback(
    requirement,
    proxy_url,
    reason,
    user_install=True,
):
    base_args = [sys.executable, "-m", "pip", "install"]
    if user_install:
        base_args.append("--user")
    base_args.append(requirement)
    if proxy_url:
        proxy_args = [*base_args, "--proxy", proxy_url]
        try:
            run_bootstrap_command(
                proxy_args,
                reason + "；正在通过代理安装 Python 依赖: " + proxy_url,
                env=build_bootstrap_env(proxy_url),
            )
            return
        except Exception as exc:
            emit(
                "step",
                message=(
                    "通过代理安装 Python 依赖失败，改用直连重试。"
                    + "如果直连也失败，请检查本机代理或 Python 网络环境。"
                    + "代理安装错误："
                    + str(exc)
                )[-900:],
            )

    run_bootstrap_command(
        base_args,
        reason + "；正在直连安装 Python 依赖",
        env=build_direct_env(),
    )


def install_requirement_and_refresh(requirement, proxy_url, reason):
    run_pip_install_with_proxy_fallback(requirement, proxy_url, reason)
    importlib.invalidate_caches()
    refresh_python_import_paths()


def explain_python_environment_error(detail):
    return (
        "Camoufox 本地 Python 环境错误："
        + detail
        + "。当前 Python: "
        + sys.executable
        + "。这通常是 pip 安装到不同 Python 环境、代理/网络导致依赖安装不完整，"
        + "或 Camoufox 已导入后没有刷新 GeoIP extra 状态。"
        + '可手动验证："'
        + sys.executable
        + '" -m pip install --user "camoufox[geoip]"'
    )


def user_facing_error_message(exc):
    message = str(exc)
    if message.startswith("Camoufox 本地 Python 环境错误："):
        return message
    lower = message.lower()
    if "geoip extra" in lower or "camoufox[geoip]" in lower:
        return explain_python_environment_error(
            "Camoufox 代理模式需要 GeoIP extra，但当前进程仍未识别该依赖。原始错误："
            + message
        )
    if "error opening database file" in lower or "valid maxmind db" in lower:
        return (
            "Camoufox GeoIP 数据库损坏或不完整，代理模式无法读取地区指纹数据。"
            + "已尝试删除损坏文件并用随包数据库恢复；如果仍失败，请重新运行 build-fast.bat "
            + "预置 GeoLite2-City.mmdb。原始错误："
            + message
        )
    if "bootstrap command failed" in lower or "pip install" in lower:
        return explain_python_environment_error("Python 依赖安装失败。原始错误：" + message)
    return message


def ensure_camoufox_available(proxy_url):
    configure_proxy_env(proxy_url)
    refresh_python_import_paths()
    if os.environ.get("STAGEWISE_CAMOUFOX_AUTO_INSTALL") == "0":
        import camoufox  # noqa: F401
        return

    try:
        import camoufox  # noqa: F401
    except ModuleNotFoundError:
        install_requirement_and_refresh(
            "camoufox",
            proxy_url,
            "缺少 Camoufox Python 包",
        )
        try:
            import camoufox  # noqa: F401
        except ModuleNotFoundError as exc:
            emit(
                "step",
                message=(
                    "pip --user 安装后当前进程仍无法导入 camoufox，"
                    + "改用当前 Python 环境安装重试"
                ),
            )
            run_pip_install_with_proxy_fallback(
                "camoufox",
                proxy_url,
                "当前 Python 环境缺少 Camoufox Python 包",
                user_install=False,
            )
            importlib.invalidate_caches()
            refresh_python_import_paths()
            try:
                import camoufox  # noqa: F401
            except ModuleNotFoundError as retry_exc:
                raise RuntimeError(
                    explain_python_environment_error(
                        "已尝试安装 camoufox，但当前 Python 仍无法导入 camoufox"
                    )
                ) from retry_exc

    if proxy_url:
        ensure_camoufox_geoip_available(proxy_url)

    try:
        from camoufox.pkgman import launch_path

        launch_path()
    except Exception:
        # camoufox_path(download_if_missing=True) uses Camoufox's own fetcher
        # and downloads/updates the browser binary when it is absent.
        emit("step", message="Camoufox browser binary missing; fetching")
        from camoufox.pkgman import camoufox_path, launch_path

        camoufox_path(download_if_missing=True)
        launch_path()


def install_camoufox_geoip_extra(proxy_url):
    configure_proxy_env(proxy_url)
    install_requirement_and_refresh(
        "camoufox[geoip]",
        proxy_url,
        "缺少 Camoufox GeoIP extra",
    )


def refresh_camoufox_geoip_state():
    try:
        import geoip2.database  # noqa: F401
        import maxminddb  # noqa: F401
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            explain_python_environment_error(
                "缺少 GeoIP 依赖 geoip2/maxminddb，代理模式需要该依赖"
            )
        ) from exc

    import camoufox.locale as camoufox_locale

    importlib.reload(camoufox_locale)
    prepare_camoufox_mmdb()
    try:
        camoufox_locale.geoip_allowed()
    except Exception as exc:
        raise RuntimeError(
            explain_python_environment_error(
                "GeoIP 依赖已安装，但 Camoufox 仍未识别 camoufox[geoip]"
            )
        ) from exc


def ensure_camoufox_geoip_available(proxy_url):
    try:
        refresh_camoufox_geoip_state()
    except Exception:
        install_camoufox_geoip_extra(proxy_url)
        try:
            refresh_camoufox_geoip_state()
        except Exception:
            emit(
                "step",
                message=(
                    "pip --user 安装后当前进程仍无法导入 GeoIP 依赖，"
                    + "改用当前 Python 环境安装重试"
                ),
            )
            run_pip_install_with_proxy_fallback(
                "camoufox[geoip]",
                proxy_url,
                "当前 Python 环境缺少 Camoufox GeoIP extra",
                user_install=False,
            )
            importlib.invalidate_caches()
            refresh_python_import_paths()
            refresh_camoufox_geoip_state()


def parse_proxy(proxy_url):
    if not proxy_url:
        return None
    parsed = urlparse(proxy_url)
    if not parsed.scheme or not parsed.netloc:
        return {"server": proxy_url}
    server = f"{parsed.scheme}://{parsed.hostname}"
    if parsed.port:
        server += f":{parsed.port}"
    proxy = {"server": server}
    if parsed.username:
        proxy["username"] = parsed.username
    if parsed.password:
        proxy["password"] = parsed.password
    return proxy


def accept_cookie_banner(page):
    for name in ("Accept", "I agree", "Allow all"):
        try:
            button = page.get_by_role("button", name=name)
            if button.count() > 0 and button.first.is_visible(timeout=500):
                button.first.click(timeout=1000)
                emit("step", message=f"clicked cookie button: {name}")
                return
        except Exception:
            pass


def fill_email_and_submit(page, email):
    selector = 'input[type="email"], input[name="email"], input[autocomplete="email"]'
    page.wait_for_selector(selector, state="visible", timeout=60000)

    def confirm_email_value(timeout=10000):
        page.wait_for_function(
            """
            (expected) => {
              const input =
                document.querySelector('input[type="email"]') ||
                document.querySelector('input[name="email"]') ||
                document.querySelector('input[autocomplete="email"]');
              return input && input.value === expected;
            }
            """,
            arg=email,
            timeout=timeout,
        )

    def force_email_value():
        return page.evaluate(
            """
            (expected) => {
              const input =
                document.querySelector('input[type="email"]') ||
                document.querySelector('input[name="email"]') ||
                document.querySelector('input[autocomplete="email"]');
              if (!input) return { ok: false, value: '', reason: 'input missing' };
              input.focus();
              const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              )?.set;
              if (setter) setter.call(input, expected);
              else input.value = expected;
              input.dispatchEvent(
                new InputEvent('input', {
                  bubbles: true,
                  inputType: 'insertText',
                  data: expected,
                })
              );
              input.dispatchEvent(new Event('change', { bubbles: true }));
              return { ok: input.value === expected, value: input.value || '' };
            }
            """,
            arg=email,
        )

    def read_email_state():
        return page.evaluate(
            """
            () => {
              const input =
                document.querySelector('input[type="email"]') ||
                document.querySelector('input[name="email"]') ||
                document.querySelector('input[autocomplete="email"]');
              return {
                exists: !!input,
                value: input && typeof input.value === 'string' ? input.value : '',
                disabled: !!(input?.disabled || input?.readOnly),
                invalid: !!input?.matches(':invalid'),
                validationMessage: input?.validationMessage || '',
              };
            }
            """
        )

    def type_email(reason):
        email_input = page.locator(selector).first
        email_input.scroll_into_view_if_needed(timeout=5000)
        forced = force_email_value()
        if not forced.get("ok"):
            try:
                email_input.fill(email, timeout=5000)
            except Exception as exc:
                raise RuntimeError(
                    "邮箱输入失败：输入框已找到，但无法写入邮箱。"
                    + "这通常是页面脚本拦截输入、输入框被覆盖，或浏览器自动化点击/输入动作卡住。"
                    + "原始错误："
                    + str(exc)
                ) from exc
        try:
            confirm_email_value(timeout=3000)
        except Exception as exc:
            forced = force_email_value()
            if not forced.get("ok"):
                raise RuntimeError(
                    "邮箱输入失败：写入后页面没有保留邮箱值。原因："
                    + forced.get("reason", "value mismatch")
                    + "；当前值="
                    + forced.get("value", "")
                ) from exc
            confirm_email_value(timeout=3000)
        emit("step", message="email input value confirmed: " + email + " (" + reason + ")")

    type_email("initial fill")

    last_result = None
    reset_logged = False
    waiting_logged = False
    waiting_cycles = 0
    deadline = time.time() + 45
    while time.time() < deadline:
        state = read_email_state()
        if state.get("disabled"):
            page.wait_for_timeout(300)
            continue
        if state.get("value") != email:
            if not reset_logged:
                emit(
                    "step",
                    message="email input was reset; refilling. current value="
                    + state.get("value", ""),
                )
                reset_logged = True
            type_email("refill after page reset")
            page.wait_for_timeout(300)
            continue

        result = page.evaluate(
        """
        (expected) => {
          const emailInput =
            document.querySelector('input[type="email"]') ||
            document.querySelector('input[name="email"]') ||
            document.querySelector('input[autocomplete="email"]');
          const getText = (el) =>
            [
              el.getAttribute('aria-label'),
              el.getAttribute('title'),
              el.textContent,
              el.value,
            ]
              .filter(Boolean)
              .join(' ')
              .replace(/\\s+/g, ' ')
              .trim();
          const isVisible = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const isDisabled = (el) =>
            !!(
              el.disabled ||
              el.hasAttribute('disabled') ||
              el.getAttribute('aria-disabled') === 'true' ||
              el.getAttribute('data-disabled') === 'true'
            );
          const isSocial = (el) =>
            /google|github|microsoft|apple|discord|facebook|continue\\s+with|sign\\s+in\\s+with/i.test(
              getText(el)
            );
          const isPrimary = (el) => {
            const text = getText(el).toLowerCase();
            if (/send code|send|continue|next|submit|sign in|log in|login|email|otp|code/.test(text)) {
              return true;
            }
            return el.getAttribute('type') === 'submit';
          };
          const summarizeButtons = () =>
            Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
              .slice(0, 20)
              .map((el) => ({
                text: getText(el).slice(0, 80),
                type: el.getAttribute('type') || '',
                role: el.getAttribute('role') || '',
                disabled: isDisabled(el),
                visible: isVisible(el),
              }));
          if (!emailInput) {
            return { ok: false, reason: 'email input missing', value: '', buttons: summarizeButtons() };
          }
          if (emailInput.value !== expected) {
            return {
              ok: false,
              reason: 'email value changed before submit',
              value: emailInput.value || '',
              buttons: summarizeButtons(),
            };
          }
          const candidatesFor = (scope) =>
            Array.from(scope.querySelectorAll('button, [role="button"], input[type="submit"]'))
              .filter(isVisible)
              .filter((el) => !isDisabled(el))
              .filter((el) => !isSocial(el));
          const pickButton = () => {
            const scopes = [];
            const form = emailInput?.form || emailInput?.closest('form');
            if (form) scopes.push(form);
            scopes.push(document);
            for (const scope of scopes) {
              const candidates = candidatesFor(scope);
              const primary = candidates.find(isPrimary);
              if (primary) return primary;
              if (scope !== document && candidates.length === 1) return candidates[0];
            }
            return null;
          };
          const button = pickButton();
          if (!button) {
            return {
              ok: false,
              reason: 'submit button disabled or not ready',
              value: emailInput.value || '',
              buttons: summarizeButtons(),
            };
          }
          button.scrollIntoView({ block: 'center', inline: 'nearest' });
          button.click();
          return {
            ok: true,
            text: getText(button),
            value: emailInput.value || '',
            buttons: summarizeButtons(),
          };
        }
        """,
            arg=email,
        )
        last_result = result
        if result.get("ok"):
            page.wait_for_timeout(500)
            post_click = read_email_state()
            if post_click.get("invalid") and not post_click.get("value"):
                raise RuntimeError(
                    "email submit failed: input empty after click; validation="
                    + post_click.get("validationMessage", "")
                )
            emit("step", message="clicked submit button: " + result.get("text", ""))
            return
        if result.get("reason") == "email value changed before submit":
            continue
        waiting_cycles += 1
        if waiting_cycles % 6 == 0:
            force_email_value()
        if not waiting_logged:
            emit(
                "step",
                message="submit button not ready; waiting. buttons="
                + json.dumps(result.get("buttons", []), ensure_ascii=True)[:900],
            )
            waiting_logged = True
        page.wait_for_timeout(500)

    raise RuntimeError(
        "email submit failed: submit button did not become ready; last="
        + json.dumps(last_result or {}, ensure_ascii=True)[:1200]
    )


def probe_otp_state(page):
    return page.evaluate(
        """
        () => {
          const isVisible = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const isEditableTextInput = (el) => {
            if (!isVisible(el) || el.disabled || el.readOnly) return false;
            const type = (el.getAttribute('type') || 'text').toLowerCase();
            return ![
              'hidden',
              'email',
              'password',
              'checkbox',
              'radio',
              'submit',
              'button',
            ].includes(type);
          };
          const textFor = (el) =>
            [
              el.getAttribute('aria-label'),
              el.getAttribute('name'),
              el.getAttribute('id'),
              el.getAttribute('placeholder'),
              el.closest('label')?.innerText,
              el.parentElement?.innerText,
            ]
              .filter(Boolean)
              .join(' ')
              .replace(/\\s+/g, ' ')
              .trim();
          const bodyText = (document.body?.innerText || '').replace(/\\s+/g, ' ');
          const editableInputs = Array.from(document.querySelectorAll('input'))
            .filter(isEditableTextInput);
          const codeLikeInputs = editableInputs.filter((input) => {
            const text = textFor(input);
            const placeholder = input.getAttribute('placeholder') || '';
            return (
              /otp|code|verification/i.test(text) ||
              /^\\d{6}$/.test(placeholder.trim())
            );
          });
          const hasOtp = !!(
            document.querySelector('input[autocomplete="one-time-code"]') ||
            document.querySelector('input[name="otp"]') ||
            document.querySelector('input[name="code"]') ||
            document.querySelector('input[placeholder*="code" i]') ||
            document.querySelector('input[placeholder*="otp" i]') ||
            document.querySelector('input[placeholder="123456"]') ||
            codeLikeInputs.length > 0 ||
            (
              /enter verification code|verification code|6-digit code/i.test(bodyText) &&
              editableInputs.length === 1
            ) ||
            document.querySelectorAll('input[inputmode="numeric"]').length >= 6 ||
            document.querySelectorAll('input[maxlength="1"]').length >= 6
          );
          const errorMatch = bodyText.match(
            /(Missing CAPTCHA response|Security verification failed|Error sending code\\. Please try again\\.)/i
          );
          return {
            hasOtp,
            error: errorMatch ? errorMatch[1] : '',
            text: bodyText.slice(0, 500),
            url: location.href,
          };
        }
        """
    )


def emit_otp_ready_once(state):
    if state.get("otp_ready_emitted"):
        return
    state["otp_ready_emitted"] = True
    emit("otp-ready")


def wait_for_otp_request_or_form(page, state, timeout_ms):
    deadline = time.time() + timeout_ms / 1000
    last_log = 0
    while time.time() < deadline:
        if state.get("otp_requested"):
            emit_otp_ready_once(state)
            return
        page_state = probe_otp_state(page)
        if page_state.get("hasOtp"):
            emit_otp_ready_once(state)
            return
        if page_state.get("error"):
            raise RuntimeError(
                "page auth error: "
                + page_state.get("error", "")
                + " url="
                + page_state.get("url", "")
            )
        now = time.time()
        if now - last_log >= 5:
            last_log = now
            emit("step", message="waiting for send-verification-otp response or OTP form")
        page.wait_for_timeout(500)
    raise TimeoutError("timed out waiting for send-verification-otp response or OTP form")


def wait_until_otp_input_visible(page, timeout_ms):
    deadline = time.time() + timeout_ms / 1000
    last_log = 0
    while time.time() < deadline:
        state = probe_otp_state(page)
        if state.get("hasOtp"):
            return
        if state.get("error"):
            raise RuntimeError(
                "page auth error: "
                + state.get("error", "")
                + " url="
                + state.get("url", "")
            )
        now = time.time()
        if now - last_log >= 5:
            last_log = now
            emit("step", message="waiting for OTP input after mailbox code")
        page.wait_for_timeout(500)
    raise TimeoutError("mailbox OTP acquired but page OTP input did not appear")


def read_otp_from_stdin():
    line = sys.stdin.readline()
    if not line:
        raise RuntimeError("stdin closed before OTP")
    data = json.loads(line)
    otp = str(data.get("otp", "")).strip()
    if not otp:
        raise RuntimeError("empty OTP from parent")
    return otp


def extract_auth_token(body):
    if not isinstance(body, dict):
        return ""
    token = body.get("token")
    if isinstance(token, str) and token:
        return token
    session = body.get("session")
    if isinstance(session, dict):
        token = session.get("token")
        if isinstance(token, str) and token:
            return token
    data = body.get("data")
    if isinstance(data, dict):
        return extract_auth_token(data)
    return ""


def capture_token_from_response(state, response, source):
    token = ""
    try:
        body = response.json()
        token = extract_auth_token(body)
    except Exception:
        token = ""
    if not token:
        try:
            headers = response.headers
            token = headers.get("set-auth-token") or headers.get("Set-Auth-Token") or ""
        except Exception:
            token = ""
    if token:
        state["token"] = token
        emit("step", message=f"captured session token via {source} (len={len(token)})")
    return token


def fill_otp_and_submit(page, otp):
    target = page.evaluate(
        """
        () => {
          const isVisible = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const isEditableTextInput = (el) => {
            if (!isVisible(el) || el.disabled || el.readOnly) return false;
            const type = (el.getAttribute('type') || 'text').toLowerCase();
            return ![
              'hidden',
              'email',
              'password',
              'checkbox',
              'radio',
              'submit',
              'button',
            ].includes(type);
          };
          const textFor = (el) =>
            [
              el.getAttribute('aria-label'),
              el.getAttribute('name'),
              el.getAttribute('id'),
              el.getAttribute('placeholder'),
              el.closest('label')?.innerText,
              el.parentElement?.innerText,
            ]
              .filter(Boolean)
              .join(' ')
              .replace(/\\s+/g, ' ')
              .trim();
          const bodyText = (document.body?.innerText || '').replace(/\\s+/g, ' ');
          const editableInputs = Array.from(document.querySelectorAll('input'))
            .filter(isEditableTextInput);
          const codeLikeInput = editableInputs.find((input) => {
            const text = textFor(input);
            const placeholder = input.getAttribute('placeholder') || '';
            return (
              /otp|code|verification/i.test(text) ||
              /^\\d{6}$/.test(placeholder.trim())
            );
          });
          const single =
            document.querySelector('input[autocomplete="one-time-code"]') ||
            document.querySelector('input[name="otp"]') ||
            document.querySelector('input[name="code"]') ||
            document.querySelector('input[placeholder*="code" i]') ||
            document.querySelector('input[placeholder*="otp" i]') ||
            document.querySelector('input[placeholder="123456"]') ||
            codeLikeInput ||
            (
              /enter verification code|verification code|6-digit code/i.test(bodyText) &&
              editableInputs.length === 1
                ? editableInputs[0]
                : null
            );
          if (single) {
            single.setAttribute('data-camoufox-otp-single', '1');
            return 'single';
          }
          const digits = Array.from(
            document.querySelectorAll('input[inputmode="numeric"], input[maxlength="1"]')
          ).slice(0, 6);
          digits.forEach((input, index) => {
            input.setAttribute('data-camoufox-otp-digit', String(index));
          });
          return digits.length >= 6 ? 'digits' : '';
        }
        """
    )
    if target == "single":
        otp_input = page.locator('[data-camoufox-otp-single="1"]')
        otp_input.click()
        page.keyboard.press("Control+A")
        page.keyboard.type(otp, delay=35)
        page.wait_for_function(
            """
            (expected) => {
              const input = document.querySelector('[data-camoufox-otp-single="1"]');
              return input && input.value === expected;
            }
            """,
            arg=otp,
            timeout=10000,
        )
        emit("step", message="OTP input value confirmed")
    elif target == "digits":
        for index, digit in enumerate(otp[:6]):
            page.locator(f'[data-camoufox-otp-digit="{index}"]').fill(digit)
        emit("step", message="OTP digit inputs filled")
    else:
        raise RuntimeError("OTP input not found")

    page.evaluate(
        """
        () => {
          const input =
            document.querySelector('[data-camoufox-otp-single="1"]') ||
            document.querySelector('[data-camoufox-otp-digit="0"]');
          const scope = input?.closest('form') || input?.parentElement || document;
          const buttons = Array.from(scope.querySelectorAll('button'));
          const button = buttons.find((candidate) => {
            const text = (candidate.textContent || '').trim().toLowerCase();
            return /verify|continue|next|submit|sign in|confirm|log in/.test(text)
              && !candidate.disabled
              && candidate.getAttribute('aria-disabled') !== 'true';
          }) || Array.from(document.querySelectorAll('button')).find((candidate) => {
            const text = (candidate.textContent || '').trim().toLowerCase();
            return /verify|continue|next|submit|sign in|confirm|log in/.test(text)
              && !candidate.disabled
              && candidate.getAttribute('aria-disabled') !== 'true';
          });
          if (button) {
            button.scrollIntoView({ block: 'center', inline: 'nearest' });
            button.click();
          }
        }
        """
    )


def detect_otp_submit_error(page, state):
    state_error = state.get("otp_submit_error", "")
    if state_error:
        lower = state_error.lower()
        return {
            "found": True,
            "rateLimited": (
                "too many attempts" in lower
                or "try again later" in lower
                or "rate limit" in lower
                or "status=403" in lower
                or "status=429" in lower
            ),
            "message": state_error,
        }
    try:
        result = page.evaluate(
            """
            () => {
              const text = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
              const tooMany = /too many attempts|try again later/i.test(text);
              const verifyError =
                /error verifying code|invalid code|invalid otp|expired code|verification failed/i
                  .test(text);
              if (!tooMany && !verifyError) {
                return { found: false, rateLimited: false, message: '' };
              }
              const snippets = [];
              for (const pattern of [
                /Error verifying code\\. Please try again\\./i,
                /Too many attempts\\. Please try again later\\./i,
                /Invalid code[^.]*\\./i,
                /Verification failed[^.]*\\./i,
              ]) {
                const match = text.match(pattern);
                if (match?.[0] && !snippets.includes(match[0])) {
                  snippets.push(match[0]);
                }
              }
              return {
                found: true,
                rateLimited: tooMany,
                message: snippets.join(' ') || text.slice(0, 240),
              };
            }
            """
        )
        return result if isinstance(result, dict) else {"found": False, "message": ""}
    except Exception as exc:
        emit("step", message="OTP error detection failed: " + str(exc)[:240])
        return {"found": False, "message": ""}


def fetch_session_token(page, state):
    existing = state.get("token", "")
    if existing:
        return existing
    try:
        result = page.evaluate(
            """
            async (baseUrl) => {
              const url = `${baseUrl}/v1/auth/get-session`;
              try {
                const response = await fetch(url, {
                  credentials: 'include',
                  headers: { accept: 'application/json' },
                });
                const text = await response.text();
                let body = {};
                try {
                  body = JSON.parse(text);
                } catch {
                  body = {};
                }
                const token =
                  body?.token ||
                  body?.session?.token ||
                  body?.data?.token ||
                  body?.data?.session?.token ||
                  '';
                return {
                  ok: response.ok,
                  status: response.status,
                  token: typeof token === 'string' ? token : '',
                  url,
                };
              } catch (error) {
                return { ok: false, status: 0, token: '', url, error: String(error) };
              }
            }
            """,
            arg=API_URL,
        )
    except Exception as exc:
        existing = state.get("token", "")
        if existing:
            return existing
        emit("step", message="get-session fetch failed: " + str(exc)[:240])
        return ""

    existing = state.get("token", "")
    if existing:
        return existing
    token = result.get("token", "") if isinstance(result, dict) else ""
    status = result.get("status", 0) if isinstance(result, dict) else 0
    if token:
        emit("step", message=f"captured session token via get-session fetch (len={len(token)})")
        return token
    emit("step", message=f"get-session fetch returned no token status={status}")
    return ""


def wait_for_token_with_session_fallback(page, state, timeout_ms):
    deadline = time.time() + timeout_ms / 1000
    last_fetch = 0
    last_error_check = 0
    while time.time() < deadline:
        token = state.get("token", "")
        if token:
            return token
        now = time.time()
        if now - last_error_check >= 0.75:
            last_error_check = now
            otp_error = detect_otp_submit_error(page, state)
            if otp_error.get("found"):
                message = otp_error.get("message") or "unknown OTP verification error"
                if otp_error.get("rateLimited"):
                    raise RuntimeError("OTP verification rate-limited: " + message)
                raise RuntimeError("OTP verification failed: " + message)
        if now - last_fetch >= 3:
            last_fetch = now
            token = fetch_session_token(page, state)
            if token:
                state["token"] = token
                return token
        time.sleep(0.25)
    raise TimeoutError("timed out waiting for auth token")


def run_browser_flow(Camoufox, launch_kwargs, args):
    state = {"token": "", "otp_requested": False, "otp_ready_emitted": False}

    emit("step", message="launching visible Camoufox")
    with Camoufox(**launch_kwargs) as browser:
        try:
            context = browser.new_context(no_viewport=True)
        except TypeError:
            context = browser.new_context(viewport=None)
        page = context.new_page()

        def on_response(response):
            url = response.url
            if AUTH_SEND_PATH in url:
                emit("step", message=f"send-verification-otp status={response.status}")
                if 200 <= response.status < 300:
                    state["otp_requested"] = True
            if AUTH_SIGN_IN_PATH in url:
                emit("step", message=f"sign-in/email-otp status={response.status}")
                if 200 <= response.status < 300:
                    capture_token_from_response(state, response, "sign-in/email-otp")
                elif response.status >= 400:
                    body = ""
                    try:
                        body = response.text()[:500]
                    except Exception:
                        body = ""
                    lower = body.lower()
                    if response.status == 429 or "too many attempts" in lower:
                        state["otp_submit_error"] = (
                            "Too many attempts. Please try again later."
                        )
                    elif response.status in (401, 403):
                        state["otp_submit_error"] = (
                            f"sign-in/email-otp status={response.status}: "
                            + (body[:240] if body else "OTP verification rejected")
                        )
                    elif body:
                        state["otp_submit_error"] = (
                            f"sign-in/email-otp status={response.status}: {body[:240]}"
                        )
            if AUTH_GET_SESSION_PATH in url:
                emit("step", message=f"get-session status={response.status}")
                if 200 <= response.status < 300:
                    capture_token_from_response(state, response, "get-session")

        page.on("response", on_response)

        emit("step", message=f"loading {args.console_url}")
        page.goto(args.console_url, wait_until="domcontentloaded", timeout=60000)
        accept_cookie_banner(page)

        emit("step", message="filling email and submitting")
        fill_email_and_submit(page, args.email)

        wait_for_otp_request_or_form(page, state, args.timeout_ms)
        otp = read_otp_from_stdin()
        wait_until_otp_input_visible(page, 60000)

        emit("step", message="filling OTP and submitting")
        fill_otp_and_submit(page, otp)

        token = wait_for_token_with_session_fallback(page, state, 60000)
        emit("result", token=token)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--console-url", required=True)
    parser.add_argument("--proxy-url", default="")
    parser.add_argument("--timeout-ms", type=int, default=300000)
    parser.add_argument("--accept-language", default="zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7")
    args = parser.parse_args()
    ensure_camoufox_available(args.proxy_url)

    from camoufox import Camoufox

    proxy = parse_proxy(args.proxy_url)
    launch_kwargs = {
        "headless": False,
        "window": (1280, 820),
        "os": "windows",
        "locale": ["zh-CN", "en-US", "zh"],
        "humanize": True,
        "disable_coop": True,
    }
    if proxy:
        launch_kwargs["proxy"] = proxy
        launch_kwargs["geoip"] = True

    try:
        run_browser_flow(Camoufox, launch_kwargs, args)
    except Exception as exc:
        if not is_mmdb_open_error(exc):
            raise
        if not reset_camoufox_mmdb_after_error():
            raise RuntimeError(
                "Camoufox GeoIP 数据库损坏，且无法自动重置。原始错误：" + str(exc)
            ) from exc
        emit("step", message="Camoufox GeoIP 数据库已重置，正在重试浏览器启动")
        run_browser_flow(Camoufox, launch_kwargs, args)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        message = user_facing_error_message(exc)
        emit("error", message=message)
        raise RuntimeError(message) from exc
