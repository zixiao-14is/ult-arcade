// Builds the Android APK with the JDK and Android SDK in ../.tools, without touching system settings.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const app = path.resolve(__dirname, '..');
const tools = path.resolve(app, '..', '.tools');
const android = path.join(app, 'android');
const env = {
  ...process.env,
  JAVA_HOME: path.join(tools, 'jdk'),
  ANDROID_HOME: path.join(tools, 'android-sdk'),
  ANDROID_SDK_ROOT: path.join(tools, 'android-sdk'),
  GRADLE_USER_HOME: path.join(tools, 'gradle'),   // keep Gradle's downloads on E: with the rest of the tools
};
env.PATH = path.join(env.JAVA_HOME, 'bin') + path.delimiter + env.PATH;
fs.writeFileSync(path.join(android, 'local.properties'), `sdk.dir=${env.ANDROID_HOME.replace(/\\/g, '/')}\n`);

// run it by its plain name from inside android/, since the shell would split a full path at the space in "Game project"
const win = process.platform === 'win32';
const r = spawnSync(win ? '.\\gradlew.bat' : './gradlew', ['assembleDebug', '--no-daemon'], { cwd: android, env, stdio: 'inherit', shell: win });
if (r.status !== 0) process.exit(r.status || 1);

const built = path.join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const out = path.join(app, 'dist', 'ULT-Arcade.apk');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(built, out);
console.log(`APK ready: ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
