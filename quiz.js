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

// ⭐️ FIX: 確保給予變數賦值，解決 ReferenceError ⭐️
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

// ⭐️ 儲存錯題的單字數據 ⭐️
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

// 輔助函式：正規化字串
function normalizeString(str) {
    if (typeof str !== 'string') str = String(str);
    if (!str) return "";
    return str.replace(/～/g, '').replace(/~/g, '').replace(/・/g, '').replace(/\./g, '').replace(/\s/g, '');
}

// ⭐️ 輔助函式：異步載入外部 JSON 檔案 ⭐️
async function loadExternalConfig(path) {
    try {
        const response = await fetch(path + '?v=' + new Date().getTime());
        if (!response.ok) {
            console.error(`無法讀取外部配置: ${path}`, response.statusText);
            return []; 
        }
        return await response.json();
    } catch (error) {
        console.error(`載入外部配置失敗: ${path}`, error);
        return [];
    }
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
    
    // ⭐️ 2. 載入並合併外部配置 ⭐️
    let initialConfig = config; 
    let finalCatalog = [];
    
    for (const item of initialConfig.catalog) {
        if (item.type === 'external_category' && item.path) {
            console.log(`正在載入外部配置: ${item.path}`);
            const externalItems = await loadExternalConfig(item.path);
            finalCatalog.push(...externalItems);
        } else {
            finalCatalog.push(item);
        }
    }
    initialConfig.catalog = finalCatalog; 
    
    // ⭐️ 3. 收集所有列表配置
    allListConfigs = {};
    if (initialConfig.catalog) {
        initialConfig.catalog.forEach(item => findListById([item]));
    }
    
    // 4. 獲取 URL 參數
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
    
    // ⭐️ 5.5. 綜合測驗區的返回和繼續流程 ⭐️
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
    
    // ⭐️ 6. 載入數據 ⭐️
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
        // 錯誤狀態：MULTI_SELECT_ENTRY 但無 selected_ids，重導向
        multiSelectEntryConfig = listConfig;
        hideAllSetupAreas();
        setupMultiSelect();
        return; 
    }
    
    if (!modeConfig) { throw new Error(`找不到模式 ID: ${modeId}`); }

    // 7. 設定全局變數
    currentMode = modeConfig.type;
    QUESTION_FIELD = modeConfig.q_field;
    ANSWER_FIELD = modeConfig.a_field || '';
    BACK_CARD_FIELDS = modeConfig.back_fields || [];
    
    // 8. 載入單字庫數據
    vocabulary = [];
    for (const id of listIdsToLoad) {
        try {
            const filePath = `words/${id}.json?v=${new Date().getTime()}`;
            console.log(`嘗試載入: ${filePath}`); 
            const response = await fetch(filePath); 
            if (!response.ok) { 
                console.error(`無法讀取 ${id}.json 檔案。`); 
                continue; 
            }
            const listData = await response.json();
            vocabulary.push(...listData); 
        } catch (e) {
            console.error(`載入 ${id}.json 失敗:`, e);
        }
    }

    if (vocabulary.length > 0) {
        // 9. 設定返回按鈕連結
        let targetUrl;
        if (selectedIdsFromUrl) {
            targetUrl = `quiz.html?list=${listName}&mode_id=RESUME_MULTI&selected_ids=${selectedIdsFromUrl}`;
        } else if (currentMode === 'review') {
            targetUrl = `quiz.html?list=${listName}`;
        } else {
            targetUrl = `quiz.html?list=${listName}&mode_id=${modeId}`;
        }
        const returnButtons = document.querySelectorAll('.button-return');
        returnButtons.forEach(btn => btn.href = targetUrl);

        // 10. 顯示 UI
        modeChoiceArea.style.display = 'none';
        
        if (currentMode === 'review') {
            isExamMode = false;
            examSetupArea.style.display = 'none'; 
            practiceExamChoiceArea.style.display = 'none';
            modeChoiceArea.style.display = 'none'; 
            mainArea.style.display = 'flex'; 
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

            const practiceExamReturnBtn = practiceExamChoiceArea.querySelector('.button-return');
            if (practiceExamReturnBtn) {
                practiceExamReturnBtn.href = `quiz.html?list=${listName}`;
            }

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
                
                const examSetupReturnBtn = examSetupArea.querySelector('.button-return');
                if (examSetupReturnBtn) {
                    examSetupReturnBtn.href = targetUrl;
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
