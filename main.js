$(document).ready(function() {
    /* 
     * ページ読み込み時に実行される初期設定
     * currentPage: 現在表示しているページ番号
     * totalResults: 検索結果の全データ
     * filteredResults: フィルター適用後の検索結果
     * itemsPerPage: 1ページあたりの表示件数
     */
    let currentPage = 1;
    let totalResults = [];
    let filteredResults = [];
    const itemsPerPage = 10;
    let autocompleteTimeout;

    /* 
     * ローカルストレージからお気に入りの本の情報を読み込む
     * 保存されていない場合は空の配列を初期値として設定
     */
    let favorites = JSON.parse(localStorage.getItem('bookFavorites')) || [];

    /* 
     * 入力欄を追加するボタンの機能
     * 最大6つまで入力欄を追加可能
     */
    $('#add-input').click(function() {
        const currentInputs = $('.book-input').length;
        if (currentInputs < 6) {
            const newInput = `
                <div class="mb-3 position-relative">
                    <input type="text" class="form-control book-input" placeholder="本のタイトルを入力...">
                    <div class="autocomplete-suggestions"></div>
                    <button type="button" class="btn btn-sm btn-outline-danger position-absolute top-0 end-0 remove-input" style="margin: 2px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            $('#book-inputs').append(newInput);
            setupAutocomplete();
        } else {
            alert('入力欄は最大6つまでです。');
        }
    });

    /* 
     * 入力欄を削除するボタンの機能
     * クリックされた入力欄とその要素を削除
     */
    $(document).on('click', '.remove-input', function() {
        $(this).closest('.mb-3').remove();
    });

    /* 
     * オートコンプリート機能の設定
     * 入力欄の値が変更されるたびに実行
     */
    function setupAutocomplete() {
        $(document).off('input', '.book-input').on('input', '.book-input', function() {
            const input = $(this);
            const query = input.val().trim();
            const suggestionsContainer = input.siblings('.autocomplete-suggestions');

            clearTimeout(autocompleteTimeout);
            
            if (query.length < 2) {
                suggestionsContainer.hide().empty();
                return;
            }

            autocompleteTimeout = setTimeout(() => {
                searchBooksForAutocomplete(query, suggestionsContainer, input);
            }, 300);
        });

        /* 
         * 入力欄の外をクリックした時に候補を非表示にする
         */
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.position-relative').length) {
                $('.autocomplete-suggestions').hide();
            }
        });
    }

    /* 
     * Google Books APIを使用して本を検索する関数
     * 入力された文字列に基づいて候補を表示
     */
    function searchBooksForAutocomplete(query, container, input) {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=5&langRestrict=ja`;

        $.ajax({
            url: url,
            method: 'GET',
            success: function(data) {
                container.empty();
                
                if (data.items && data.items.length > 0) {
                    const suggestions = data.items.map(item => {
                        const title = item.volumeInfo.title || '不明なタイトル';
                        const authors = item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : '不明な著者';
                        return { title, authors };
                    });

                    suggestions.forEach(suggestion => {
                        const suggestionElement = $(`
                            <div class="autocomplete-item p-2 border-bottom bg-white" style="cursor: pointer;">
                                <div class="fw-bold">${suggestion.title}</div>
                                <small class="text-muted">${suggestion.authors}</small>
                            </div>
                        `);
                        
                        suggestionElement.click(function() {
                            input.val(suggestion.title);
                            container.hide();
                        });
                        
                        container.append(suggestionElement);
                    });

                    container.show();
                } else {
                    container.hide();
                }
            },
            error: function() {
                container.hide();
            }
        });
    }

    /* 
     * 検索ボタンの機能
     * 入力された本のタイトルで検索を実行
     */
    $('#search-books').click(function() {
        const bookTitles = $('.book-input').map(function() {
            return $(this).val().trim();
        }).get().filter(title => title.length > 0);

        if (bookTitles.length === 0) {
            alert('少なくとも1つの本のタイトルを入力してください。');
            return;
        }

        searchBooks(bookTitles);
    });

    /* 
     * Google Books APIを使用して本を検索する関数
     * 入力された複数の本のタイトルで検索を実行
     */
    function searchBooks(titles) {
        $('#loading').removeClass('d-none');
        $('#results-section').addClass('d-none');
        $('#favorites-section').addClass('d-none');

        const promises = titles.map(title => {
            const encodedTitle = encodeURIComponent(title);
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodedTitle}&maxResults=20&langRestrict=ja`;
            return $.ajax({ url: url, method: 'GET' });
        });

        Promise.all(promises).then(results => {
            let allBooks = [];
            let inputBooks = [];
            
            /* 
             * 入力された本の情報を収集
             * 各検索結果の最初の本を入力本として保存
             */
            results.forEach(result => {
                if (result.items && result.items.length > 0) {
                    const inputBook = result.items[0];
                    inputBooks.push(inputBook);
                    allBooks = allBooks.concat(result.items);
                }
            });

            /* 
             * 入力された本の特徴を分析
             * 著者、カテゴリー、キーワードなどを抽出
             */
            const bookFeatures = analyzeBookFeatures(inputBooks);
            
            /* 
             * 検索結果の各本にスコアを付与
             * 入力本との類似度に基づいてスコアを計算
             */
            const scoredBooks = scoreBooks(allBooks, bookFeatures);
            
            /* 
             * スコアの高い順にソート
             * より関連性の高い本を上位に表示
             */
            scoredBooks.sort((a, b) => b.score - a.score);

            /* 
             * 重複を除去し、スコアの高い本を優先
             * 上位50件を表示
             */
            const uniqueBooks = removeDuplicates(scoredBooks.map(book => book.book));
            totalResults = uniqueBooks.slice(0, 50);
            filteredResults = totalResults;
            currentPage = 1;

            $('#loading').addClass('d-none');
            displayResults();
            $('#results-section').removeClass('d-none');
        }).catch(error => {
            $('#loading').addClass('d-none');
            alert('検索中にエラーが発生しました。もう一度お試しください。');
            console.error('Search error:', error);
        });
    }

    /* 
     * 本の特徴を分析する関数
     * 著者、カテゴリー、キーワード、出版社、出版年を抽出
     */
    function analyzeBookFeatures(books) {
        const features = {
            authors: new Set(),
            categories: new Set(),
            keywords: new Set(),
            publishers: new Set(),
            publishedYears: new Set()
        };

        books.forEach(book => {
            const info = book.volumeInfo;
            
            /* 著者情報を収集 */
            if (info.authors) {
                info.authors.forEach(author => features.authors.add(author));
            }
            
            /* カテゴリー情報を収集 */
            if (info.categories) {
                info.categories.forEach(category => features.categories.add(category));
            }
            
            /* 出版社情報を収集 */
            if (info.publisher) {
                features.publishers.add(info.publisher);
            }
            
            /* 出版年を収集 */
            if (info.publishedDate) {
                const year = info.publishedDate.split('-')[0];
                features.publishedYears.add(year);
            }
            
            /* 
             * タイトルと説明からキーワードを抽出
             * 2文字以上の単語をキーワードとして保存
             */
            const text = `${info.title} ${info.description || ''}`;
            const words = text.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 2) {
                    features.keywords.add(word);
                }
            });
        });

        return features;
    }

    /* 
     * 本にスコアを付ける関数
     * 入力本との類似度に基づいてスコアを計算
     */
    function scoreBooks(books, features) {
        return books.map(book => {
            let score = 0;
            const info = book.volumeInfo;
            
            /* 著者の一致: 3点 */
            if (info.authors) {
                info.authors.forEach(author => {
                    if (features.authors.has(author)) {
                        score += 3;
                    }
                });
            }
            
            /* カテゴリーの一致: 2点 */
            if (info.categories) {
                info.categories.forEach(category => {
                    if (features.categories.has(category)) {
                        score += 2;
                    }
                });
            }
            
            /* 出版社の一致: 1点 */
            if (info.publisher && features.publishers.has(info.publisher)) {
                score += 1;
            }
            
            /* 出版年の一致: 1点 */
            if (info.publishedDate) {
                const year = info.publishedDate.split('-')[0];
                if (features.publishedYears.has(year)) {
                    score += 1;
                }
            }
            
            /* キーワードの一致: 0.5点/キーワード */
            const text = `${info.title} ${info.description || ''}`.toLowerCase();
            features.keywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    score += 0.5;
                }
            });
            
            return { book, score };
        });
    }

    /* 
     * 重複を除去し、シリーズ本をまとめる関数
     */
    function removeDuplicates(books) {
        const seen = new Set();
        const uniqueBooks = [];
        const seriesGroups = new Map();

        books.forEach(book => {
            const title = book.volumeInfo.title || '';
            const authors = book.volumeInfo.authors ? book.volumeInfo.authors.join('') : '';
            
            /* 
             * シリーズ本の判定
             * 「第X巻」「(X)」「X」で終わるタイトルをシリーズ本として認識
             */
            const seriesMatch = title.match(/(.*?)(?:\s*第[0-9]+巻|\s*\([0-9]+\)|\s*[0-9]+)$/);
            if (seriesMatch) {
                const baseTitle = seriesMatch[1].trim();
                const seriesKey = `${baseTitle}-${authors}`.toLowerCase().replace(/\s+/g, '');
                
                if (!seriesGroups.has(seriesKey)) {
                    seriesGroups.set(seriesKey, []);
                }
                seriesGroups.get(seriesKey).push(book);
                return;
            }

            /* 
             * 通常の重複チェック
             * タイトルと著者名が完全に一致する本を重複として除去
             */
            const key = `${title}-${authors}`.toLowerCase().replace(/\s+/g, '');
            if (!seen.has(key)) {
                seen.add(key);
                uniqueBooks.push(book);
            }
        });

        /* 
         * シリーズ本の処理
         * シリーズの最初の本を代表として使用し、
         * タイトルを「シリーズ名（全X巻）」の形式に変更
         */
        seriesGroups.forEach((seriesBooks, seriesKey) => {
            if (seriesBooks.length > 0) {
                const representativeBook = seriesBooks[0];
                const baseTitle = representativeBook.volumeInfo.title.replace(/\s*第[0-9]+巻|\s*\([0-9]+\)|\s*[0-9]+$/, '').trim();
                representativeBook.volumeInfo.title = `${baseTitle}（全${seriesBooks.length}巻）`;
                uniqueBooks.push(representativeBook);
            }
        });

        return uniqueBooks;
    }

    /* 
     * 検索結果を表示する関数
     * ページネーションを考慮して結果を表示
     */
    function displayResults() {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentResults = filteredResults.slice(startIndex, endIndex);

        $('#results-info').text(`${filteredResults.length}件の結果が見つかりました`);
        $('#search-results').empty();

        currentResults.forEach(book => {
            const bookCard = createBookCard(book);
            $('#search-results').append(bookCard);
        });

        updatePagination();
    }

    /* 
     * 本のカードを作成する関数
     * タイトル、著者、説明、画像などを含むカードを生成
     */
    function createBookCard(book) {
        const info = book.volumeInfo;
        const title = info.title || '不明なタイトル';
        const authors = info.authors ? info.authors.join(', ') : '不明な著者';
        const description = info.description ? 
            (info.description.length > 150 ? info.description.substring(0, 150) + '...' : info.description) : 
            '説明がありません';
        const thumbnail = info.imageLinks ? info.imageLinks.thumbnail : 'https://via.placeholder.com/128x193?text=No+Image';
        const googleBooksLink = info.infoLink || '#';
        const amazonSearchLink = `https://www.amazon.co.jp/s?k=${encodeURIComponent(title + ' ' + authors)}`;
        
        /* 
         * お気に入り状態の判定
         * お気に入り済み: 赤い塗りつぶしハート
         * 未お気に入り: グレーのアウトラインハート
         */
        const isFavorite = favorites.some(fav => fav.id === book.id);
        const favoriteButtonClass = isFavorite ? 'text-danger' : 'text-muted';
        const favoriteButtonIcon = isFavorite ? 'fas' : 'far';

        return $(`
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm position-relative">
                    <!-- お気に入りボタン -->
                    <button class="btn btn-link position-absolute top-0 end-0 p-2 add-favorite" 
                            data-book-id="${book.id}" 
                            style="z-index: 2; text-decoration: none;">
                        <i class="${favoriteButtonIcon} fa-heart ${favoriteButtonClass} fa-lg"></i>
                    </button>
                    
                    <div class="card-body d-flex flex-column">
                        <!-- タイトルと著者 -->
                        <div class="mb-3">
                            <h6 class="card-title fw-bold mb-2">${title}</h6>
                            <p class="card-text text-muted small mb-0">${authors}</p>
                        </div>
                        
                        <!-- 本の表紙画像 -->
                        <div class="text-center mb-3">
                            <img src="${thumbnail}" class="book-cover" alt="${title}">
                        </div>
                        
                        <!-- 説明文 -->
                        <p class="card-text small flex-grow-1 mb-3">${description}</p>
                        
                        <!-- アクションボタン -->
                        <div class="mt-auto">
                            <div class="d-grid gap-2">
                                <a href="${googleBooksLink}" target="_blank" class="btn btn-primary btn-sm">
                                    <i class="fas fa-external-link-alt me-1"></i>Google Booksで見る
                                </a>
                                <a href="${amazonSearchLink}" target="_blank" class="btn btn-warning btn-sm">
                                    <i class="fab fa-amazon me-1"></i>Amazonで探す
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }

    /* 
     * お気に入りに追加/削除する機能
     * クリックでお気に入りの状態を切り替え
     */
    $(document).on('click', '.add-favorite', function() {
        const bookId = $(this).data('book-id');
        const book = totalResults.find(b => b.id === bookId);
        
        if (!book) return;

        const existingIndex = favorites.findIndex(fav => fav.id === bookId);
        const heartIcon = $(this).find('i');
        
        if (existingIndex === -1) {
            favorites.push(book);
            heartIcon.removeClass('far text-muted').addClass('fas text-danger');
        } else {
            favorites.splice(existingIndex, 1);
            heartIcon.removeClass('fas text-danger').addClass('far text-muted');
        }

        localStorage.setItem('bookFavorites', JSON.stringify(favorites));
    });

    /* 
     * お気に入り一覧を表示するボタンの機能
     */
    $('#show-favorites').click(function() {
        $('#results-section').addClass('d-none');
        displayFavorites();
        $('#favorites-section').removeClass('d-none');
    });

    /* 
     * お気に入り一覧を閉じるボタンの機能
     */
    $('#hide-favorites').click(function() {
        $('#favorites-section').addClass('d-none');
        if (totalResults.length > 0) {
            $('#results-section').removeClass('d-none');
        }
    });

    /* 
     * お気に入り一覧を表示する関数
     * 保存されたお気に入りの本を表示
     */
    function displayFavorites() {
        $('#favorites-results').empty();
        
        if (favorites.length === 0) {
            $('#favorites-results').html(`
                <div class="col-12 text-center">
                    <p class="text-muted">お気に入りの本がありません。</p>
                </div>
            `);
            return;
        }

        favorites.forEach(book => {
            const bookCard = createBookCard(book);
            $('#favorites-results').append(bookCard);
        });
    }

    /* 
     * ページネーションを更新する関数
     * 現在のページに応じてページ番号を表示
     */
    function updatePagination() {
        const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
        $('#pagination').empty();

        if (totalPages <= 1) return;

        /* 前へボタン */
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        $('#pagination').append(`
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">前へ</a>
            </li>
        `);

        /* ページ番号 */
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const active = i === currentPage ? 'active' : '';
            $('#pagination').append(`
                <li class="page-item ${active}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `);
        }

        /* 次へボタン */
        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        $('#pagination').append(`
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">次へ</a>
            </li>
        `);
    }

    /* 
     * ページネーションのクリックイベント
     * ページ番号をクリックして結果を切り替え
     */
    $(document).on('click', '.page-link', function(e) {
        e.preventDefault();
        const page = parseInt($(this).data('page'));
        
        if (!isNaN(page) && page !== currentPage) {
            currentPage = page;
            displayResults();
            $('html, body').animate({ scrollTop: $('#results-section').offset().top - 100 }, 500);
        }
    });

    /* 
     * 初期化
     * オートコンプリート機能を設定
     */
    setupAutocomplete();
});