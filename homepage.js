// 頁面載入完成後，執行
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', renderHomePage);
    renderHomePage();
});

let globalConfig = null; // 儲存 config.json
let allListConfigs = {}; 

// ⭐️ 輔助函式：遞迴收集所有 list ID
function collectAllListConfigs(items) {
    if (!items) return;
    for (const item of items) {
        if (item.type === 'list' && item.enabled !== false) {
            allListConfigs[item.id] = { name: item.name, modes: item.modes };
        }
        if (item.type === 'category') {
            collectAllListConfigs(item.items);
        }
    }
}


async function renderHomePage() {
    try {
        if (!globalConfig) {
            const response = await fetch('config.json?v=' + new Date().getTime());
            if (!response.ok) {
                throw new Error('無法讀取 config.json');
            }
            globalConfig = await response.json();
            document.title = globalConfig.siteTitle || '單字卡練習';
            
            // 收集所有可用的單字庫配置
            allListConfigs = {};
            collectAllListConfigs(globalConfig.catalog);
        }

        const container = document.getElementById('list-container');
        const mainTitle = document.getElementById('main-title');
        const breadcrumbs = document.getElementById('breadcrumbs');
        
        if (!container || !mainTitle || !breadcrumbs) return;

        const path = window.location.hash.substring(1).split('/');
        
        let currentLevelItems = globalConfig.catalog;
        let currentCategory = null;
        let pathSegments = []; 
        let currentHash = '#';

        for (const segment of path) {
            if (segment === "") continue;
            const found = currentLevelItems.find(item => item.id === segment);
            if (found && found.type === 'category') {
                currentLevelItems = found.items;
                currentCategory = found;
                currentHash += segment + '/';
                pathSegments.push({ name: found.name, hash: currentHash.slice(0, -1) });
            }
        }

        mainTitle.textContent = currentCategory ? currentCategory.name : globalConfig.siteTitle;

        breadcrumbs.innerHTML = '<li><a href="#">首頁</a></li>';
        pathSegments.forEach(segment => {
            breadcrumbs.innerHTML += `<li><a href="${segment.hash}">${segment.name}</a></li>`;
        });

        let allHtml = ''; 
        if (currentCategory) { 
            let parentHash = '#'; 
            if (pathSegments.length > 1) {
                parentHash = pathSegments[pathSegments.length - 2].hash;
            }
            
            allHtml += `
                <a href="${parentHash}" class="option-button back-button">
                    &larr; 返回上一層
                </a>
            `;
        }

        for (const item of currentLevelItems) {
            
            if (item.enabled === false) continue;

            if (item.type === 'category') {
                // --- 這是一個「資料夾」 ---
                allHtml += `
                    <a href="#${pathSegments.map(p => p.hash.substring(1)).join('/')}${pathSegments.length > 0 ? '/' : ''}${item.id}" class="option-button list-button">
                        ${item.name}
                    </a>
                `;
            } else if (item.type === 'list') {
                // --- 這是一個「單字庫」 ---
                
                // ⭐️ 檢查是否為「自選多庫測驗入口」
                if (item.id === 'MULTI_SELECT_ENTRY') {
                    // 導向 quiz.html，讓它直接進入 list 選擇介面 (使用 INITIATE_SELECT 觸發 quiz.js 特殊流程)
                    allHtml += `
                        <div class="list-item">
                            <h4 class="list-name">${item.name}</h4>
                            <div class="button-group">
                                <a href="quiz.html?list=${item.id}&mode_id=INITIATE_SELECT" class="option-button mcq-mode">
                                    進入選擇
                                </a>
                            </div>
                        </div>
                    `;
                } else {
                    // 既有的單一單字庫邏輯
                    allHtml += `
                        <div class="list-item">
                            <h4 class="list-name">${item.name}</h4>
                            <div class="button-group">
                    `;

                    if (item.modes && Array.isArray(item.modes)) {
                        for (const mode of item.modes) {
                            if (mode.enabled) {
                                allHtml += `
                                    <button class="option-button ${mode.type}-mode" data-list-id="${item.id}" data-mode-id="${mode.id}" data-mode-type="${mode.type}">
                                        ${mode.name}
                                    </button>
                                `;
                            }
                        }
                    }
                    allHtml += `</div></div>`;
                }
            }
        }
        
        container.innerHTML = allHtml;
        
        container.removeEventListener('click', handleHomePageClick); 
        container.addEventListener('click', handleHomePageClick); 

    } catch (error) {
        console.error('載入首頁設定失敗:', error);
        const container = document.getElementById('list-container');
        if (container) {
            container.innerHTML = '<p>載入設定檔失敗。</p>';
        }
    }
}

// ⭐️ 9. 處理所有首頁點擊 (不變)
function handleHomePageClick(event) {
    const button = event.target.closest('.option-button');
    if (!button) return;

    const listId = button.dataset.listId;
    const modeId = button.dataset.modeId;

    if (listId && modeId) {
        event.preventDefault(); 
        
        const isExam = false; 

        const url = `quiz.html?list=${listId}&mode_id=${modeId}&exam=${isExam}`;
        window.location.href = url;
    }
}
