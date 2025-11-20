// 頁面載入完成後，執行
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', renderHomePage);
    renderHomePage();
});

let globalConfig = null; // 儲存 config.json

// ⭐️ 輔助函式：異步載入外部 JSON 檔案 ⭐️
async function loadExternalConfig(path) {
    try {
        const response = await fetch(path + '?v=' + new Date().getTime());
        if (!response.ok) {
            console.error(`無法讀取外部配置: ${path}`, response.statusText);
            return []; // 載入失敗時返回空陣列
        }
        return await response.json();
    } catch (error) {
        console.error(`載入外部配置失敗: ${path}`, error);
        return [];
    }
}

async function renderHomePage() {
    try {
        if (!globalConfig) {
            const response = await fetch('config.json?v=' + new Date().getTime());
            if (!response.ok) {
                throw new Error('無法讀取 config.json');
            }
            let initialConfig = await response.json();
            
            // ⭐️ 核心合併邏輯：處理外部配置引用 ⭐️
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
            globalConfig = initialConfig;
            document.title = globalConfig.siteTitle || '單字卡練習';
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
                pathSegments.push({ name: found.name, hash: currentHash });
            } else {
                window.location.hash = '';
                return;
            }
        }

        // 渲染麵包屑
        breadcrumbs.innerHTML = `<li><a href="#" onclick="window.location.hash=''; return false;">首頁</a></li>`;
        if (pathSegments.length > 0) {
            pathSegments.forEach((segment, index) => {
                const isActive = index === pathSegments.length - 1;
                breadcrumbs.innerHTML += `
                    <li>
                        ${isActive ? 
                            `<span>${segment.name}</span>` : 
                            `<a href="${segment.hash}">${segment.name}</a>`
                        }
                    </li>
                `;
            });
        }

        mainTitle.textContent = currentCategory ? currentCategory.name : globalConfig.siteTitle;

        let allHtml = '';
        if (currentLevelItems) {
            for (const item of currentLevelItems) {
                if (!item.enabled) continue; 
                
                // 處理 Category 類型
                if (item.type === 'category') {
                    // ⭐️ 修正導航連結生成 ⭐️
                    const targetHash = currentHash + item.id;
                    allHtml += `
                        <a href="${targetHash}" class="list-item category-item list-button">
                            <h2 class="category-name">${item.name}</h2>
                        </a>
                    `;
                } 
                // 處理 List 類型
                else if (item.type === 'list') {
                    if (item.id === 'MULTI_SELECT_ENTRY') {
                         // ⭐️ 綜合測驗區入口 (紫色按鈕樣式) ⭐️
                         allHtml += `
                            <a href="quiz.html?list=${item.id}&mode_id=INITIATE_SELECT" 
                               class="list-item quiz-item list-button mcq-mode list-button-group" 
                               style="display: flex; justify-content: center; align-items: center; padding: 25px; text-decoration: none;">
                                <h2 class="list-name" style="color: white; margin: 0;">${item.name}</h2>
                            </a>
                        `;
                    } else {
                        // 一般單字庫列表
                        allHtml += `
                            <div class="list-item quiz-item">
                                <h4 class="list-name">${item.name}</h4>
                                <div class="mode-buttons">
                        `;
                        if (item.modes && item.modes.length > 0) {
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

// 處理所有首頁點擊
function handleHomePageClick(event) {
    const button = event.target.closest('button.option-button'); 
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
