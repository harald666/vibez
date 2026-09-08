from pathlib import Path

main = Path('main.js')
s = main.read_text()

old_words = """        const signupWords = [
          'aanmelden','registreren','sign up','register','create account','konto erstellen','registrieren',
          's’inscrire','inscription','registrarse','crear cuenta','registrati','crea account','registar','criar conta',
          '注册','註冊','创建账户','建立帳戶','إنشاء حساب','تسجيل','साइन अप','登録','가입','регистрация','зарегистрироваться',
          'kayıt ol','zarejestruj','реєстрація','daftar','đăng ký','สมัคร','הרשמה','ثبت نام','رجسٹر','নিবন্ধন'
        ];
"""
new_words = """        const accountWords = [
          'aanmelden','registreren','inloggen','sign up','register','create account','sign in','login','log in',
          'konto erstellen','registrieren','anmelden','einloggen','s’inscrire','inscription','se connecter','connexion',
          'registrarse','crear cuenta','iniciar sesión','entrar','registrati','crea account','accedi','registar','criar conta','iniciar sessão',
          '注册','註冊','创建账户','建立帳戶','登录','登入','إنشاء حساب','تسجيل','تسجيل الدخول',
          'साइन अप','साइन इन','लॉग इन','登録','ログイン','가입','로그인','регистрация','зарегистрироваться','войти','вход',
          'kayıt ol','giriş yap','zarejestruj','zaloguj się','реєстрація','увійти','вхід','daftar','masuk','đăng ký','đăng nhập',
          'สมัคร','เข้าสู่ระบบ','הרשמה','התחברות','היכנס','ثبت نام','ورود','رجسٹر','لاگ ان','নিবন্ধন','লগ ইন'
        ];
"""
if old_words not in s:
    raise SystemExit('account word block not found')
s = s.replace(old_words, new_words, 1)

old_match = """        let match = nodes.find((item) => signupWords.some((word) => item.text === word || item.text.includes(word)));
        if (!match) {
          match = nodes
            .filter((item) => item.rect.width >= 55 && item.rect.width <= 240)
            .sort((a, b) => b.rect.right - a.rect.right)[0];
        }
        if (!match) return null;
        const r = match.rect;
        return { left: r.left, top: r.top, width: r.width, height: r.height };
"""
new_match = """        const accountMatches = nodes.filter((item) => accountWords.some((word) => item.text === word || item.text.includes(word)));
        if (accountMatches.length) {
          const left = Math.min(...accountMatches.map((item) => item.rect.left));
          const top = Math.min(...accountMatches.map((item) => item.rect.top));
          const bottom = Math.max(...accountMatches.map((item) => item.rect.bottom));
          return { left, top, width: 0, height: bottom - top };
        }
        const match = nodes
          .filter((item) => item.rect.width >= 55 && item.rect.width <= 240)
          .sort((a, b) => b.rect.right - a.rect.right)[0];
        if (!match) return null;
        const r = match.rect;
        return { left: r.left, top: r.top, width: r.width, height: r.height };
"""
if old_match not in s:
    raise SystemExit('account matching block not found')
s = s.replace(old_match, new_match, 1)

old_show = """    mainWindow.isVisible() &&
    !mainWindow.isMinimized() &&
    mainWindow.getBounds().width >= 620
"""
new_show = """    mainWindow.isVisible() &&
    mainWindow.isFocused() &&
    !mainWindow.isMinimized() &&
    mainWindow.getBounds().width >= 620
"""
if old_show not in s:
    raise SystemExit('visibility block not found')
s = s.replace(old_show, new_show, 1)

old_options = """    skipTaskbar: true,
    hasShadow: false,
    parent: mainWindow,
"""
new_options = """    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    focusable: false,
    parent: mainWindow,
"""
if old_options not in s:
    raise SystemExit('Screenshot BrowserWindow options not found')
s = s.replace(old_options, new_options, 1)

old_focus = """  mainWindow.on('focus', () => setTimeout(refreshScreenshotButtonVisibility, 100));
  mainWindow.on('hide', () => screenshotButtonWindow?.hide());
"""
new_focus = """  mainWindow.on('focus', () => setTimeout(refreshScreenshotButtonVisibility, 100));
  mainWindow.on('blur', () => screenshotButtonWindow?.hide());
  mainWindow.on('hide', () => screenshotButtonWindow?.hide());
"""
if old_focus not in s:
    raise SystemExit('focus/hide handlers not found')
s = s.replace(old_focus, new_focus, 1)
main.write_text(s)

test_path = Path('test/screenshot-position.test.js')
t = test_path.read_text()
t = t.replace("  assert.match(source, /sign up/);\n", "  assert.match(source, /sign up/);\n  assert.match(source, /inloggen/);\n  assert.match(source, /sign in/);\n")
extra = r"""

test('native Screenshot button stays above VibeZ web content without covering other apps', () => {
  assert.match(source, /alwaysOnTop: true/);
  assert.match(source, /focusable: false/);
  assert.match(source, /mainWindow\.isFocused\(\)/);
  assert.match(source, /mainWindow\.on\('blur', \(\) => screenshotButtonWindow\?\.hide\(\)\)/);
});

test('Screenshot anchors before the whole account button cluster', () => {
  assert.match(source, /const accountMatches = nodes\.filter/);
  assert.match(source, /Math\.min\(\.\.\.accountMatches\.map\(\(item\) => item\.rect\.left\)\)/);
  assert.match(source, /anchor\.left - width - gap/);
});
"""
if "stays above VibeZ web content" not in t:
    t += extra
test_path.write_text(t)

changelog = Path('CHANGELOG.md')
c = changelog.read_text()
marker = '## [Unreleased]\n\n'
release = """## [1.3.2] - 2026-09-08

### Fixed
- Screenshot now anchors to the left edge of the complete account-action cluster, so separate Sign in / Login and Sign up / Register controls cannot overlap it.
- Native Screenshot overlay is kept above the embedded Mistral web content while VibeZ is focused.
- Screenshot overlay is hidden when VibeZ loses focus, preventing it from floating above other applications.

"""
if marker not in c:
    raise SystemExit('changelog marker missing')
if '## [1.3.2]' not in c:
    c = c.replace(marker, marker + release, 1)
c = c.replace('[Unreleased]: https://github.com/harald666/vibez/compare/v1.3.1...HEAD', '[Unreleased]: https://github.com/harald666/vibez/compare/v1.3.2...HEAD')
if '[1.3.2]:' not in c:
    c = c.replace('[1.3.1]: https://github.com/harald666/vibez/releases/tag/v1.3.1', '[1.3.2]: https://github.com/harald666/vibez/releases/tag/v1.3.2\n[1.3.1]: https://github.com/harald666/vibez/releases/tag/v1.3.1')
changelog.write_text(c)

readme = Path('README.md')
r = readme.read_text().replace('1.3.1', '1.3.2')
readme.write_text(r)
