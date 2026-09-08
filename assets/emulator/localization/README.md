# Localization

## 本项目的本地语言文件

本目录文件名使用 `zh.json`、`en.json` 等短代码。`loader.js` 按 `EJS_language`（未设置时按浏览器 locale）原样拼接文件名，不会自动把 `zh-CN` 转成 `zh`。显式选择简体中文可在加载模拟器前设置 `window.EJS_language = 'zh'`；语言文件缺失时退回英语。下方语言地区标识为上游说明，不代表本目录存在同名文件。

Supported languages

`en.json`: `en-US` - English (US)<br>
`pt.json`: `pt-BR` - Portuguese (Brazil)<br>
`es.json`: `es-419` - Spanish (Latin America)<br>
`el.json`: `el-GR` - Greek (Modern Greek)<br>
`ja.json`: `ja-JP` - Japanese (Japan)<br>
`zh.json`: `zh-CN` - Chinese (Simplified)<br>
`hi.json`: `hi-IN` - Hindi (India)<br>
`ar.json`: `ar-SA` - Arabic (Saudi Arabia)<br>
`jv.json`: `jv-ID` - Javanese (Indonesia)<br>
`bn.json`: `bn-BD` - Bengali (Bangladesh)<br>
`ru.json`: `ru-RU` - Russian (Russia)<br>
`de.json`: `de-DE` - German (Germany)<br>
`ko.json`: `ko-KR` - Korean (South Korea)<br>
`fr.json`: `fr-FR` - French (France)<br>
`it.json`: `it-IT` - Italian (Italy)<br>
`tr.json`: `tr-TR` - Turkish (Turkey)<br>
`fa.json`: `fa-AF` - Persian (Afghanistan)<br>
`ro.json`: `ro-RO` - Romanian (Romania)<br>
`km.json`: `km-KH` - Khmer (Cambodia)<br>
`vi.json`: `vi-VN` - Vietnamese (Vietnam)<br>
`ua.json`: `uk-UA` - Ukranian (Ukraine)<br>
`ur.json`: `ur-PK` - Urdu (Pakistan)<br>
default: `en-US`

add the line to your code to use

```
EJS_language = ''; //language
```

If the language file is not found or there was an error fetching the file, the emulator will default to english.

## Credits

Translated for `es-419` originally by [@cesarcristianodeoliveira](https://github.com/cesarcristianodeoliveira) and updated by [@angelmarfil](https://github.com/angelmarfil) <br>
Translated for `el-GR` by [@imneckro](https://github.com/imneckro) <br>
Translated for `pt-BR` by [@zmarteline](https://github.com/zmarteline)<br>
Translated for `zh-CN` by [@eric183](https://github.com/eric183)<br>
Translated for `it-IT` by [@IvanMazzoli](https://github.com/IvanMazzoli) <br>
Translated for `tr-TR` by [@iGoodie](https://github.com/iGoodie) <br>
Translated for `fa-AF` by [@rezamohdev](https://github.com/rezamohdev) <br>
Translated for `fr-FR` by [@t3chnob0y](https://github.com/t3chnob0y) <br>
Translated for `ro-RO` by [@jurcaalexandrucristian](https://github.com/jurcaalexandrucristian) <br>
Translated for `ja-JP` by [@noel-forester](https://github.com/noel-forester) <br>
Translated for `km-KH` by [@novsochetra](https://github.com/novsochetra) <br>
Translated for `vi-VN` by [@TimKieu](https://github.com/TimKieu) <br>
Translated for `hi-IN`, `ar-SA`, `jv-iD`, `bn-BD`, `ru-RU`, `de-DE`, `ko-KR` by [@allancoding](https://github.com/allancoding), using a translate application <br>
Translated for `ua-UA` by [@MrSosige](https://github.com/MrSosige) <br>
Translated for `ur-PK` by [@hassanraza2000](https://github.com/hassanraza2000) <br>

## Contributing

To contribute, use the bundled `en.json` language file as a template, translate the strings and then submit the file with a Pull Request or Issue.

The EmulatorJS team will review and add your changes.

As of version `4.2.2` it will default to the system language.

The `retroarch.json` are all the setting names for the menu. You can set `EJS_settingsLanguage` to `true` to see the missing retroarch settings names for the current language. You can translate them and add the to the language file.

The control mapping translations for controllers are diffrent for each controller. They will need to be added to the language file if they are not in the default `en-US.json` file.

You can also use the [Translation Helper](https://emulatorjs.org/translate) tool to help you translate the file.

Please contribute!!

Enything that is incorrect or needs to be fix please perform a pull request!
