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

        // 5. 渲染導航按鈕 (返回上一層 & 返回主選單) ⭐️
        let allHtml = ''; 
        if (currentCategory) { 
            let parentHash = '#'; 
            if (pathSegments.length > 1) {
                parentHash = pathSegments[pathSegments.length - 2].hash;
            }
            
            // ⭐️ 使用 Flexbox 讓兩個按鈕並排顯示 ⭐️
            allHtml += `
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <a href="${parentHash}" class="option-button back-button" style="flex: 1; text-align: center; min-height: 50px; display: flex; align-items: center; justify-content: center;">
                        &larr; 返回上一層
                    </a>
                    <a href="#" onclick="window.location.hash=''; return false;" class="option-button back-button" style="flex: 1; text-align: center; min-height: 50px; display: flex; align-items: center; justify-content: center; background-color: #7f8c8d;">
                        🏠 返回主選單
                    </a>
                </div>
            `;
        }

        // 6. 渲染列表項目
        for (const item of currentLevelItems) {
            
            if (item.enabled === false) continue;

            if (item.type === 'category') {
                // --- 資料夾 (JLPT, 讀本等) ---
                const targetHash = (currentHash.substring(1) ? currentHash.substring(1) + '/' : '') + item.id;
                
                allHtml += `
                    <a href="javascript:void(0);" 
                       class="option-button list-button" 
                       data-action="navigate" 
                       data-item-id="${item.id}"
                       data-target-hash="${targetHash}"
                       style="display: flex; justify-content: center; align-items: center; text-decoration: none; margin-bottom: 10px; min-height: 50px;">
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
                           style="display: flex; justify-content: center; align-items: center; text-decoration: none; margin-bottom: 10px; min-height: 50px;">
                            ${item.name}
                        </a>
                    `;
                } else {
                    // ⭐️ 一般單字庫 (統一使用深色按鈕樣式，點擊後跳轉到 quiz.html) ⭐️
                    allHtml += `
                        <a href="quiz.html?list=${item.id}" 
                           class="option-button list-button" 
                           style="display: flex; justify-content: center; align-items: center; text-decoration: none; margin-bottom: 10px; min-height: 50px;">
                            ${item.name}
                        </a>
                    `;
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

// 7. 處理點擊事件 (主要處理分類導航)
function handleHomePageClick(event) {
    const button = event.target.closest('.option-button'); // 統一監聽 option-button
    if (!button) return;

    const action = button.dataset.action;
    const targetHash = button.dataset.targetHash;

    // 處理分類導航 (JavaScript Hash 切換)
    if (action === 'navigate' && targetHash) {
        event.preventDefault();
        window.location.hash = targetHash;
        return;
    }

    // 處理單字庫跳轉 (MULTI_SELECT_ENTRY 和一般單字庫)
    // 因為我們已經在 HTML 中使用了正確的 href (例如 quiz.html?list=...), 
    // 這裡其實不需要額外的 JS 處理，除非我們要攔截它做特殊邏輯。
    // 目前的 href 會由瀏覽器自動處理跳轉。
}
