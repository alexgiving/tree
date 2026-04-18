const familyDataUrl = 'data.json';

async function fetchFamilyData() {
    const response = await fetch(familyDataUrl);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

function createFamilyTree(data) {
    const familyTreeContainer = document.getElementById('family-tree');
    familyTreeContainer.innerHTML = ''; // Clear previous content

    data.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.classList.add('family-member');
        memberDiv.innerHTML = `
            <h3>${member.name}</h3>
            <p>Years of Life: ${member.years}</p>
            <p>Place of Birth/Burial: ${member.place}</p>
            <p>Comments: ${member.comments}</p>
        `;
        familyTreeContainer.appendChild(memberDiv);
    });

    drawConnections(data);
}

function drawConnections(data) {
    // Logic to draw lines between family members based on relationships
    data.forEach(member => {
        if (member.parents) {
            member.parents.forEach(parentId => {
                const parent = data.find(m => m.id === parentId);
                if (parent) {
                    // Draw line logic here
                }
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const familyData = await fetchFamilyData();
        createFamilyTree(familyData);
    } catch (error) {
        console.error('Error fetching family data:', error);
    }
});