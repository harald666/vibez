const SIGN_UP_WORDS = Object.freeze([
  'aanmelden','registreren','sign up','register','create account',
  'konto erstellen','registrieren','s’inscrire','inscription','registrarse','crear cuenta',
  'registrati','crea account','registar','criar conta','注册','註冊','创建账户','建立帳戶',
  'إنشاء حساب','تسجيل','साइन अप','登録','가입','регистрация','зарегистрироваться',
  'kayıt ol','zarejestruj','реєстрація','daftar','đăng ký','สมัคร','הרשמה','ثبت نام','رجسٹر','নিবন্ধন'
]);

const SIGN_IN_WORDS = Object.freeze([
  'inloggen','sign in','login','log in','anmelden','einloggen','se connecter','connexion',
  'iniciar sesión','entrar','accedi','iniciar sessão','登录','登入','تسجيل الدخول',
  'साइन इन','लॉग इन','ログイン','로그인','войти','вход','giriş yap','zaloguj się',
  'увійти','вхід','masuk','đăng nhập','เข้าสู่ระบบ','התחברות','היכנס','ورود','لاگ ان','লগ ইন'
]);

const ACCOUNT_WORDS = Object.freeze([...new Set([...SIGN_UP_WORDS, ...SIGN_IN_WORDS])]);

module.exports = {
  ACCOUNT_WORDS,
  SIGN_IN_WORDS,
  SIGN_UP_WORDS,
};
