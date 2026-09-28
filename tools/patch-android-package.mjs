/**
 * Play Store listing uses com.pancitogames.memoryhistory2 (legacy Unity id).
 * Capacitor appId stays com.pancitogames.memoryhistory for iOS.
 * Run after `npx cap sync android` so sync does not leave the wrong applicationId.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAY_APPLICATION_ID = 'com.pancitogames.memoryhistory2'
const VERSION_CODE = 13
const VERSION_NAME = '1.4.0'

const gradlePath = path.join(root, 'android', 'app', 'build.gradle')
const stringsPath = path.join(
  root,
  'android',
  'app',
  'src',
  'main',
  'res',
  'values',
  'strings.xml',
)

let gradle = fs.readFileSync(gradlePath, 'utf8')
gradle = gradle.replace(
  /applicationId\s+"[^"]+"/,
  `applicationId "${PLAY_APPLICATION_ID}"`,
)
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${VERSION_CODE}`)
gradle = gradle.replace(
  /versionName\s+"[^"]+"/,
  `versionName "${VERSION_NAME}"`,
)
fs.writeFileSync(gradlePath, gradle)

let strings = fs.readFileSync(stringsPath, 'utf8')
strings = strings.replace(
  /<string name="package_name">[^<]+<\/string>/,
  `<string name="package_name">${PLAY_APPLICATION_ID}</string>`,
)
strings = strings.replace(
  /<string name="custom_url_scheme">[^<]+<\/string>/,
  `<string name="custom_url_scheme">${PLAY_APPLICATION_ID}</string>`,
)
fs.writeFileSync(stringsPath, strings)

console.log(
  `Android Play id → ${PLAY_APPLICATION_ID} (${VERSION_NAME} / ${VERSION_CODE})`,
)
