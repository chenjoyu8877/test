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

        if (currentLevelItems) {
            for (const item of currentLevelItems) {
                if (!item.enabled || item.type === 'external_category') continue; 
                
                if (item.type === 'category') {
                    const targetHash = (currentHash.substring(1) ? currentHash.substring(1) + '/' : '') + item.id;
                    
                    allHtml += `
                        <a href="javascript:void(0);" 
                           class="list-item category-item list-button" 
                           data-action="navigate" 
                           data-target-hash="${targetHash}">
                            <h2 class="category-name">${item.name}</h2>
                        </a>
                    `;
                } else if (item.type === 'list') {
                    if (item.id === 'MULTI_SELECT_ENTRY') {
                         allHtml += `
                            <a href="quiz.html?list=${item.id}&mode_id=INITIATE_SELECT" 
                               class="list-item quiz-item list-button mcq-mode list-button-group" 
                               style="display: flex; justify-content: center; align-items: center; padding: 25px; text-decoration: none;">
                                <h2 class="list-name" style="color: white; margin: 0;">${item.name}</h2>
                            </a>
                        `;
                    } else {
                        allHtml += `
                            <div class="list-item quiz-item">
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

function handleHomePageClick(event) {
    const target = event.target.closest('.option-button, .list-item.category-item, .list-button');
    if (!target) return;

    const listId = target.dataset.listId;
    const modeId = target.dataset.modeId;
    const action = target.dataset.action;
    const targetHash = target.dataset.targetHash;
    
    if (action === 'navigate' && targetHash) {
        event.preventDefault(); 
        window.location.hash = targetHash;
        return;
    }

    if (listId && modeId) {
        event.preventDefault(); 
        const isExam = false; 
        const url = `quiz.html?list=${listId}&mode_id=${modeId}&exam=${isExam}`;
        window.location.href = url;
    }
}
