// 頁面載入完成後，執行
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', renderHomePage);
    renderHomePage();
});

let globalConfig = null; // 儲存 config.json

// 輔助函式：異步載入外部 JSON 檔案 
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

async function renderHomePage() {
    try {
        if (!globalConfig) {
            const response = await fetch('config.json?v=' + new Date().getTime());
            if (!response.ok) {
                throw new Error('無法讀取 config.json');
            }
            let initialConfig = await response.json();
            
            // 核心合併邏輯
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

        // 渲染內容
        let allHtml = '';
        if (currentLevelItems) {
            for (const item of currentLevelItems) {
                if (!item.enabled) continue; 
                
                // 統一按鈕樣式：無論是 Category 還是 List，都使用 option-button list-button
                let targetHref = "javascript:void(0);";
                let actionData = "";
                
                if (item.type === 'category') {
                    // 分類：點擊後在當前頁面導航 (修改 Hash)
                    const targetHash = (currentHash.substring(1) ? currentHash.substring(1) + '/' : '') + item.id;
                    actionData = `data-action="navigate" data-target-hash="${targetHash}"`;
                } 
                else if (item.type === 'list') {
                    // 單字庫：點擊後跳轉到 quiz.html 進行模式選擇
                    let url = `quiz.html?list=${item.id}`;
                    
                    // 特殊處理：綜合測驗區入口需要額外參數
                    if (item.id === 'MULTI_SELECT_ENTRY') {
                        url += `&mode_id=INITIATE_SELECT`;
                    }
                    
                    targetHref = url;
                }

                // ⭐️ 統一渲染為深色長條按鈕 ⭐️
                allHtml += `
                    <a href="${targetHref}" 
                       class="option-button list-button" 
                       ${actionData}
                       style="display: flex; justify-content: center; align-items: center; text-decoration: none; margin-bottom: 10px; min-height: 50px;">
                        ${item.name}
                    </a>
                `;
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

// 處理點擊事件 (主要處理分類導航)
function handleHomePageClick(event) {
    const target = event.target.closest('.option-button');
    if (!target) return;

    const action = target.dataset.action;
    const targetHash = target.dataset.targetHash;
    
    // 處理分類點擊 (Category Navigation)
    if (action === 'navigate' && targetHash) {
        event.preventDefault(); 
        window.location.hash = targetHash;
    }
    
    // 一般 List 的 href 跳轉由瀏覽器預設處理，不需要 JS 干預
}
