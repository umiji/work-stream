---
description: 気づき・検討・記録を knowledge-repo に取り込む(P0-a: ws capture のラッパー)
---

ユーザーの直前の発話・選択中のテキスト、または `$ARGUMENTS` を内容として、次を実行する。

1. 内容の性質を判定する: 検討・気づき・雑談中の発想なら `thought`、外部(Gemini 等)からの説明・引用なら `reference`、やったこと・試して失敗したことの記録なら `log`
2. 判定した `--kind` を指定して `ws capture` を実行する

```bash
ws capture --kind <thought|reference|log> --file <一時ファイルパス>
```

内容が長い場合は一時ファイルに書き出してから `--file` で渡す。標準入力へのパイプでも構わない。

実行後、`取り込みました` か `既に取り込み済みです` のどちらが返ったかをユーザーに報告する。
