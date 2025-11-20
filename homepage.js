// 頁面載入完成後，執行
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', renderHomePage);
    renderHomePage();
});

let globalConfig = null; // 儲存 config.json
let allListConfigs = {}; 

// ⭐️ 輔助函式：遞迴收集所有 list ID (單一設定檔模式專用)
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
            // 1. 讀取 config.json
            const response = await fetch('config.json?v=' + new Date().getTime());
            if (!response.ok) {
                throw new Error('無法讀取 config.json');
            }
            globalConfig = await response.json();
            document.title = globalConfig.siteTitle || '單字卡練習';
            
            // 2. 收集設定 (用於 Quiz 頁面查找)
            allListConfigs = {};
            collectAllListConfigs(globalConfig.catalog);
        }

        const container = document.getElementById('list-container');
        const mainTitle = document.getElementById('main-title');
        const breadcrumbs = document.getElementById('breadcrumbs');
        
        if (!container || !mainTitle || !breadcrumbs) return;

        // 3. 解析 URL Hash 來決定當前層級
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

        // 4. 渲染標題與麵包屑
        mainTitle.textContent = currentCategory ? currentCategory.name : globalConfig.siteTitle;

        breadcrumbs.innerHTML = '<li><a href="#">首頁</a></li>';
        pathSegments.forEach(segment => {
            breadcrumbs.innerHTML += `<li><a href="${segment.hash}">${segment.name}</a></li>`;
        });

        // 5. 渲染「返回上一層」按鈕
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

        // 6. 渲染列表項目
        for (const item of currentLevelItems) {
            
            if (item.enabled === false) continue;

            if (item.type === 'category') {
                // --- 資料夾 (JLPT, 讀本等) ---
                // 使用 list-button 樣式，讓它看起來是深藍色按鈕
                allHtml += `
                    <a href="#${pathSegments.map(p => p.hash.substring(1)).join('/')}${pathSegments.length > 0 ? '/' : ''}${item.id}" class="option-button list-button">
                        ${item.name}
                    </a>
                `;
            } else if (item.type === 'list') {
                // --- 單字庫 ---
                
                // ⭐️ 特殊處理：自選多庫入口 (紫色按鈕) ⭐️
                if (item.id === 'MULTI_SELECT_ENTRY') {
                    allHtml += `
                        <a href="quiz.html?list=${item.id}&mode_id=INITIATE_SELECT" 
                           class="option-button list-button mcq-mode" 
                           style="display: flex; justify-content: center; align-items: center; text-decoration: none; margin-bottom: 10px;">
                            ${item.name}
                        </a>
                    `;
                } else {
                    // ⭐️ 一般單字庫 (白底卡片 + 模式按鈕) ⭐️
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
        
        // 重新綁定點擊事件
        container.removeEventListener('click', handleHomePageClick); 
        container.addEventListener('click', handleHomePageClick); 

    } catch (error) {
        console.error('載入首頁設定失敗:', error);
        const container = document.getElementById('list-container');
        if (container) {
            // 顯示錯誤訊息以便除錯
            container.innerHTML = `<p>載入設定檔失敗: ${error.message}</p>`;
        }
    }
}

// 7. 處理模式按鈕點擊 (不處理 <a> 標籤的導航)
function handleHomePageClick(event) {
    const button = event.target.closest('button.option-button'); // 只監聽 button 元素
    if (!button) return;

    const listId = button.dataset.listId;
    const modeId = button.dataset.modeId;

    if (listId && modeId) {
        event.preventDefault(); 
        
        // 預設非考試模式
        const isExam = false; 

        const url = `quiz.html?list=${listId}&mode_id=${modeId}&exam=${isExam}`;
        window.location.href = url;
    }
}
