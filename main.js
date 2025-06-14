$(document).ready(function() {
    let currentPage = 1;
    let totalResults = [];
    let filteredResults = [];
    const itemsPerPage = 10;
    let autocompleteTimeout;

    // Initialize favorites from localStorage
    let favorites = JSON.parse(localStorage.getItem('bookFavorites')) || [];

    // Add input functionality
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

    // Remove input functionality
    $(document).on('click', '.remove-input', function() {
        $(this).closest('.mb-3').remove();
    });

    // Setup autocomplete for all inputs
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

        // Hide suggestions when clicking outside
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.position-relative').length) {
                $('.autocomplete-suggestions').hide();
            }
        });
    }

    // Search books for autocomplete
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

    // Search books functionality
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

    // Search books using Google Books API
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
            
            // 入力された本の情報を収集
            results.forEach(result => {
                if (result.items && result.items.length > 0) {
                    const inputBook = result.items[0];
                    inputBooks.push(inputBook);
                    allBooks = allBooks.concat(result.items);
                }
            });

            // 入力された本の特徴を分析
            const bookFeatures = analyzeBookFeatures(inputBooks);
            
            // 検索結果を分析してスコア付け
            const scoredBooks = scoreBooks(allBooks, bookFeatures);
            
            // スコアの高い順にソート
            scoredBooks.sort((a, b) => b.score - a.score);

            // 重複を除去し、スコアの高い本を優先
            const uniqueBooks = removeDuplicates(scoredBooks.map(book => book.book));
            totalResults = uniqueBooks.slice(0, 50); // 上位50件を表示
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

    // 本の特徴を分析する関数
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
            
            // 著者情報
            if (info.authors) {
                info.authors.forEach(author => features.authors.add(author));
            }
            
            // カテゴリー情報
            if (info.categories) {
                info.categories.forEach(category => features.categories.add(category));
            }
            
            // 出版社情報
            if (info.publisher) {
                features.publishers.add(info.publisher);
            }
            
            // 出版年
            if (info.publishedDate) {
                const year = info.publishedDate.split('-')[0];
                features.publishedYears.add(year);
            }
            
            // タイトルと説明からキーワードを抽出
            const text = `${info.title} ${info.description || ''}`;
            const words = text.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 2) { // 2文字以上の単語のみ
                    features.keywords.add(word);
                }
            });
        });

        return features;
    }

    // 本にスコアを付ける関数
    function scoreBooks(books, features) {
        return books.map(book => {
            let score = 0;
            const info = book.volumeInfo;
            
            // 著者の一致
            if (info.authors) {
                info.authors.forEach(author => {
                    if (features.authors.has(author)) {
                        score += 3;
                    }
                });
            }
            
            // カテゴリーの一致
            if (info.categories) {
                info.categories.forEach(category => {
                    if (features.categories.has(category)) {
                        score += 2;
                    }
                });
            }
            
            // 出版社の一致
            if (info.publisher && features.publishers.has(info.publisher)) {
                score += 1;
            }
            
            // 出版年の近さ
            if (info.publishedDate) {
                const year = info.publishedDate.split('-')[0];
                if (features.publishedYears.has(year)) {
                    score += 1;
                }
            }
            
            // キーワードの一致
            const text = `${info.title} ${info.description || ''}`.toLowerCase();
            features.keywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    score += 0.5;
                }
            });
            
            return { book, score };
        });
    }

    // Remove duplicates and similar books
    function removeDuplicates(books) {
        const seen = new Set();
        const uniqueBooks = [];
        const seriesGroups = new Map();

        books.forEach(book => {
            const title = book.volumeInfo.title || '';
            const authors = book.volumeInfo.authors ? book.volumeInfo.authors.join('') : '';
            
            // シリーズ本の判定
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

            // 通常の重複チェック
            const key = `${title}-${authors}`.toLowerCase().replace(/\s+/g, '');
            if (!seen.has(key)) {
                seen.add(key);
                uniqueBooks.push(book);
            }
        });

        // シリーズ本の処理
        seriesGroups.forEach((seriesBooks, seriesKey) => {
            if (seriesBooks.length > 0) {
                // シリーズの最初の本を代表として使用
                const representativeBook = seriesBooks[0];
                // タイトルを「シリーズ名（全X巻）」の形式に変更
                const baseTitle = representativeBook.volumeInfo.title.replace(/\s*第[0-9]+巻|\s*\([0-9]+\)|\s*[0-9]+$/, '').trim();
                representativeBook.volumeInfo.title = `${baseTitle}（全${seriesBooks.length}巻）`;
                uniqueBooks.push(representativeBook);
            }
        });

        return uniqueBooks;
    }

    // Display search results
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

    // Create book card HTML
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
                        <!-- Title and Author at the top -->
                        <div class="mb-3">
                            <h6 class="card-title fw-bold mb-2">${title}</h6>
                            <p class="card-text text-muted small mb-0">${authors}</p>
                        </div>
                        
                        <!-- Book cover image centered -->
                        <div class="text-center mb-3">
                            <img src="${thumbnail}" class="book-cover" alt="${title}">
                        </div>
                        
                        <!-- Description -->
                        <p class="card-text small flex-grow-1 mb-3">${description}</p>
                        
                        <!-- Action buttons at the bottom -->
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

    // Add to favorites functionality
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

    // Show favorites
    $('#show-favorites').click(function() {
        $('#results-section').addClass('d-none');
        displayFavorites();
        $('#favorites-section').removeClass('d-none');
    });

    // Hide favorites
    $('#hide-favorites').click(function() {
        $('#favorites-section').addClass('d-none');
        if (totalResults.length > 0) {
            $('#results-section').removeClass('d-none');
        }
    });

    // Display favorites
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

    // Update pagination
    function updatePagination() {
        const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
        $('#pagination').empty();

        if (totalPages <= 1) return;

        // Previous button
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        $('#pagination').append(`
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">前へ</a>
            </li>
        `);

        // Page numbers
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

        // Next button
        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        $('#pagination').append(`
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">次へ</a>
            </li>
        `);
    }

    // Pagination click handler
    $(document).on('click', '.page-link', function(e) {
        e.preventDefault();
        const page = parseInt($(this).data('page'));
        
        if (!isNaN(page) && page !== currentPage) {
            currentPage = page;
            displayResults();
            $('html, body').animate({ scrollTop: $('#results-section').offset().top - 100 }, 500);
        }
    });

    // Initialize autocomplete
    setupAutocomplete();
});