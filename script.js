const familyDataUrl = 'data.json';
const TREE_PASSWORD = '';

const CARD_WIDTH = 260;
const CARD_HEIGHT = 260;
const HORIZONTAL_SPACING = 90;
const VERTICAL_SPACING = 150;
const CONTAINER_PADDING = 40;

const PARTNER_SPACING = 26;

const SIBLING_SPACING = 40; // Добавляем отступ для братьев и сестер
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.05;
const CHILDREN_CONNECTOR_RADIUS = 10;

const BASE_YEAR = 1800;
const YEARS_PER_GENERATION = 20;

let currentZoom = 0.5;
let isCompactMode = false; // По умолчанию рисуем строго под родителями
let globalFamilyTreeData = null;

async function fetchFamilyData() {
    const response = await fetch(familyDataUrl);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

function getFamilyMembers(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (data && Array.isArray(data.people)) {
        return data.people;
    }

    throw new Error('Invalid family data format');
}

function parseBirthYear(yearsString) {
    if (!yearsString) return null;
    const match = String(yearsString).match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
}

function showTreeError(message) {
    const container = document.getElementById('family-tree');
    const stage = document.getElementById('family-tree-stage');
    if (!container) {
        return;
    }

    container.innerHTML = `<p class="family-tree-error">${message}</p>`;
    container.style.width = '100%';
    container.style.height = 'auto';
    if (stage) {
        stage.style.width = '100%';
        stage.style.height = 'auto';
    }
}

function enableTreeTouchScrollSync() {
    const treeArea = document.getElementById('family-tree-viewport');
    if (!treeArea) {
        return;
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let lastX = 0;
    let lastY = 0;
    let activeDirection = null;

    treeArea.addEventListener('touchstart', event => {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        lastX = touch.clientX;
        lastY = touch.clientY;
        activeDirection = null;
    }, { passive: true });

    treeArea.addEventListener('touchmove', event => {
        const touch = event.touches[0];
        const totalDeltaX = touch.clientX - touchStartX;
        const totalDeltaY = touch.clientY - touchStartY;
        const stepDeltaX = touch.clientX - lastX;
        const stepDeltaY = touch.clientY - lastY;

        if (!activeDirection) {
            activeDirection = Math.abs(totalDeltaY) > Math.abs(totalDeltaX) ? 'vertical' : 'horizontal';
        }

        if (activeDirection === 'vertical') {
            window.scrollBy({
                top: -stepDeltaY,
                left: 0,
                behavior: 'auto'
            });
        } else {
            treeArea.scrollLeft -= stepDeltaX;
        }

        lastX = touch.clientX;
        lastY = touch.clientY;
        event.preventDefault();
    }, { passive: false });
}

function clampZoom(zoom) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function updateZoomLabel() {
    // const zoomValue = document.getElementById('zoom-value');
    const zoomReset = document.getElementById('zoom-reset');
    const label = `${Math.round(currentZoom * 100)}%`;

    // if (zoomValue) {
    //     zoomValue.textContent = label;
    // }

    if (zoomReset) {
        zoomReset.textContent = label;
    }
}

function applyTreeZoom() {
    const tree = document.getElementById('family-tree');
    const stage = document.getElementById('family-tree-stage');

    if (!tree || !stage) {
        return;
    }

    const baseWidth = Number(tree.dataset.baseWidth || 0);
    const baseHeight = Number(tree.dataset.baseHeight || 0);

    tree.style.transform = `scale(${currentZoom})`;

    if (baseWidth > 0) {
        stage.style.width = `${baseWidth * currentZoom}px`;
    }

    if (baseHeight > 0) {
        stage.style.height = `${baseHeight * currentZoom}px`;
    }

    updateZoomLabel();
}

function setViewportFocusAfterZoom(viewport, focusPoint, previousZoom) {
    if (!viewport || !focusPoint || previousZoom <= 0) {
        return;
    }

    const rect = viewport.getBoundingClientRect();
    const offsetX = focusPoint.clientX - rect.left;
    const offsetY = focusPoint.clientY - rect.top;
    const contentX = (viewport.scrollLeft + offsetX) / previousZoom;
    const contentY = (viewport.scrollTop + offsetY) / previousZoom;

    viewport.scrollLeft = contentX * currentZoom - offsetX;
    viewport.scrollTop = contentY * currentZoom - offsetY;
}

function setTreeZoom(nextZoom, focusPoint) {
    const viewport = document.getElementById('family-tree-viewport');
    const previousZoom = currentZoom;
    currentZoom = clampZoom(nextZoom);

    if (currentZoom === previousZoom) {
        return;
    }

    applyTreeZoom();

    if (focusPoint) {
        setViewportFocusAfterZoom(viewport, focusPoint, previousZoom);
    }
}

function changeTreeZoom(delta, focusPoint) {
    const nextZoom = Math.round((currentZoom + delta) * 100) / 100;
    setTreeZoom(nextZoom, focusPoint);
}

function getViewportCenterPoint(viewport) {
    const rect = viewport.getBoundingClientRect();
    return {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
    };
}

function getTouchDistance(firstTouch, secondTouch) {
    const deltaX = secondTouch.clientX - firstTouch.clientX;
    const deltaY = secondTouch.clientY - firstTouch.clientY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function initializeTreeZoomControls() {
    const zoomInButton = document.getElementById('zoom-in');
    const zoomOutButton = document.getElementById('zoom-out');
    const zoomResetButton = document.getElementById('zoom-reset');
    const viewport = document.getElementById('family-tree-viewport');

    // Создаем выпадающее меню настроек в верхнем левом углу
    if (!document.getElementById('tree-settings-menu')) {
        const menuContainer = document.createElement('div');
        menuContainer.id = 'tree-settings-menu';
        menuContainer.style.position = 'fixed';
        menuContainer.style.top = '15px';
        menuContainer.style.left = '15px';
        menuContainer.style.zIndex = '1000';

        const menuBtn = document.createElement('button');
        menuBtn.textContent = '☰ Menu';
        menuBtn.style.padding = '8px 12px';
        menuBtn.style.cursor = 'pointer';
        menuBtn.style.borderRadius = '6px';
        menuBtn.style.border = '1px solid #ccc';
        menuBtn.style.background = '#fff';
        menuBtn.style.fontWeight = '500';

        const settingsPanel = document.createElement('div');
        settingsPanel.style.display = 'none';
        settingsPanel.style.flexDirection = 'column';
        settingsPanel.style.gap = '10px';
        settingsPanel.style.marginTop = '10px';
        settingsPanel.style.padding = '15px';
        settingsPanel.style.background = '#fff';
        settingsPanel.style.border = '1px solid #ccc';
        settingsPanel.style.borderRadius = '6px';
        settingsPanel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

        const modeBtn = document.createElement('button');
        modeBtn.id = 'toggle-layout-mode';
        modeBtn.textContent = isCompactMode ? 'Standard Mode' : 'Compact Mode';
        modeBtn.style.padding = '8px 12px';
        modeBtn.style.cursor = 'pointer';
        modeBtn.style.borderRadius = '4px';
        modeBtn.style.border = '1px solid #ccc';
        modeBtn.style.background = '#f9f9f9';

        modeBtn.onclick = () => {
            isCompactMode = !isCompactMode;
            modeBtn.textContent = isCompactMode ? 'Standard Mode' : 'Compact Mode';
            if (globalFamilyTreeData) {
                createFamilyTree(globalFamilyTreeData);
            }
        };

        menuBtn.onclick = () => {
            const isHidden = settingsPanel.style.display === 'none';
            settingsPanel.style.display = isHidden ? 'flex' : 'none';
        };

        settingsPanel.appendChild(modeBtn);
        menuContainer.appendChild(menuBtn);
        menuContainer.appendChild(settingsPanel);
        document.body.appendChild(menuContainer);
    }

    if (zoomInButton) {
        zoomInButton.addEventListener('click', () => {
            changeTreeZoom(ZOOM_STEP, viewport ? getViewportCenterPoint(viewport) : null);
        });
    }

    if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => {
            changeTreeZoom(-ZOOM_STEP, viewport ? getViewportCenterPoint(viewport) : null);
        });
    }

    if (zoomResetButton) {
        zoomResetButton.addEventListener('click', () => {
            setTreeZoom(1, viewport ? getViewportCenterPoint(viewport) : null);
        });
    }

    if (viewport) {
        viewport.addEventListener('wheel', event => {
            if (!event.ctrlKey && !event.metaKey) {
                return;
            }

            event.preventDefault();
            changeTreeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP, {
                clientX: event.clientX,
                clientY: event.clientY
            });
        }, { passive: false });

        let pinchStartDistance = null;
        let pinchStartZoom = currentZoom;
        let pinchCenterPoint = null;

        viewport.addEventListener('touchstart', event => {
            if (event.touches.length !== 2) {
                pinchStartDistance = null;
                pinchCenterPoint = null;
                return;
            }

            pinchStartDistance = getTouchDistance(event.touches[0], event.touches[1]);
            pinchStartZoom = currentZoom;
            pinchCenterPoint = {
                clientX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
                clientY: (event.touches[0].clientY + event.touches[1].clientY) / 2
            };
        }, { passive: true });

        viewport.addEventListener('touchmove', event => {
            if (event.touches.length !== 2 || pinchStartDistance === null) {
                return;
            }

            const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
            const scaleFactor = currentDistance / pinchStartDistance;
            pinchCenterPoint = {
                clientX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
                clientY: (event.touches[0].clientY + event.touches[1].clientY) / 2
            };
            setTreeZoom(pinchStartZoom * scaleFactor, pinchCenterPoint);
            event.preventDefault();
        }, { passive: false });

        viewport.addEventListener('touchend', event => {
            if (event.touches.length < 2) {
                pinchStartDistance = null;
                pinchCenterPoint = null;
            }
        }, { passive: true });
    }

    updateZoomLabel();
}

function normalizeFamilyData(data) {
    const members = getFamilyMembers(data);
    const memberMap = new Map();
    const lookupMap = new Map();

    members.forEach(member => {
        if (member.id) {
            lookupMap.set(member.id, member);
        }
        if (member.name) {
            lookupMap.set(member.name, member);
        }
    });

    function resolveMemberKey(reference) {
        if (!reference) {
            return null;
        }

        const resolvedMember = lookupMap.get(reference);
        if (!resolvedMember) {
            return null;
        }

        return resolvedMember.id || resolvedMember.name || null;
    }

    function resolveRelationshipList(references = []) {
        return references
            .flatMap(reference => Array.isArray(reference) ? reference : [reference])
            .map(resolveMemberKey)
            .filter(Boolean);
    }

    function resolvePartnerGroups(relationshipData) {
        const groups = [];
        const directPartnerId = resolveMemberKey(relationshipData.partner);

        if (directPartnerId) {
            groups.push({
                partnerId: directPartnerId
            });
        }

        (relationshipData.partners || []).forEach(entry => {
            if (!entry) {
                return;
            }

            const partnerId = resolveMemberKey(
                typeof entry === 'string' ? entry : entry.partner
            );
            if (!partnerId) {
                return;
            }

            groups.push({
                partnerId
            });
        });

        return groups;
    }

    members.forEach((member, index) => {
        const relationshipData = member.relationships || {};
        const partnerGroups = resolvePartnerGroups(relationshipData);
        const normalizedMember = {
            ...member,
            id: member.id || member.name || `member-${index}`,
            parents: resolveRelationshipList(relationshipData.parents || []),
            children: [],
            partners: [...new Set(partnerGroups.map(group => group.partnerId))],
            partnerGroups,
            siblings: resolveRelationshipList(relationshipData.siblings || [])
        };

        memberMap.set(normalizedMember.id, normalizedMember);
    });

    memberMap.forEach(member => {
        member.parents.forEach(parentId => {
            const parent = memberMap.get(parentId);
            if (parent && !parent.children.includes(member.id)) {
                parent.children.push(member.id);
            }
        });

        member.partnerGroups.forEach(group => {
            const partner = memberMap.get(group.partnerId);
            if (partner && !partner.partners.includes(member.id)) {
                partner.partners.push(member.id);
            }
        });
    });

    return [...memberMap.values()];
}


function calculateGenerations(members, memberMap) {
    const generationMap = new Map();

    function getGeneration(member) {
        if (generationMap.has(member.id)) {
            return generationMap.get(member.id);
        }

        let topoGen = 0;
        
        if (member.parents.length > 0) {
            const parentGenerations = member.parents
                .map(parentId => memberMap.get(parentId))
                .filter(Boolean)
                .map(getGeneration);

            if (parentGenerations.length > 0) {
                topoGen = Math.max(...parentGenerations) + 1;
            }
        }

        let timeGen = topoGen;
        const birthYear = parseBirthYear(member.years);
        if (birthYear) {
            timeGen = Math.floor((birthYear - BASE_YEAR) / YEARS_PER_GENERATION);
        }

        const finalGen = Math.max(topoGen, timeGen);
        generationMap.set(member.id, finalGen);
        return finalGen;
    }

    // 1. Первичный расчет сверху вниз
    members.forEach(getGeneration);

    // 2. Корректировка снизу вверх: притягиваем родителей без дат к их детям
    let changed;
    do {
        changed = false;
        members.forEach(member => {
            if (!parseBirthYear(member.years) && member.children && member.children.length > 0) {
                const childGens = member.children
                    .map(childId => generationMap.get(childId))
                    .filter(gen => typeof gen === 'number');

                if (childGens.length > 0) {
                    const minChildGen = Math.min(...childGens);
                    const currentGen = generationMap.get(member.id);
                    const targetGen = minChildGen - 1;

                    if (currentGen < targetGen) {
                        generationMap.set(member.id, targetGen);
                        changed = true;
                    }
                }
            }
        });
    } while (changed);

    // 3. Синхронизируем уровни братьев/сестер (чтобы они всегда были на одной линии)
    members.forEach(member => {
        // Собираем всех сиблингов через общих родителей + явно указанных
        const siblingSet = new Set([member.id, ...member.siblings]);
        member.parents.forEach(parentId => {
            const parent = memberMap.get(parentId);
            if (parent && parent.children) {
                parent.children.forEach(childId => siblingSet.add(childId));
            }
        });

        if (siblingSet.size > 1) {
            let maxSiblingGen = 0;
            siblingSet.forEach(sibId => {
                maxSiblingGen = Math.max(maxSiblingGen, generationMap.get(sibId) || 0);
            });
            siblingSet.forEach(sibId => {
                generationMap.set(sibId, maxSiblingGen);
            });
        }
    });

    const visitedPartnerGroups = new Set();

    // 4. Синхронизируем уровни супругов
    members.forEach(member => {
        if (visitedPartnerGroups.has(member.id)) {
            return;
        }

        const stack = [member.id];
        const partnerGroup = [];
        let groupGeneration = generationMap.get(member.id) || 0;

        while (stack.length > 0) {
            const currentId = stack.pop();
            if (visitedPartnerGroups.has(currentId)) {
                continue;
            }

            visitedPartnerGroups.add(currentId);
            partnerGroup.push(currentId);
            groupGeneration = Math.max(groupGeneration, generationMap.get(currentId) || 0);

            const currentMember = memberMap.get(currentId);
            if (!currentMember) {
                continue;
            }

            currentMember.partners.forEach(partnerId => {
                if (!visitedPartnerGroups.has(partnerId)) {
                    stack.push(partnerId);
                }
            });
        }

        partnerGroup.forEach(memberId => {
            generationMap.set(memberId, groupGeneration);
        });
    });

    return generationMap;
}

function getFamilyColor(seedString) {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Расширяем диапазон оттенков (Hue) от зеленых до фиолетовых (≈ 140 - 300)
    // чтобы ветки сильнее отличались друг от друга, сохраняя при этом холодный тон
    const h = Math.abs(hash % 160) + 140; 
    const s = Math.abs((hash >> 8) % 40) + 60; // Насыщенность 60-100%
    const l = Math.abs((hash >> 16) % 30) + 40; // Яркость 40-70%
    
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function createMemberCard(member) {
    const memberDiv = document.createElement('div');
    memberDiv.className = 'family-member';

    function hasValue(value) {
        return value !== null && value !== undefined && String(value).trim() !== '';
    }

    function createDetailRow(label, value) {
        if (!hasValue(value)) {
            return '';
        }

        return `<p><strong>${label}:</strong> ${value}</p>`;
    }

    const photoMarkup = hasValue(member.photo)
        ? `<div class="family-member-media"><img class="family-member-photo" src="${member.photo}" alt="${member.name}"></div>`
        : '';

    memberDiv.innerHTML = `
        ${photoMarkup}
        <h3>${member.name}</h3>
        ${createDetailRow('Years', member.years)}
        ${createDetailRow('Birth', member.birthPlace)}
        ${createDetailRow('Burial', member.burialPlace)}
        ${createDetailRow('Comment', member.comment)}
    `;
    return memberDiv;
}

function createSvgLine(x1, y1, x2, y2, className) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', className);
    return line;
}

function createSvgPolyline(points, className) {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute(
        'points',
        points.map(point => `${point.x},${point.y}`).join(' ')
    );
    polyline.setAttribute('class', className);
    return polyline;
}

function createOrthogonalParentChildLine(startX, startY, endX, endY, className, middleY) {
    const routeY = typeof middleY === 'number'
        ? middleY
        : startY + Math.max(28, (endY - startY) * 0.45);

    return createSvgPolyline([
        { x: startX, y: startY },
        { x: startX, y: routeY },
        { x: endX, y: routeY },
        { x: endX, y: endY }
    ], className);
}

function getSpouseConnectionPoints(firstPosition, secondPosition) {
    if (firstPosition.centerX <= secondPosition.centerX) {
        return {
            startX: firstPosition.rightX,
            startY: firstPosition.centerY,
            endX: secondPosition.leftX,
            endY: secondPosition.centerY,
            centerX: (firstPosition.rightX + secondPosition.leftX) / 2,
            centerY: (firstPosition.centerY + secondPosition.centerY) / 2
        };
    }

    return {
        startX: firstPosition.leftX,
        startY: firstPosition.centerY,
        endX: secondPosition.rightX,
        endY: secondPosition.centerY,
        centerX: (firstPosition.leftX + secondPosition.rightX) / 2,
        centerY: (firstPosition.centerY + secondPosition.centerY) / 2
    };
}

function buildGenerationLayout(sortedLevels, memberMap) {
    const orderMap = new Map();

    sortedLevels.forEach(([, levelMembers]) => {
        levelMembers.forEach((member, index) => orderMap.set(member.id, index));
    });

    function getAverage(values) {
        if (!values.length) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function getRelationScore(member) {
        const parentScores = member.parents.map(id => orderMap.get(id)).filter(s => s !== undefined);
        const childScores = member.children.map(id => orderMap.get(id)).filter(s => s !== undefined);
        const partnerScores = member.partners.map(id => orderMap.get(id)).filter(s => s !== undefined);

        const parentAvg = getAverage(parentScores);
        const childAvg = getAverage(childScores);
        const partnerAvg = getAverage(partnerScores);

        let familyScore = parentAvg !== null ? parentAvg : (childAvg !== null ? childAvg : null);
        
        if (familyScore === null && partnerAvg === null) return orderMap.get(member.id) || 0;
        if (familyScore === null) return partnerAvg;
        if (partnerAvg === null) return familyScore;

        return familyScore * 0.7 + partnerAvg * 0.3;
    }

    function buildPartnerClusters(levelMembers) {
        const usedIds = new Set();
        const clusters = [];

        levelMembers.forEach(member => {
            if (usedIds.has(member.id)) {
                return;
            }

            // Собираем всех супругов в один кластер по цепочке
            const cluster = [];
            const queue = [member];
            usedIds.add(member.id);

            while (queue.length > 0) {
                const current = queue.shift();
                cluster.push(current);

                current.partners.forEach(pId => {
                    if (!usedIds.has(pId)) {
                        const partner = memberMap.get(pId);
                        if (partner && levelMembers.includes(partner)) {
                            usedIds.add(pId);
                            queue.push(partner);
                        }
                    }
                });
            }

            // Находим человека с максимальным количеством супругов
            const centerMember = cluster.reduce((a, b) => a.partners.length > b.partners.length ? a : b);
            const others = cluster.filter(m => m.id !== centerMember.id);
            
            // Сортируем остальных супругов по их весу (чтобы тянулись к своим родителям/детям)
            others.sort((firstMember, secondMember) => {
                const firstScore = getRelationScore(firstMember);
                const secondScore = getRelationScore(secondMember);
                if (firstScore !== secondScore) {
                    return firstScore - secondScore;
                }
                return firstMember.name.localeCompare(secondMember.name);
            });

            // Распределяем: половина супругов слева, центральный человек, вторая половина справа
            const arranged = [];
            const mid = Math.floor(others.length / 2);
            for (let i = 0; i < mid; i++) arranged.push(others[i]);
            arranged.push(centerMember);
            for (let i = mid; i < others.length; i++) arranged.push(others[i]);

            clusters.push(arranged);
        });

        return clusters;
    }

    function orderPartnerClusters(levelMembers) {
        const clusters = buildPartnerClusters(levelMembers);

        clusters.sort((firstCluster, secondCluster) => {
            const firstScore = getAverage(firstCluster.map(member => getRelationScore(member))) || 0;
            const secondScore = getAverage(secondCluster.map(member => getRelationScore(member))) || 0;

            if (firstScore !== secondScore) {
                return firstScore - secondScore;
            }

            return firstCluster[0].name.localeCompare(secondCluster[0].name);
        });

        return clusters.flat();
    }

    for (let pass = 0; pass < 6; pass += 1) { // Увеличено число проходов до 6 для лучшего распутывания
        sortedLevels.forEach(([, levelMembers]) => {
            const arrangedMembers = orderPartnerClusters(levelMembers);
            levelMembers.splice(0, levelMembers.length, ...arrangedMembers);
            levelMembers.forEach((member, index) => orderMap.set(member.id, index));
        });

        [...sortedLevels].reverse().forEach(([, levelMembers]) => {
            const arrangedMembers = orderPartnerClusters(levelMembers);
            levelMembers.splice(0, levelMembers.length, ...arrangedMembers);
            levelMembers.forEach((member, index) => orderMap.set(member.id, index));
        });
    }
}

function drawConnections(members, positions, svg, rowMetrics) {
    const siblingPairs = new Set();
    const partnerPairs = new Set();
    const memberMap = new Map(members.map(member => [member.id, member]));
    
    // Рисуем линии супругов
    members.forEach(member => {
        const memberPosition = positions.get(member.id);
        if (!memberPosition) return;

        member.partners.forEach(partnerId => {
            const partnerPosition = positions.get(partnerId);
            if (!partnerPosition) return;

            const pairKey = [member.id, partnerId].sort().join('::');
            if (partnerPairs.has(pairKey)) return;

            partnerPairs.add(pairKey);
            const connection = getSpouseConnectionPoints(memberPosition, partnerPosition);

            const line = createSvgLine(
                connection.startX, connection.startY,
                connection.endX, connection.endY,
                'connection partner'
            );
            line.style.stroke = '#80b3ff';
            line.style.strokeDasharray = '5,5';
            svg.appendChild(line);
        });

        member.siblings.forEach(siblingId => {
            const siblingPosition = positions.get(siblingId);
            if (!siblingPosition) return;

            const pairKey = [member.id, siblingId].sort().join('::');
            if (siblingPairs.has(pairKey)) return;

            siblingPairs.add(pairKey);

            const line = createSvgLine(
                memberPosition.centerX, memberPosition.centerY,
                siblingPosition.centerX, siblingPosition.centerY,
                'connection sibling'
            );
            line.style.stroke = '#b3d1ff'; // Бледно-синий
            svg.appendChild(line);
        });
    });

    // Группируем детей по комбинированному ключу их родителей
    const families = new Map();
    members.forEach(member => {
        if (member.parents.length > 0) {
            const parentsKey = [...member.parents].sort().join(',');
            if (!families.has(parentsKey)) {
                families.set(parentsKey, []);
            }
            families.get(parentsKey).push(member);
        }
    });

    let channelOffsetCount = 0;

    // Отрисовка магистральных линий от родителей к детям
    families.forEach((children, parentsKey) => {
        const parentIds = parentsKey.split(',');
        const familyColor = getFamilyColor(parentIds[0]);
        
        let trunkStartX = 0, trunkStartY = 0;
        let parentsFound = false;

        if (parentIds.length >= 2) {
            const pos1 = positions.get(parentIds[0]);
            const pos2 = positions.get(parentIds[1]);
            if (pos1 && pos2) {
                const center = getSpouseConnectionPoints(pos1, pos2);
                trunkStartX = center.centerX;
                trunkStartY = center.centerY;
                parentsFound = true;
            }
        } 
        
        if (!parentsFound && parentIds.length > 0) {
            const pos = positions.get(parentIds[0]);
            if (pos) {
                trunkStartX = pos.centerX;
                trunkStartY = pos.bottomY;
                parentsFound = true;
            }
        }

        if (!parentsFound) return;

        // Вычисляем координаты детей
        const childPositions = children.map(c => positions.get(c.id)).filter(Boolean);
        if (childPositions.length === 0) return;

        const minChildTopY = Math.min(...childPositions.map(p => p.topY));
        const minChildX = Math.min(...childPositions.map(p => p.centerX));
        const maxChildX = Math.max(...childPositions.map(p => p.centerX));

        // Рассчитываем уникальный уровень горизонтали, чтобы избежать слияния
        const staggerOffset = (channelOffsetCount % 8) * 8; 
        channelOffsetCount++;
        
        const channelY = minChildTopY - 15 - staggerOffset;

        // 1. Ствол вниз (от родителей до горизонтали)
        const trunkLine = createSvgLine(trunkStartX, trunkStartY, trunkStartX, channelY, 'connection trunk');
        trunkLine.style.stroke = familyColor;
        svg.appendChild(trunkLine);

         // 2. Горизонтальная расходящаяся линия, если детей несколько или ребенок сбоку
         const leftX = Math.min(trunkStartX, minChildX);
         const rightX = Math.max(trunkStartX, maxChildX);
         if (leftX !== rightX) {
             const hLine = createSvgLine(leftX, channelY, rightX, channelY, 'connection branch');
             hLine.style.stroke = familyColor;
             svg.appendChild(hLine);
         }
 
         // 3. Вертикальные отростки вниз к каждому ребенку + кружок на конце
         childPositions.forEach(childPos => {
             const dropLine = createSvgLine(childPos.centerX, channelY, childPos.centerX, childPos.topY, 'connection drop');
             dropLine.style.stroke = familyColor;
             svg.appendChild(dropLine);
 
             const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
             dot.setAttribute('cx', childPos.centerX);
             dot.setAttribute('cy', childPos.topY);
             dot.setAttribute('r', CHILDREN_CONNECTOR_RADIUS); // Размер точки
             dot.setAttribute('fill', familyColor);
             svg.appendChild(dot);
         });
     });
 }

function createFamilyTree(data) {
    if (!globalFamilyTreeData) globalFamilyTreeData = data;
    
    const container = document.getElementById('family-tree');
    const stage = document.getElementById('family-tree-stage');
    container.innerHTML = '';

    const members = normalizeFamilyData(data);
    const memberMap = new Map(members.map(m => [m.id, m]));
    const generations = calculateGenerations(members, memberMap);

    const levels = new Map();
    members.forEach(member => {
        const gen = generations.has(member.id) ? generations.get(member.id) : 0;
        if (!levels.has(gen)) levels.set(gen, []);
        levels.get(gen).push(member);
    });

    const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0]);
    buildGenerationLayout(sortedLevels, memberMap);
    
    const coordMap = new Map();
    let globalMinX = Infinity;
    let globalMaxX = -Infinity;

    // Сначала бьем всех на кластеры по супругам для сохранения их как единого блока-монолита
    const levelClusters = new Map();
    
    sortedLevels.forEach(([generation, levelMembers]) => {
        const clusters = [];
        const visited = new Set();
        
        levelMembers.forEach(member => {
            if (visited.has(member.id)) return;
            
            const cluster = [member];
            visited.add(member.id);
            
            // Ищем супругов по всему уровню рекурсивно (даже если у человека несколько жен/мужей)
            let addedNew = true;
            while (addedNew) {
                addedNew = false;
                for (let i = 0; i < levelMembers.length; i++) {
                    const potentialPartner = levelMembers[i];
                    if (visited.has(potentialPartner.id)) continue;
                    
                    // Проверяем, является ли potentialPartner супругом кому-то уже добавленному в кластер
                    const isPartner = cluster.some(c => 
                        c.partners.includes(potentialPartner.id) || 
                        potentialPartner.partners.includes(c.id)
                    );
                    
                    if (isPartner) {
                        cluster.push(potentialPartner);
                        visited.add(potentialPartner.id);
                        addedNew = true; // Нашли партнера, крутим цикл еще раз (вдруг у него есть еще партнеры)
                    }
                }
            }
            
            // Восстанавливаем правильный порядок внутри кластера (как их отсортировал алгоритм)
            cluster.sort((a, b) => levelMembers.indexOf(a) - levelMembers.indexOf(b));
            
            clusters.push(cluster);
        });
        
        levelClusters.set(generation, clusters);
    });

    // Phase 1: Расчёт локальных X-координат кластерами
    const rowWidths = new Map();
    if (isCompactMode) {
        levelClusters.forEach((clusters, generation) => {
            let currentWidth = 0;
            clusters.forEach((cluster, cIndex) => {
                const prevClusterMain = cIndex > 0 ? clusters[cIndex - 1].find(m => m.parents.length > 0) || clusters[cIndex - 1][0] : null;
                const currentMain = cluster.find(m => m.parents.length > 0) || cluster[0];
                
                let spacingBefore = 0;
                if (prevClusterMain) {
                    const isSibling = prevClusterMain.parents.some(pId => currentMain.parents.includes(pId)) || currentMain.siblings.includes(prevClusterMain.id);
                    spacingBefore = isSibling ? SIBLING_SPACING : HORIZONTAL_SPACING;
                }
                
                const clusterWidth = cluster.length * CARD_WIDTH + (cluster.length - 1) * PARTNER_SPACING;
                currentWidth += (cIndex > 0 ? spacingBefore : 0) + clusterWidth;
            });
            rowWidths.set(generation, currentWidth);
        });
    }

    levelClusters.forEach((clusters, generation) => {
        let currentLeft = isCompactMode && rowWidths.has(generation) ? -rowWidths.get(generation) / 2 : 0;
        let prevClusterMain = null;

        clusters.forEach((cluster, cIndex) => {
            const currentMain = cluster.find(m => m.parents.length > 0) || cluster[0];
            
            let spacingBefore = 0;
            if (prevClusterMain) {
                const isSibling = prevClusterMain.parents.some(pId => currentMain.parents.includes(pId)) || currentMain.siblings.includes(prevClusterMain.id);
                spacingBefore = isSibling ? SIBLING_SPACING : HORIZONTAL_SPACING * 2;
            }

            let shiftX = currentLeft + (cIndex > 0 ? spacingBefore : 0);
            
            // Вычисляем внутренние координаты в рамках кластера (супруги прижаты друг к другу)
            const clusterInternalCoords = [];
            let internalX = 0;
            cluster.forEach(m => {
                clusterInternalCoords.push({ member: m, x: internalX });
                internalX += CARD_WIDTH + PARTNER_SPACING;
            });
            const clusterWidth = internalX - PARTNER_SPACING;

            if (!isCompactMode) {
                // Если есть люди с родителями в дереве, центрируем весь кластер относительно них
                const bloodMembers = cluster.filter(m => m.parents.length > 0);
                if (bloodMembers.length > 0) {
                    const anchor = bloodMembers[0];
                    const anchorInternalX = clusterInternalCoords.find(c => c.member.id === anchor.id).x;

                    const p1 = coordMap.get(anchor.parents[0]);
                    const p2 = anchor.parents.length > 1 ? coordMap.get(anchor.parents[1]) : null;
                    let parentMidX = p1 && p2 ? (p1.centerX + p2.centerX) / 2 : (p1 ? p1.centerX : null);

                    if (parentMidX !== null) {
                        const levelMembers = sortedLevels.find(([gen]) => gen === generation)[1];
                        const sibs = levelMembers.filter(m => m.parents.length > 0 && m.parents[0] === anchor.parents[0]);
                        const sIdx = sibs.findIndex(m => m.id === anchor.id);
                        
                        const groupWidth = sibs.length * CARD_WIDTH + (sibs.length - 1) * SIBLING_SPACING;
                        const targetAnchorX = parentMidX - groupWidth / 2 + sIdx * (CARD_WIDTH + SIBLING_SPACING);
                        
                        // Смещаем кластер так, чтобы якорный человек (кровный родственник) оказался на месте targetAnchorX
                        const idealClusterLeft = targetAnchorX - anchorInternalX;
                        shiftX = Math.max(shiftX, idealClusterLeft);
                    }
                }
            }

            // Применяем окончательное смещение к супругам и сохраняем
            clusterInternalCoords.forEach(c => {
                const finalX = shiftX + c.x;
                coordMap.set(c.member.id, { x: finalX, centerX: finalX + CARD_WIDTH / 2 });
                globalMinX = Math.min(globalMinX, finalX);
                globalMaxX = Math.max(globalMaxX, finalX + CARD_WIDTH);
            });

            currentLeft = shiftX + clusterWidth;
            prevClusterMain = currentMain;
        });
    });

    // Phase 2: Отрисовка с учетом общего смещения вправо
    const xOffset = (globalMinX === Infinity ? 0 : -globalMinX) + CONTAINER_PADDING;
    const maxContainerWidth = (globalMaxX === -Infinity ? 0 : globalMaxX) + xOffset + CONTAINER_PADDING;
    
    const positions = new Map();
    const rowMetrics = new Map();
    let currentTop = CONTAINER_PADDING;

    sortedLevels.forEach(([generation, levelMembers]) => {
        let maxCardHeight = CARD_HEIGHT;

        levelMembers.forEach((member) => {
            const layoutData = coordMap.get(member.id);
            const x = layoutData.x + xOffset;
            const y = currentTop;

            const card = createMemberCard(member);
            card.style.left = `${x}px`;
            card.style.top = `${y}px`;

            container.appendChild(card);
            const cardHeight = card.offsetHeight || CARD_HEIGHT;
            maxCardHeight = Math.max(maxCardHeight, cardHeight);

            positions.set(member.id, {
                leftX: x,
                rightX: x + CARD_WIDTH,
                topY: y,
                bottomY: y + cardHeight,
                centerX: x + CARD_WIDTH / 2,
                centerY: y + cardHeight / 2,
                generation
            });
        });

        const rowIndex = sortedLevels.findIndex(([gen]) => gen === generation);
        const nextLevelMembers = rowIndex >= 0 && rowIndex < sortedLevels.length - 1 ? sortedLevels[rowIndex + 1][1] : [];
        const FIXED_GAP = 80; 
        const gapAfter = nextLevelMembers.length === 0 ? 0 : FIXED_GAP;

        rowMetrics.set(generation, {
            topY: currentTop,
            bottomY: currentTop + maxCardHeight,
            height: maxCardHeight,
            gapAfter: gapAfter,
            channelY: currentTop + maxCardHeight + gapAfter / 2
        });

        currentTop += maxCardHeight + gapAfter;
    });

    const lastRow = sortedLevels.length > 0 ? rowMetrics.get(sortedLevels[sortedLevels.length - 1][0]) : null;
    const containerHeight = lastRow ? lastRow.bottomY + CONTAINER_PADDING : CARD_HEIGHT + CONTAINER_PADDING * 2;

    container.style.width = `${maxContainerWidth || CARD_WIDTH + CONTAINER_PADDING * 2}px`;
    container.style.height = `${containerHeight}px`;
    container.dataset.baseWidth = `${maxContainerWidth || CARD_WIDTH + CONTAINER_PADDING * 2}`;
    container.dataset.baseHeight = `${containerHeight}`;

    if (stage) {
        stage.style.width = container.style.width;
        stage.style.height = container.style.height;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', container.style.width);
    svg.setAttribute('height', container.style.height);
    svg.classList.add('family-tree-lines');
    container.prepend(svg);

    drawConnections(members, positions, svg, rowMetrics);
    applyTreeZoom();

    // Центрирование
    const viewport = document.getElementById('family-tree-viewport');
    if (viewport && stage) {
        setTimeout(() => {
            const treeWidth = stage.offsetWidth;
            const viewportWidth = viewport.clientWidth;
            if (treeWidth > viewportWidth) {
                viewport.scrollLeft = (treeWidth - viewportWidth) / 2;
            }
        }, 0);
    }
}
document.addEventListener('DOMContentLoaded', async () => {
    enableTreeTouchScrollSync();
    initializeTreeZoomControls();

    const input = prompt('Введите пароль для доступа к дереву:');
    if (input !== TREE_PASSWORD) {
        showTreeError('Неверный пароль');
        return;
    }

    try {
        const data = await fetchFamilyData();
        createFamilyTree(data);
    } catch (e) {
        console.error('Error:', e);
        showTreeError('Не удалось загрузить дерево. Если страница открыта как файл, запусти её через локальный сервер.');
    }
});
