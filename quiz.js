// 獲取 HTML 元素
const flashcard = document.getElementById('flashcard');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');
const nextButton = document.getElementById('next-button');
const answerInput = document.getElementById('answer-input');
const quizInputArea = document.getElementById('quiz-input-section');
const mcqOptionsArea = document.getElementById('mcq-options-section');
const examProgress = document.getElementById('exam-progress-bar');
const operationToggle = document.getElementById('operation-toggle');

// 獲取「區域」元素
const modeChoiceArea = document.getElementById('mode-choice-area');
const practiceExamChoiceArea = document.getElementById('practice-exam-choice-area');
const examSetupArea = document.getElementById('exam-setup-area'); 
const mainArea = document.getElementById('quiz-main-area');
const resultsArea = document.getElementById('exam-results-area');

// 獲取「按鈕」和「標題」
const modeChoiceTitle = document.getElementById('mode-choice-title');
const modeButtonContainer = document.getElementById('mode-button-container');
const practiceExamTitle = document.getElementById('practice-exam-title');
const examSetupTitle = document.getElementById('exam-setup-title'); 
const startPracticeBtn = document.getElementById('start-practice-btn');
const startExamSetupBtn = document.getElementById('start-exam-setup-btn');
const startExamFinalBtn = document.getElementById('start-exam-final-btn');

// 獲取多選區塊元素
const multiSelectArea = document.getElementById('multi-select-area');
const multiSelectTitle = document.getElementById('multi-select-title');
const listCheckboxContainer = document.getElementById('list-checkbox-container');
const nextToModeSelectionBtn = document.getElementById('next-to-mode-selection-btn');
const multiSelectCount = document.getElementById('multi-select-count');
const multiModeChoiceArea = document.getElementById('multi-mode-choice-area');
const multiModeTitle = document.getElementById('multi-mode-title');
const selectedListsSummary = document.getElementById('selected-lists-summary');
const multiModeButtonContainer = document.getElementById('multi-mode-button-container');

// 獲取單列表摘要元素
const singleListSummary = document.getElementById('single-list-summary');


// 考試模式變數
let isExamMode = false;
let examTotalQuestions = 0;
let examCurrentQuestion = 0;
let examIncorrectCount = 0;
let testedIndices = new Set();
let currentCardMarkedWrong = false;

// 全局變數
let QUESTION_FIELD = '';
let ANSWER_FIELD = '';
let BACK_CARD_FIELDS = [];
let vocabulary = []; 
let currentCardIndex = 0; 
let currentCorrectAnswer = ""; 
let currentMode = 'review'; 
let touchStartX = 0;
let touchStartY = 0;

// 全局狀態
let allListConfigs = {}; 
let selectedListIDs = []; 
let multiSelectEntryConfig = null;
let config = null; // 儲存 config.json 數據

// ⭐️ 輔助函式：遞迴收集所有 list ID
function findListById(items) {
    if (!items) return;
    for (const item of items) {
        // 修正：收集所有 list/category 配置
        allListConfigs[item.id] = item; 
        if (item.type === 'category') {
            findListById(item.items);
        }
    }
}

// 輔助函式：正規化字串 (已修正，忽略波浪符號)
function normalizeString(str) {
    if (typeof str !== 'string') str = String(str);
    if (!str) return "";
    
    // 將全形波浪號 (～) 和半形波浪號 (~) 都移除
    return str.replace(/～/g, '').replace(/~/g, '').replace(/・/g, '').replace(/\./g, '').replace(/\s/g, '');
}

// --- 2. ⭐️ 非同步讀取 (處理多選邏輯) ⭐️ ---
async function initializeQuiz() {
    // 1. 載入 config
    try {
        const configResponse = await fetch('config.json?v=' + new Date().getTime());
        if (!configResponse.ok) { throw new Error('無法讀取 config.json'); }
        config = await configResponse.json();
    } catch (error) {
        console.error('載入設定失敗:', error);
        modeChoiceTitle.textContent = '載入設定檔失敗';
        modeButtonContainer.innerHTML = '<p>請檢查 config.json 檔案。</p>';
        return;
    }
    
    // ⭐️ 2. 收集所有列表配置 (用於多選 - 這是修復空白頁的關鍵) ⭐️
    allListConfigs = {};
    if (config.catalog) {
        config.catalog.forEach(item => findListById([item]));
    }
    
    // 3. 獲取 URL 參數
    const params = new URLSearchParams(window.location.search);
    const listName = params.get('list');
    let modeId = params.get('mode_id');

    if (!listName) {
        modeChoiceArea.style.display = 'none'; 
        return; 
    }
    
    const listConfig = allListConfigs[listName];
    // ⭐️ 修正 1: 處理 listConfig 找不到時的錯誤 (避免後續代碼崩潰) ⭐️
    if (!listConfig) {
        // 如果 listConfig 找不到，我們不能繼續，直接顯示錯誤
        modeChoiceTitle.textContent = `錯誤：找不到單字庫 ID: ${listName}`;
        modeChoiceArea.style.display = 'block';
        return;
    }

    // ⭐️ 4. 模式選擇區 (如果 URL 只有 listName)
    if (!modeId) {
        if (listConfig.type !== 'list') {
            window.location.href = 'index.html'; 
            return;
        }

        modeChoiceTitle.textContent = `${listConfig.name} - 選擇模式`;
        let buttonHtml = '';
        if (listConfig.modes && Array.isArray(listConfig.modes)) {
            for (const mode of listConfig.modes) {
                if (mode.enabled) {
                    buttonHtml += `
                        <button class="option-button ${mode.type}-mode" data-mode-id="${mode.id}" data-mode-type="${mode.type}">
                            ${mode.name}
                        </button>
                    `;
                }
            }
        }
        modeButtonContainer.innerHTML = buttonHtml;
        modeButtonContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.option-button');
            if (!button) return;
            
            const chosenModeId = button.dataset.modeId;
            const url = `quiz.html?list=${listName}&mode_id=${chosenModeId}`;
            window.location.href = url;
        });
        
        modeChoiceArea.style.display = 'block';
        return;
    }
    
    // ⭐️ 5. 多選流程處理入口 (步驟一：選擇列表) ⭐️
    if (listName === 'MULTI_SELECT_ENTRY' && modeId === 'INITIATE_SELECT') {
        multiSelectEntryConfig = listConfig; 
        hideAllSetupAreas();
        setupMultiSelect();
        return; 
    }
    
    // ⭐️ 5.5. 綜合測驗區的返回和繼續流程 (修復 state loss 導致的返回問題) ⭐️
    if (listName === 'MULTI_SELECT_ENTRY' && modeId === 'RESUME_MULTI') {
        multiSelectEntryConfig = listConfig;
        hideAllSetupAreas();
        // 重新設置 selectedListIDs (從 URL 參數中獲取丟失的狀態)
        const selectedIdsFromUrl = params.get('selected_ids');
        if (selectedIdsFromUrl) {
            selectedListIDs = selectedIdsFromUrl.split(',');
        }
        setupMultiModeChoice(); // 直接跳轉到模式選擇頁
        return; 
    }
    
    // ⭐️ 6. 多選流程的最終啟動 或 既有單一列表流程 ⭐️
    const selectedIdsFromUrl = params.get('selected_ids');
    let listIdsToLoad = [];
    let modeConfig = null;

    if (selectedIdsFromUrl) {
        // 情況 A: 綜合測驗區的流程 (多選)
        listIdsToLoad = selectedIdsFromUrl.split(',');
        modeConfig = listConfig.modes.find(m => m.id === modeId);
        // ⭐️ 確保 multiSelectEntryConfig 被設置 (供 setupMultiModeChoice 使用)
        multiSelectEntryConfig = listConfig;
    } else {
        // 情況 B: 既有的單一列表啟動流程
        listIdsToLoad = [listName];
        modeConfig = listConfig.modes.find(m => m.id === modeId);
    }
    
    if (!modeConfig) { throw new Error(`找不到模式 ID: ${modeId}`); }

    // 7. 設定全局變數
    currentMode = modeConfig.type;
    QUESTION_FIELD = modeConfig.q_field;
    ANSWER_FIELD = modeConfig.a_field || '';
    BACK_CARD_FIELDS = modeConfig.back_fields || [];
    
    // 8. 載入單字庫數據 (數據合併核心)
    vocabulary = [];
    for (const id of listIdsToLoad) {
        try {
            const filePath = `words/${id}.json?v=${new Date().getTime()}`;
            const response = await fetch(filePath); 
            if (!response.ok) { 
                console.error(`無法讀取 ${id}.json 檔案`); 
                continue; 
            }
            const listData = await response.json();
            vocabulary.push(...listData); 
        } catch (e) {
            console.error(`載入 ${id}.json 失敗:`, e);
        }
    }

    if (vocabulary.length > 0) {
        
        // ⭐️ 9. 設定所有「返回」按鈕的連結 (修正返回邏輯) ⭐️
        let targetUrl;
        
        if (selectedIdsFromUrl) {
            // 情況 A: 綜合測驗區的任何模式，返回 RESUME_MULTI
            targetUrl = `quiz.html?list=${listName}&mode_id=RESUME_MULTI&selected_ids=${selectedIdsFromUrl}`;
        } else if (currentMode === 'review') {
            // 情況 B: 單一列表 Review 模式，返回模式選擇頁
            targetUrl = `quiz.html?list=${listName}`;
        } else {
            // 情況 C: 單一列表 Quiz/MCQ 模式，返回練習/考試選擇頁
            targetUrl = `quiz.html?list=${listName}&mode_id=${modeId}`;
        }
        
        const returnButtons = document.querySelectorAll('.button-return');
        returnButtons.forEach(btn => btn.href = targetUrl);

        // 10. 顯示模式選擇或考試設定
        modeChoiceArea.style.display = 'none';
        
        if (currentMode === 'review') {
            // --- 進入練習流程 (Review 模式) ---
            isExamMode = false;
            examSetupArea.style.display = 'none'; 
            practiceExamChoiceArea.style.display = 'none';
            modeChoiceArea.style.display = 'none'; 
            mainArea.style.display = 'flex'; 
            setupApp(); // 直接開始練習
        } else {
            isExamMode = false; // 預設為練習模式
            practiceExamChoiceArea.style.display = 'block';
            practiceExamTitle.textContent = `${listConfig.name} - ${modeConfig.name}`;
            
            // ⭐️ 注入已選單字庫摘要 ⭐️
            if (singleListSummary) {
                let summaryText = "";
                if (selectedIdsFromUrl) {
                    // 綜合測驗區的摘要 (從 listIdsToLoad 獲取)
                    const names = listIdsToLoad.map(id => allListConfigs[id] ? allListConfigs[id].name : id).join('、');
                    summaryText = `已選單字庫: ${names}`;
                } else {
                    // 單一列表的摘要
                    summaryText = `已選單字庫: ${listConfig.name}`;
                }
                singleListSummary.textContent = summaryText;
            }


            // ⭐️ FIX 1: 設置 practiceExamChoiceArea 的返回按鈕連結 ⭐️
            const practiceExamReturnBtn = practiceExamChoiceArea.querySelector('.button-return');
            if (practiceExamReturnBtn) {
                // 如果是單一列表，返回模式選擇頁；如果是多選，返回 RESUME_MULTI 模式選擇頁
                 practiceExamReturnBtn.href = selectedIdsFromUrl 
                    ? `quiz.html?list=${listName}&mode_id=RESUME_MULTI&selected_ids=${selectedIdsFromUrl}`
                    : `quiz.html?list=${listName}`;
            }

            // 處理練習與考試按鈕
            startPracticeBtn.onclick = () => {
                isExamMode = false;
                practiceExamChoiceArea.style.display = 'none';
                mainArea.style.display = 'flex';
                setupApp();
            };
            startExamSetupBtn.onclick = () => {
                isExamMode = true;
                practiceExamChoiceArea.style.display = 'none';
                examSetupArea.style.display = 'block';
                examSetupTitle.textContent = `${listConfig.name} - ${modeConfig.name} 考試設定`;
                startExamFinalBtn.onclick = startGame;
                
                // ⭐️ FIX 2: 確保考試設定頁的返回按鈕指向練習/考試選擇區 ⭐️
                const examSetupReturnBtn = examSetupArea.querySelector('.button-return');
                if (examSetupReturnBtn) {
                    examSetupReturnBtn.href = targetUrl;
                }
            };
        }
    } else {
        mainArea.style.display = 'flex';
        mainArea.innerHTML = `<h1>找不到單字數據，請檢查選單字庫。</h1><a href="index.html" class="home-button">返回主頁面</a>`;
    }
}
// ---------------------------------

// ⭐️ 輔助函式：隱藏所有設定區域 ⭐️
function hideAllSetupAreas() {
    modeChoiceArea.style.display = 'none';
    practiceExamChoiceArea.style.display = 'none';
    examSetupArea.style.display = 'none';
    mainArea.style.display = 'none';
    if(multiSelectArea) multiSelectArea.style.display = 'none';
    if(multiModeChoiceArea) multiModeChoiceArea.style.display = 'none';
}

// ⭐️ 新增函式：第一步 - 單字庫列表選擇 (setupMultiSelect) ⭐️
function setupMultiSelect() {
    hideAllSetupAreas();
    multiSelectArea.style.display = 'block';
    listCheckboxContainer.innerHTML = '';
    
    const availableListIDs = multiSelectEntryConfig.available_lists || [];
    let checkboxHtml = '';
    
    availableListIDs.forEach(listId => {
        const listCfg = allListConfigs[listId];
        if (listCfg) {
            const hasValidModes = listCfg.modes && listCfg.modes.some(m => m.enabled);
            checkboxHtml += `
                <label>
                    <input type="checkbox" name="multi-list" value="${listId}" ${hasValidModes ? '' : 'disabled'}>
                    ${listCfg.name} (${listId}.json) ${hasValidModes ? '' : '(無可用模式)'}
                </label>
            `;
        }
    });
    
    listCheckboxContainer.innerHTML = checkboxHtml;
    listCheckboxContainer.addEventListener('change', updateMultiSelectState);
    nextToModeSelectionBtn.onclick = () => {
        hideAllSetupAreas();
        setupMultiModeChoice(); 
    };
    
    updateMultiSelectState();
}

// ⭐️ 輔助函式：更新多選狀態
function updateMultiSelectState() {
    const checkedBoxes = document.querySelectorAll('#list-checkbox-container input[name="multi-list"]:checked');
    selectedListIDs = Array.from(checkedBoxes).map(cb => cb.value);
    
    multiSelectCount.textContent = `已選擇 ${selectedListIDs.length} 個單字庫。`;
    nextToModeSelectionBtn.disabled = selectedListIDs.length === 0;
}


// ⭐️ 新增函式：第二步 - 選擇測驗模式 (setupMultiModeChoice) ⭐️
function setupMultiModeChoice() {
    multiModeChoiceArea.style.display = 'block';
    
    // ⭐️ FIX: 當 selectedListIDs 為空時，嘗試從 URL 讀取狀態 ⭐️
    if (selectedListIDs.length === 0) {
        const params = new URLSearchParams(window.location.search);
        const selectedIdsFromUrl = params.get('selected_ids');
        if (selectedIdsFromUrl) {
            selectedListIDs = selectedIdsFromUrl.split(',');
        }
    }
    
    const summaryNames = selectedListIDs.map(id => allListConfigs[id] ? allListConfigs[id].name : id).join('、');
    selectedListsSummary.textContent = summaryNames;

    // 設置返回按鈕
    const returnButton = multiModeChoiceArea.querySelector('.button-return-to-select-list');
    returnButton.onclick = (event) => {
        event.preventDefault(); // 阻止預設的 a href="#" 行為
        hideAllSetupAreas();
        setupMultiSelect(); // 返回列表選擇
    };

    multiModeButtonContainer.innerHTML = '';
    
    multiSelectEntryConfig.modes.forEach(mode => {
        if (mode.enabled) {
            const button = document.createElement('button');
            button.className = `option-button ${mode.type}-mode`;
            button.textContent = mode.name;
            button.dataset.modeId = mode.id;

            button.onclick = (event) => {
                const finalModeId = event.target.dataset.modeId;
                
                // 重新導向到一個新的 URL，讓 initializeQuiz 重新啟動，並進入數據載入
                const url = `quiz.html?list=${multiSelectEntryConfig.id}&mode_id=${finalModeId}&selected_ids=${selectedListIDs.join(',')}`;
                window.location.href = url;
            };
            multiModeButtonContainer.appendChild(button);
        }
    });
}


// --- 3. ⭐️ 啟動遊戲 (原 "startGame") ⭐️ ---
function startGame() {
    examSetupArea.style.display = 'none'; 
    mainArea.style.display = 'flex'; 

    const selectedLength = document.querySelector('input[name="exam-length"]:checked').value;
    if (selectedLength === 'all') {
        examTotalQuestions = vocabulary.length;
    } else {
        examTotalQuestions = parseInt(selectedLength);
    }
    
    if (examTotalQuestions > vocabulary.length) {
        examTotalQuestions = vocabulary.length;
    }

    examCurrentQuestion = 0;
    examIncorrectCount = 0;
    testedIndices.clear();
    updateExamProgress(); 
    
    setupApp();
}


// --- 4. 設置主要功能 (原 "setupApp") ---
function setupApp() {
    flashcard.addEventListener('click', flipCard);
    nextButton.addEventListener('click', handleButtonPress);

    const cardContainer = document.querySelector('.flashcard-container');
    if (cardContainer) {
        cardContainer.addEventListener('touchstart', handleTouchStart, false);
        cardContainer.addEventListener('touchmove', handleTouchMove, false);
        cardContainer.addEventListener('touchend', handleTouchEnd, false);
    }
    
    document.addEventListener('keydown', handleGlobalKey);
    
    if (operationToggle) {
        operationToggle.addEventListener('click', toggleOperationNotes);
    }
    
    if (currentMode === 'quiz') {
        if(quizInputArea) quizInputArea.style.display = 'block';
        if(mcqOptionsArea) mcqOptionsArea.style.display = 'none';
        const answerLabelData = BACK_CARD_FIELDS.find(f => f.key === ANSWER_FIELD);
        const answerLabel = answerLabelData ? answerLabelData.label : "答案";
        answerInput.placeholder = `請輸入 ${answerLabel}`;
    } else if (currentMode === 'mcq') {
        if(quizInputArea) quizInputArea.style.display = 'none';
        if(mcqOptionsArea) mcqOptionsArea.style.display = 'grid'; 
    } else { // review 模式
        if(quizInputArea) quizInputArea.style.display = 'none';
        if(mcqOptionsArea) mcqOptionsArea.style.display = 'none';
    }
    
    loadNextCard();
}

function toggleOperationNotes() {
    const notes = document.getElementById('operation-notes');
    if (notes) {
        notes.classList.toggle('expanded');
    }
}


// --- 5. ⭐️ 顯示新卡片 (已升級考試邏輯) ⭐️ ---
async function loadNextCard() {
    if (isExamMode && examCurrentQuestion >= examTotalQuestions) {
        showExamResults();
        return; 
    }
    
    if (flashcard.classList.contains('is-flipped')) {
        flashcard.classList.remove('is-flipped');
        await new Promise(resolve => setTimeout(resolve, 610));
    }
    
    let card;
    if (isExamMode) {
        examCurrentQuestion++;
        updateExamProgress();
        currentCardMarkedWrong = false; 

        let newIndex;
        if (examTotalQuestions === vocabulary.length) {
            newIndex = examCurrentQuestion - 1; 
        } else {
            do { 
                newIndex = Math.floor(Math.random() * vocabulary.length); 
            } while (testedIndices.has(newIndex));
        }
        testedIndices.add(newIndex);
        card = vocabulary[newIndex];

    } else {
        const oldIndex = currentCardIndex;
        if (vocabulary.length <= 1) { currentCardIndex = 0; }
        else {
            do { currentCardIndex = Math.floor(Math.random() * vocabulary.length); }
            while (currentCardIndex === oldIndex);
        }
        card = vocabulary[currentCardIndex];
    }
    
    if (!card) return; 

    cardFront.textContent = card[QUESTION_FIELD] || "";
    currentCorrectAnswer = card[ANSWER_FIELD] || "";

    let backHtml = '';
    for (const field of BACK_CARD_FIELDS) {
        const value = card[field.key];
        if (value !== undefined && value !== null && value !== "") {
            const isAnswer = (field.key === ANSWER_FIELD);
            const valueClass = isAnswer ? "back-value answer" : "back-value";
            backHtml += `
                <div class="back-item">
                    <span class="back-label">${field.label}:</span>
                    <span class="${valueClass}">${value}</span>
                </div>
            `;
        }
    }
    cardBack.innerHTML = backHtml;
    
    if (currentMode === 'quiz') {
        answerInput.value = ""; 
        answerInput.disabled = false; 
        answerInput.classList.remove('correct', 'incorrect');
        nextButton.textContent = "檢查答案"; 
        nextButton.disabled = false;
        if (answerInput) answerInput.focus(); 
        
    } else if (currentMode === 'mcq') {
        generateMcqOptions();
        nextButton.textContent = "下一張"; 
        nextButton.disabled = true; 
        
    } else { // review 模式
        nextButton.textContent = "顯示答案"; 
        nextButton.disabled = false;
    }
}

// --- 6. ⭐️ 檢查答案 (已升級考試邏輯) ⭐️ ---
function checkAnswer() {
    const userInputRaw = answerInput.value.trim();
    if (!userInputRaw) {
        answerInput.classList.add('shake');
        setTimeout(() => answerInput.classList.remove('shake'), 500);
        return;
    }

    const normalizedInput = normalizeString(userInputRaw);
    const normalizedAnswer = normalizeString(currentCorrectAnswer);

    if (normalizedInput === normalizedAnswer) {
        answerInput.classList.add('correct');
        answerInput.classList.remove('incorrect');
        answerInput.disabled = true; 
        nextButton.textContent = "下一張"; 
        nextButton.disabled = false;
        answerInput.value = currentCorrectAnswer; 
        flipCard(); 
    } else {
        answerInput.classList.add('incorrect');
        answerInput.classList.remove('correct');
        answerInput.classList.add('shake');
        setTimeout(() => answerInput.classList.remove('shake'), 500);
        
        if (isExamMode && !currentCardMarkedWrong) {
            examIncorrectCount++;
            currentCardMarkedWrong = true;
            updateExamProgress();
        }
    }
}

// --- 7. 處理按鈕點擊 (修正 review 模式下的按鈕狀態變更時機) ---
function handleButtonPress() {
    const buttonState = nextButton.textContent;

    if (currentMode === 'quiz') {
        if (buttonState === "檢查答案") {
            checkAnswer();
        } else { 
            loadNextCard();
        }
    } else if (currentMode === 'review') {
        if (buttonState === "顯示答案") {
            flipCard();
            
            // 修正邏輯：如果成功翻轉到背面，才將按鈕設為「下一張」
            if (flashcard.classList.contains('is-flipped')) {
                nextButton.textContent = "下一張";
            }

        } else { // buttonState === "下一張"
            loadNextCard(); 
        }
    } else if (currentMode === 'mcq') {
        loadNextCard();
    }
}

// --- 8. ⭐️ 處理 Enter / Shift 鍵 (已修正) ⭐️ ---
function handleGlobalKey(event) {
    const isTyping = (currentMode === 'quiz' && document.activeElement === answerInput);

    // 1. "Enter" 鍵
    if (event.key === 'Enter') {
        event.preventDefault();
        
        if (examSetupArea.style.display === 'block' && startExamFinalBtn) {
            startExamFinalBtn.click(); 
            return;
        }

        if (!nextButton.disabled) {
             handleButtonPress();
        }
        return; 
    }

    // 2. "Shift" 鍵
    if (event.key === 'Shift') {
        if (isTyping) return; 
        event.preventDefault();
        flipCard();
        return; 
    }
}

// --- 9. 翻轉卡片 (新增狀態重置邏輯) ---
function flipCard() {
    const wasFlipped = flashcard.classList.contains('is-flipped');
    
    flashcard.classList.toggle('is-flipped');
    
    // 關鍵邏輯：如果卡片被翻回到正面
    if (wasFlipped && !flashcard.classList.contains('is-flipped')) {
        
        // 只有在 review 模式下才需要將按鈕狀態改回「顯示答案」
        if (currentMode === 'review') {
            nextButton.textContent = "顯示答案"; 
        } 
    }
}

// --- 10. ⭐️ 滑動手勢處理 (已更新為新邏輯) ⭐️ ---
function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
}
function handleTouchMove(event) {
    let diffX = Math.abs(event.changedTouches[0].screenX - touchStartX);
    let diffY = Math.abs(event.changedTouches[0].screenY - touchStartY);
    if (diffX > diffY) {
        event.preventDefault();
    }
}
function handleTouchEnd(event) {
    let touchEndX = event.changedTouches[0].screenX;
    let touchEndY = event.changedTouches[0].screenY;
    
    let swipeDistanceX = touchStartX - touchEndX; 
    let swipeDistanceY = touchStartY - touchEndY; 

    const minSwipeThreshold = 50; 
    
    // 判斷是否為「水平滑動」且超過門檻
    if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY) && Math.abs(swipeDistanceX) > minSwipeThreshold) {
        
        if (swipeDistanceX < 0) {
            // 向右滑動 ➡️ 下一張
            triggerNextCardAction(); 
        } else { 
            // 向左滑動 ⬅️ 翻轉
            flipCard();
        }
    }
    touchStartX = 0;
    touchStartY = 0;
}
function triggerNextCardAction() {
    if (!nextButton.disabled) {
        handleButtonPress();
    }
}

// --- 11. MCQ 相關函式 (不變) ---
function generateMcqOptions() {
    const correctAnswer = currentCorrectAnswer;
    let distractors = [];
    let options = [];
    const numDistractorsToFind = Math.min(3, vocabulary.length - 1);
    let retries = 0;
    const maxRetries = 20; 

    while (distractors.length < numDistractorsToFind && retries < maxRetries) {
        retries++; 
        const randomIndex = Math.floor(Math.random() * vocabulary.length);
        const randomWord = vocabulary[randomIndex];
        if (!randomWord[ANSWER_FIELD]) continue; 
        const distractor = randomWord[ANSWER_FIELD];
        if (distractor === correctAnswer) continue; 
        if (distractors.includes(distractor)) continue; 
        distractors.push(distractor);
    }
    options = [correctAnswer, ...distractors];
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    mcqOptionsArea.innerHTML = ''; 
    options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'mcq-option';
        button.textContent = option;
        button.dataset.answer = option; 
        button.addEventListener('click', handleMcqAnswer);
        mcqOptionsArea.appendChild(button);
    });
}
function handleMcqAnswer(event) {
    const selectedButton = event.target;
    const selectedAnswer = selectedButton.dataset.answer;
    
    const allButtons = mcqOptionsArea.querySelectorAll('button');
    allButtons.forEach(button => button.disabled = true);

    if (normalizeString(selectedAnswer) === normalizeString(currentCorrectAnswer)) {
        selectedButton.classList.add('correct');
    } else {
        selectedButton.classList.add('incorrect');
        allButtons.forEach(button => {
            if (normalizeString(button.dataset.answer) === normalizeString(currentCorrectAnswer)) {
                button.classList.add('correct');
            }
        });
        
        if (isExamMode && !currentCardMarkedWrong) {
            examIncorrectCount++;
            currentCardMarkedWrong = true;
            updateExamProgress();
        }
    }
    
    nextButton.disabled = false;
    flipCard();
}

// --- 12. 考試專用函式 (不變) ---
function updateExamProgress() {
    if (!isExamMode) {
        if(examProgress) examProgress.style.display = 'none';
        return;
    }
    
    if(examProgress) examProgress.style.display = 'flex';
    let score = 'N/A';
    if (examCurrentQuestion > 0) {
        const correctCount = (examCurrentQuestion - examIncorrectCount);
        score = Math.round((correctCount / examCurrentQuestion) * 100);
    }
    
    examProgress.innerHTML = `
        <span>題數: ${examCurrentQuestion} / ${examTotalQuestions}</span>
        <span>答錯: ${examIncorrectCount}</span>
        <span>分數: ${score === 'N/A' ? 'N/A' : score + '%'}</span>
    `;
}
function showExamResults() {
    if(mainArea) mainArea.style.display = 'none';
    if(resultsArea) resultsArea.style.display = 'block';

    const correctCount = examTotalQuestions - examIncorrectCount;
    const finalScore = Math.round((correctCount / examTotalQuestions) * 100);
    let message = '';
    if (finalScore == 100) message = '太完美了！ (Perfect!)';
    else if (finalScore >= 80) message = '非常厲害！ (Great Job!)';
    else if (finalScore >= 60) message = '不錯喔！ (Good!)';
    else message = '再加油！ (Keep Trying!)';
    
    resultsArea.innerHTML = `
        <h1>考試結束！</h1>
        <div class="results-summary">
            <h2>${message}</h2>
            <div class="final-score">${finalScore}%</div>
            <p>總題數: ${examTotalQuestions}</p>
            <p>答對: ${correctCount}</p>
            <p>答錯: ${examIncorrectCount}</p>
        </div>
        <a href="javascript:location.reload()" class="option-button review-mode">再考一次</a>
        <a href="index.html" class="home-button">返回主頁面</a>
    `;
}

// --- ⭐️ 啟動程式 ⭐️ ---
initializeQuiz();
