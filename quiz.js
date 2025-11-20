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

// 確保給予變數賦值
const giveUpButton = document.getElementById('give-up-button');

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

// 獲取自訂輸入元素
const qCustomRadio = document.getElementById('qCustomRadio');
const qCustomInput = document.getElementById('qCustomInput');


// 考試模式變數
let isExamMode = false;
let examTotalQuestions = 0;
let examCurrentQuestion = 0;
let examIncorrectCount = 0;
let testedIndices = new Set();
let currentCardMarkedWrong = false;

// 儲存錯題的單字數據
let examIncorrectWords = []; 
let currentCardData = {}; 

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
let config = null; 

// 輔助函式：Fisher-Yates 洗牌演算法
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 輔助函式：遞迴收集所有 list ID
function findListById(items) {
    if (!items) return;
    for (const item of items) {
        allListConfigs[item.id] = item; 
        if (item.type === 'category') {
            findListById(item.items);
        }
    }
}

// 輔助函式：尋找單字庫在首頁的路徑 (Hash)
function findParentHash(items, targetListId, currentPath = '#') {
    if (!items) return null;
    
    for (const item of items) {
        if (item.type === 'list' && item.id === targetListId) {
            return currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
        }
        
        if (item.type === 'category') {
            const newPath = currentPath + (currentPath === '#' ? '' : '/') + item.id;
            const found = findParentHash(item.items, targetListId, newPath);
            if (found) return found;
        }
    }
    return null;
}

// 輔助函式：正規化字串
function normalizeString(str) {
    if (typeof str !== 'string') str = String(str);
    if (!str) return "";
    return str.replace(/～/g, '').replace(/~/g, '').replace(/・/g, '').replace(/\./g, '').replace(/\s/g, '');
}

// 輔助函式：異步載入外部 JSON 檔案
async function loadExternalConfig(path) {
    try {
        const response = await fetch(path + '?v=' + new Date().getTime());
        if (!response.ok) {
            return []; 
        }
        return await response.json();
    } catch (error) {
        return [];
    }
}

// --- 2. 非同步讀取 ---
async function initializeQuiz() {
    try {
        const configResponse = await fetch('config.json?v=' + new Date().getTime());
        if (!configResponse.ok) { throw new Error('無法讀取 config.json'); }
        config = await configResponse.json();
    } catch (error) {
        console.error('載入設定失敗:', error);
        return;
    }
    
    // 載入並合併外部配置
    let initialConfig = config; 
    let finalCatalog = [];
    
    for (const item of initialConfig.catalog) {
        if (item.type === 'external_category' && item.path) {
            const externalItems = await loadExternalConfig(item.path);
            finalCatalog.push(...externalItems);
        } else {
            finalCatalog.push(item);
        }
    }
    initialConfig.catalog = finalCatalog; 
    
    allListConfigs = {};
    if (initialConfig.catalog) {
        initialConfig.catalog.forEach(item => findListById([item]));
    }
    
    const params = new URLSearchParams(window.location.search);
    const listName = params.get('list');
    let modeId = params.get('mode_id');

    if (!listName) {
        modeChoiceArea.style.display = 'none'; 
        return; 
    }
    
    const listConfig = allListConfigs[listName];
    if (!listConfig) {
        modeChoiceTitle.textContent = `錯誤：找不到單字庫 ID: ${listName}`;
        modeChoiceArea.style.display = 'block';
        return;
    }

    // 4. 模式選擇區 (單一列表)
    if (!modeId) {
        if (listConfig.type !== 'list') {
            window.location.href = 'index.html'; 
            return;
        }

        modeChoiceTitle.textContent = '選擇測驗模式'; 
        
        const parentHash = findParentHash(initialConfig.catalog, listName);
        const returnBtn = document.querySelector('#mode-choice-area .home-button');
        if (returnBtn) {
            returnBtn.href = parentHash ? `index.html${parentHash}` : 'index.html';
            returnBtn.textContent = "返回上一層";
        }
        
        if (parentHash) {
             window.location.href = `index.html${parentHash}`;
             return;
        }
        
        modeChoiceArea.style.display = 'block';
        return;
    }
    
    // 5. 多選流程處理入口
    if (listName === 'MULTI_SELECT_ENTRY' && modeId === 'INITIATE_SELECT') {
        multiSelectEntryConfig = listConfig; 
        hideAllSetupAreas();
        setupMultiSelect();
        return; 
    }
    
    // 5.5. 綜合測驗區的返回
    if (listName === 'MULTI_SELECT_ENTRY' && modeId === 'RESUME_MULTI') {
        multiSelectEntryConfig = listConfig;
        hideAllSetupAreas();
        const selectedIdsFromUrl = params.get('selected_ids');
        if (selectedIdsFromUrl) {
            selectedListIDs = selectedIdsFromUrl.split(',');
        }
        setupMultiModeChoice(); 
        return; 
    }
    
    // 6. 載入數據
    const selectedIdsFromUrl = params.get('selected_ids');
    let listIdsToLoad = [];
    let modeConfig = null;

    if (selectedIdsFromUrl) {
        listIdsToLoad = selectedIdsFromUrl.split(',');
        modeConfig = listConfig.modes.find(m => m.id === modeId);
        multiSelectEntryConfig = listConfig;
    } else if (listName !== 'MULTI_SELECT_ENTRY') {
        listIdsToLoad = [listName];
        modeConfig = listConfig.modes.find(m => m.id === modeId);
    } else {
        multiSelectEntryConfig = listConfig;
        hideAllSetupAreas();
        setupMultiSelect();
        return; 
    }
    
    if (!modeConfig) { throw new Error(`找不到模式 ID: ${modeId}`); }

    currentMode = modeConfig.type;
    QUESTION_FIELD = modeConfig.q_field;
    ANSWER_FIELD = modeConfig.a_field || '';
    BACK_CARD_FIELDS = modeConfig.back_fields || [];
    
    vocabulary = [];
    for (const id of listIdsToLoad) {
        try {
            const filePath = `words/${id}.json?v=${new Date().getTime()}`;
            const response = await fetch(filePath); 
            if (!response.ok) { 
                continue; 
            }
            const listData = await response.json();
            vocabulary.push(...listData); 
        } catch (e) {
            console.error(`載入 ${id}.json 失敗:`, e);
        }
    }

    if (vocabulary.length > 0) {
        let backToSetupUrl;
        if (selectedIdsFromUrl) {
            backToSetupUrl = `quiz.html?list=${listName}&mode_id=RESUME_MULTI&selected_ids=${selectedIdsFromUrl}`; 
        } else {
            backToSetupUrl = `quiz.html?list=${listName}&mode_id=${modeId}`; 
        }
        
        // 9. 設定通用返回按鈕連結 (預設回設定頁)
        const returnButtons = document.querySelectorAll('.button-return');
        returnButtons.forEach(btn => btn.href = backToSetupUrl);

        // 計算回到首頁列表的連結 (給 Review 模式用)
        const parentHash = findParentHash(initialConfig.catalog, listName);
        const backToCategoryUrl = parentHash ? `index.html${parentHash}` : 'index.html';

        modeChoiceArea.style.display = 'none';
        
        if (currentMode === 'review') {
            isExamMode = false;
            examSetupArea.style.display = 'none'; 
            practiceExamChoiceArea.style.display = 'none';
            modeChoiceArea.style.display = 'none'; 
            mainArea.style.display = 'flex'; 
            
            const mainAreaReturnBtn = mainArea.querySelector('.button-return');
            if (mainAreaReturnBtn) {
                if (selectedIdsFromUrl) {
                    mainAreaReturnBtn.href = backToSetupUrl; // 多選回多選選單
                } else {
                    mainAreaReturnBtn.href = backToCategoryUrl; // 單選回首頁列表
                }
            }
            
            setupApp(); 
        } else {
            isExamMode = false; 
            practiceExamChoiceArea.style.display = 'block';
            practiceExamTitle.textContent = `${listConfig.name} - ${modeConfig.name}`;
            
            if (singleListSummary) {
                let summaryText = "";
                if (selectedIdsFromUrl) {
                    const names = listIdsToLoad.map(id => allListConfigs[id] ? allListConfigs[id].name : id).join('、');
                    summaryText = `已選單字庫: ${names}`;
                } else {
                    summaryText = `已選單字庫: ${listConfig.name}`;
                }
                singleListSummary.textContent = summaryText;
            }

            // ⭐️ Practice Choice 的返回 -> 回上一層 (首頁/多選選單) ⭐️
            const practiceExamReturnBtn = practiceExamChoiceArea.querySelector('.button-return');
            if (practiceExamReturnBtn) {
                if (selectedIdsFromUrl) {
                    practiceExamReturnBtn.href = backToSetupUrl; // 多選回多選模式選擇
                } else {
                    practiceExamReturnBtn.href = backToCategoryUrl; // 單選回首頁列表
                }
            }

            startPracticeBtn.onclick = () => {
                isExamMode = false;
                practiceExamChoiceArea.style.display = 'none';
                mainArea.style.display = 'flex';
                
                const mainAreaReturnBtn = mainArea.querySelector('.button-return');
                if (mainAreaReturnBtn) {
                    mainAreaReturnBtn.href = backToSetupUrl;
                }
                
                setupApp();
            };
            startExamSetupBtn.onclick = () => {
                isExamMode = true;
                practiceExamChoiceArea.style.display = 'none';
                examSetupArea.style.display = 'block';
                examSetupTitle.textContent = `${listConfig.name} - ${modeConfig.name} 考試設定`;
                startExamFinalBtn.onclick = startGame;
                
                const examSetupReturnBtn = examSetupArea.querySelector('.button-return');
                if (examSetupReturnBtn) {
                    examSetupReturnBtn.href = backToSetupUrl;
                }
            };
        }
    } else {
        mainArea.style.display = 'flex';
        mainArea.innerHTML = `<h1>找不到單字數據。</h1><p>請確認單字庫檔案 (words/${listIdsToLoad.join(', ')}.json) 是否存在。</p><a href="index.html" class="home-button">返回主頁面</a>`;
    }
}

function hideAllSetupAreas() {
    modeChoiceArea.style.display = 'none';
    practiceExamChoiceArea.style.display = 'none';
    examSetupArea.style.display = 'none';
    mainArea.style.display = 'none';
    if(multiSelectArea) multiSelectArea.style.display = 'none';
    if(multiModeChoiceArea) multiModeChoiceArea.style.display = 'none';
}

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
    
    // ⭐️ 新增：設定「選擇單字庫頁面」的返回上一層按鈕 ⭐️
    const parentHash = findParentHash(config.catalog, 'MULTI_SELECT_ENTRY');
    const returnBtn = multiSelectArea.querySelector('.button-return');
    if (returnBtn) {
        returnBtn.href = parentHash ? `index.html${parentHash}` : 'index.html';
    }

    updateMultiSelectState();
}

function updateMultiSelectState() {
    const checkedBoxes = document.querySelectorAll('#list-checkbox-container input[name="multi-list"]:checked');
    selectedListIDs = Array.from(checkedBoxes).map(cb => cb.value);
    
    multiSelectCount.textContent = `已選擇 ${selectedListIDs.length} 個單字庫。`;
    nextToModeSelectionBtn.disabled = selectedListIDs.length === 0;
}

function setupMultiModeChoice() {
    multiModeChoiceArea.style.display = 'block';
    
    if (selectedListIDs.length === 0) {
        const params = new URLSearchParams(window.location.search);
        const selectedIdsFromUrl = params.get('selected_ids');
        if (selectedIdsFromUrl) {
            selectedListIDs = selectedIdsFromUrl.split(',');
        }
    }
    
    const summaryNames = selectedListIDs.map(id => allListConfigs[id] ? allListConfigs[id].name : id).join('、');
    selectedListsSummary.textContent = summaryNames;

    const returnButton = multiModeChoiceArea.querySelector('.button-return-to-select-list');
    returnButton.onclick = (event) => {
        event.preventDefault(); 
        hideAllSetupAreas();
        setupMultiSelect(); 
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
                const url = `quiz.html?list=${multiSelectEntryConfig.id}&mode_id=${finalModeId}&selected_ids=${selectedListIDs.join(',')}`;
                window.location.href = url;
            };
            multiModeButtonContainer.appendChild(button);
        }
    });
}

function startGame() {
    examSetupArea.style.display = 'none'; 
    mainArea.style.display = 'flex'; 

    const selectedLength = document.querySelector('input[name="exam-length"]:checked').value;
    
    if (selectedLength === 'all') {
        examTotalQuestions = vocabulary.length;
    } else if (selectedLength === 'custom') {
        let customValue = parseInt(qCustomInput.value);
        if (isNaN(customValue) || customValue <= 0) {
            alert('請輸入有效的自訂題數！');
            examSetupArea.style.display = 'block';
            mainArea.style.display = 'none';
            return;
        }
        examTotalQuestions = customValue;
    } else {
        examTotalQuestions = parseInt(selectedLength);
    }
    
    if (examTotalQuestions > vocabulary.length) {
        examTotalQuestions = vocabulary.length;
        alert(`題數超過單字庫總數，已自動設定為最大題數：${vocabulary.length} 題。`);
    }

    shuffleArray(vocabulary);

    examCurrentQuestion = 0;
    examIncorrectCount = 0;
    testedIndices.clear();
    updateExamProgress();
    examIncorrectWords = [];
    
    const params = new URLSearchParams(window.location.search);
    const listName = params.get('list');
    const modeId = params.get('mode_id');
    const selectedIds = params.get('selected_ids');
    
    let backToSetupUrl;
    if (selectedIds) {
        backToSetupUrl = `quiz.html?list=${listName}&mode_id=RESUME_MULTI&selected_ids=${selectedIds}`; 
    } else {
        backToSetupUrl = `quiz.html?list=${listName}&mode_id=${modeId}`; 
    }
    
    const mainAreaReturnBtn = mainArea.querySelector('.button-return');
    if (mainAreaReturnBtn) {
        mainAreaReturnBtn.href = backToSetupUrl;
    }
    
    setupApp();
}

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
    
    if (giveUpButton) {
        giveUpButton.addEventListener('click', revealAnswer);
    }
    
    if (operationToggle) {
        operationToggle.addEventListener('click', toggleOperationNotes);
    }
    
    if (currentMode === 'quiz') {
        if(quizInputArea) quizInputArea.style.display = 'block';
        if(mcqOptionsArea) mcqOptionsArea.style.display = 'none';
        
        if(giveUpButton) giveUpButton.style.display = 'inline-block';
        
        const answerLabelData = BACK_CARD_FIELDS.find(f => f.key === ANSWER_FIELD);
        const answerLabel = answerLabelData ? answerLabelData.label : "答案";
        answerInput.placeholder = `請輸入 ${answerLabel}`;
        
        if (answerInput) answerInput.focus();
        
    } else if (currentMode === 'mcq') {
        if(quizInputArea) quizInputArea.style.display = 'none';
        if(mcqOptionsArea) mcqOptionsArea.style.display = 'flex'; 
        if(giveUpButton) giveUpButton.style.display = 'none'; 
    } else { 
        if(quizInputArea) quizInputArea.style.display = 'none';
        if(mcqOptionsArea) mcqOptionsArea.style.display = 'none';
        if(giveUpButton) giveUpButton.style.display = 'none';
    }
    
    loadNextCard();
}

function toggleOperationNotes() {
    const notes = document.getElementById('operation-notes');
    const toggleBtn = document.getElementById('operation-toggle');
    
    if (notes) {
        notes.classList.toggle('expanded');
    }
    if (toggleBtn) {
        toggleBtn.classList.toggle('expanded');
    }
}

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
    let newIndex = currentCardIndex;

    if (isExamMode) {
        examCurrentQuestion++;
        updateExamProgress();
        currentCardMarkedWrong = false; 
        newIndex = examCurrentQuestion - 1;
    } else {
        const oldIndex = currentCardIndex;
        if (vocabulary.length <= 1) { currentCardIndex = 0; }
        else {
            do { currentCardIndex = Math.floor(Math.random() * vocabulary.length); }
            while (currentCardIndex === oldIndex);
            newIndex = currentCardIndex;
        }
    }
    
    card = vocabulary[newIndex];
    if (!card) return; 

    currentCardData = card;

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
        if (giveUpButton) giveUpButton.disabled = false; 
        
    } else if (currentMode === 'mcq') {
        generateMcqOptions();
        nextButton.textContent = "下一張"; 
        nextButton.disabled = true; 
        
    } else { 
        nextButton.textContent = "顯示答案"; 
        nextButton.disabled = false;
    }
}

function checkAnswer() {
    const userInputRaw = answerInput.value.trim();
    if (!userInputRaw) {
        answerInput.classList.add('shake');
        setTimeout(() => answerInput.classList.remove('shake'), 500);
        return;
    }

    const normalizedInput = normalizeString(userInputRaw);
    
    let isCorrect = false;
    let correctAnswers = currentCorrectAnswer.split('/').map(s => s.trim());
    
    isCorrect = correctAnswers.some(answer => {
        return normalizeString(answer) === normalizedInput;
    });
    
    if (isCorrect) {
        answerInput.value = correctAnswers[0].trim();
        answerInput.classList.add('correct');
        answerInput.classList.remove('incorrect');
        answerInput.disabled = true; 
        nextButton.textContent = "下一張"; 
        nextButton.disabled = false;
        if (giveUpButton) giveUpButton.style.display = 'none'; 
        flipCard(); 
    } else {
        answerInput.classList.add('incorrect');
        answerInput.classList.remove('correct');
        answerInput.classList.add('shake');
        setTimeout(() => answerInput.classList.remove('shake'), 500);
        
        if (isExamMode && !currentCardMarkedWrong) {
            examIncorrectCount++;
            currentCardMarkedWrong = true;
            examIncorrectWords.push({ 
                question: currentCardData[QUESTION_FIELD], 
                answer: currentCorrectAnswer 
            });
        }
        
        if (giveUpButton) giveUpButton.style.display = 'inline-block';
    }
}

function revealAnswer() {
    if (currentMode === 'quiz' && !flashcard.classList.contains('is-flipped')) {
        
        if (isExamMode && !currentCardMarkedWrong) {
            examIncorrectCount++;
            currentCardMarkedWrong = true;
            updateExamProgress();
            
            examIncorrectWords.push({ 
                question: currentCardData[QUESTION_FIELD], 
                answer: currentCorrectAnswer 
            });
        }
        
        answerInput.value = currentCorrectAnswer.split('/')[0].trim(); 
        answerInput.classList.remove('incorrect');
        answerInput.disabled = true;
        
        flipCard();
        nextButton.textContent = "下一張";
        nextButton.disabled = false;
        if (giveUpButton) giveUpButton.style.display = 'none';
    }
}


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
            if (flashcard.classList.contains('is-flipped')) {
                nextButton.textContent = "下一張";
            }

        } else { 
            loadNextCard(); 
        }
    } else if (currentMode === 'mcq') {
        loadNextCard();
    }
}

function handleGlobalKey(event) {
    const isTyping = (currentMode === 'quiz' && document.activeElement === answerInput);

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
    
    if (currentMode === 'mcq' && !nextButton.disabled) {
        const keyMap = {
            'q': 0, 'w': 1, 'e': 2, 'r': 3,
            'Q': 0, 'W': 1, 'E': 2, 'R': 3,
            '1': 0, '2': 1, '3': 2, '4': 3,
            'Numpad1': 0, 'Numpad2': 1, 'Numpad3': 2, 'Numpad4': 3
        };
        
        const key = event.key;
        const optionIndex = keyMap[key]; 
        
        if (optionIndex !== undefined) {
            event.preventDefault(); 
            const optionButtons = mcqOptionsArea.querySelectorAll('.mcq-option');
            if (optionIndex < optionButtons.length) {
                handleMcqAnswer(optionButtons[optionIndex]); 
            }
            return;
        }
    }

    if (event.key === 'Shift') {
        if (isTyping) return; 
        event.preventDefault();
        flipCard();
        return; 
    }
}

function flipCard() {
    const wasFlipped = flashcard.classList.contains('is-flipped');
    
    flashcard.classList.toggle('is-flipped');
    
    if (wasFlipped && !flashcard.classList.contains('is-flipped')) {
        if (currentMode === 'review') {
            nextButton.textContent = "顯示答案"; 
        } 
    }
}

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
    
    if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY) && Math.abs(swipeDistanceX) > minSwipeThreshold) {
        if (swipeDistanceX < 0) {
            triggerNextCardAction(); 
        } else { 
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
    
    options.forEach((option) => {
        const button = document.createElement('button');
        button.className = 'mcq-option';
        button.textContent = option; 
        button.dataset.answer = option; 
        button.addEventListener('click', (event) => handleMcqAnswer(event.target)); 
        mcqOptionsArea.appendChild(button);
    });
}
function handleMcqAnswer(selectedButton) {
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
            examIncorrectWords.push({ 
                question: currentCardData[QUESTION_FIELD], 
                answer: currentCorrectAnswer 
            });
        }
    }
    
    nextButton.disabled = false;
    flipCard();
}

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
    
    let incorrectListHtml = '';
    if (examIncorrectWords.length > 0) {
        incorrectListHtml = '<h2>📚 錯誤清單</h2><ul class="incorrect-list">';
        examIncorrectWords.forEach((word, index) => {
            incorrectListHtml += `
                <li>
                    <strong>${index + 1}. 問題:</strong> ${word.question} <br>
                    <strong>答案:</strong> <span style="color: #c62828;">${word.answer}</span>
                </li>
            `;
        });
        incorrectListHtml += '</ul>';
    }
    
    const params = new URLSearchParams(window.location.search);
    const listName = params.get('list');
    const modeId = params.get('mode_id');
    const selectedIds = params.get('selected_ids');

    let backToSetupUrl;
    if (selectedIds) {
        backToSetupUrl = `quiz.html?list=${listName}&mode_id=RESUME_MULTI&selected_ids=${selectedIds}`; 
    } else {
        backToSetupUrl = `quiz.html?list=${listName}&mode_id=${modeId}`; 
    }

    resultsArea.innerHTML = `
        <h1>考試結束！</h1>
        <div class="results-summary">
            <h2>${message}</h2>
            <div class="final-score">${finalScore}%</div>
            <p>總題數: ${examTotalQuestions}</p>
            <p>答對: ${correctCount}</p>
            <p>答錯: ${examIncorrectCount}</p>
        </div>
        ${incorrectListHtml}
        <button id="restart-exam-btn" class="option-button review-mode">再考一次</button>
        <a href="${backToSetupUrl}" class="home-button">返回設定頁</a>
    `;
    
    document.getElementById('restart-exam-btn').addEventListener('click', () => {
        resultsArea.style.display = 'none';
        startGame();
    });
}

initializeQuiz();
