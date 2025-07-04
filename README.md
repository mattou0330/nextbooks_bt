
# ①課題名
次に読む一冊

## ②課題内容（どんな作品か）

1. **本の検索機能**
   - 最大6冊まで好きな本のタイトルを入力可能
   - 入力中にオートコンプリート機能で候補を表示
   - Google Books APIを使用して本を検索
   - 入力した本の特徴（著者、カテゴリー、キーワードなど）を分析
   - 類似度に基づいて検索結果をスコア付け

2. **検索結果の表示**
   - 本の情報をカード形式で表示
     - タイトル
     - 著者名
     - 表紙画像
     - 説明文
   - ページネーション機能（1ページあたり10件表示）
   - シリーズ本は自動的にまとめて表示（例：「ハリーポッター（全7巻）」）

3. **お気に入り機能**
   - 気に入った本をお気に入りに追加可能
   - 右上のハートアイコンで簡単に追加/削除
   - お気に入り一覧を別画面で表示
   - ローカルストレージに保存

4. **外部リンク機能**
   - Google Booksへのリンク
   - Amazonでの検索リンク

5. **検索精度の向上**
   - 複数の本の共通要素を分析
   - スコアリングシステムによる関連性の評価
     - 著者の一致: 3点
     - カテゴリーの一致: 2点
     - 出版社の一致: 1点
     - 出版年の一致: 1点
     - キーワードの一致: 0.5点/キーワード

## ③アプリのデプロイURL
デプロイしている場合はURLを記入（任意）

## ④アプリのログイン用IDまたはPassword（ある場合）
- ID: 〇〇〇〇〇〇〇〇
- PW: 〇〇〇〇〇〇〇〇

## ⑤工夫した点・こだわった点
検索精度の向上

## ⑥難しかった点・次回トライしたいこと（又は機能）
v0やBoltを使用してUIを作ると決めていました。ただ、Reactを使用して出力されたため、環境構築やコードの解析(内容把握)に手間取り、結果的にJavaScriptを使ったものにしました。

また、はじめはopenAIのAPIを発行して使用して作っていましたが、APIキーの使い方が理解できたため、サクッと使えるGoogleBooksAPIの使用に切り替えました。

AmazonのAPIも使用したかったのですが、アマゾンアソシエイトプログラムの登録許可までに時間がかかりそうだったため断念しました。

## ⑦フリー項目（感想、シェアしたいこと等なんでも）
- [感想]
- [参考記事]
  - 1. [URLをここに記入]
  - 2. [URLをここに記入]