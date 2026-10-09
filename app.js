// app.js - Union-Based Bare Family Tree with Smooth Drag-and-Drop

class FamilyTree {
  constructor() {
    this.people = new Map(); // id -> { id, name, x, y }
    this.unions = []; // { id, partnerA, partnerB, children: [] }
  }

  _norm(name) {
    return (name || '').trim();
  }

  getPerson(name) {
    if (!name) return null;
    const norm = this._norm(name).toLowerCase();
    for (const p of this.people.values()) {
      if (p.name.toLowerCase() === norm || p.id === name) return p;
    }
    return null;
  }

  getPersonById(id) {
    return this.people.get(id) || null;
  }

  addPerson(name, x = null, y = null) {
    const clean = this._norm(name);
    if (!clean) throw new Error('Person name cannot be empty');
    const existing = this.getPerson(clean);
    if (existing) return existing;

    const id = 'p_' + Math.random().toString(36).substring(2, 9);
    const person = { id, name: clean, x, y };
    this.people.set(id, person);
    return person;
  }

  getOrCreate(name) {
    return this.getPerson(name) || this.addPerson(name);
  }

  deletePerson(name) {
    const p = this.getPerson(name) || this.getPersonById(name);
    if (!p) return false;
    this.people.delete(p.id);

    this.unions = this.unions.filter(u => {
      if (u.partnerA === p.id && u.partnerB === p.id) return false;
      if (u.partnerA === p.id) {
        u.partnerA = u.partnerB;
        u.partnerB = null;
      } else if (u.partnerB === p.id) {
        u.partnerB = null;
      }
      u.children = u.children.filter(cid => cid !== p.id);
      return u.partnerA !== null || u.children.length > 0;
    });

    return true;
  }

  getOrCreateUnion(nameA, nameB = null) {
    const pA = this.getOrCreate(nameA);
    const pB = nameB ? this.getOrCreate(nameB) : null;
    if (pB && pA.id === pB.id) throw new Error('Cannot create union with oneself');

    for (const u of this.unions) {
      if (pB) {
        if ((u.partnerA === pA.id && u.partnerB === pB.id) ||
            (u.partnerA === pB.id && u.partnerB === pA.id)) {
          return u;
        }
      } else {
        if (u.partnerA === pA.id && !u.partnerB) return u;
      }
    }

    const id = 'u_' + Math.random().toString(36).substring(2, 9);
    const union = {
      id,
      partnerA: pA.id,
      partnerB: pB ? pB.id : null,
      children: []
    };
    this.unions.push(union);
    return union;
  }

  addChild(parentA, childName, parentB = null) {
    const pA = this.getOrCreate(parentA);
    const child = this.getOrCreate(childName);
    if (child.id === pA.id) throw new Error('Child cannot be their own parent');
    if (parentB) {
      const pB = this.getOrCreate(parentB);
      if (child.id === pB.id) throw new Error('Child cannot be their own parent');
    }

    if (this.isAncestor(child.id, pA.id)) {
      throw new Error(`Cannot add child: ${pA.name} is a descendant of ${child.name}`);
    }
    if (parentB && this.isAncestor(child.id, this.getPerson(parentB).id)) {
      throw new Error(`Cannot add child: ${parentB} is a descendant of ${child.name}`);
    }

    let union = null;
    if (!parentB) {
      const pAUnions = this.unions.filter(u => u.partnerA === pA.id || u.partnerB === pA.id);
      if (pAUnions.length === 1) {
        union = pAUnions[0];
      }
    }

    if (!union) {
      union = this.getOrCreateUnion(parentA, parentB);
    }

    if (!union.children.includes(child.id)) {
      union.children.push(child.id);
    }

    return { union, child };
  }

  getParents(childId) {
    const parents = [];
    for (const u of this.unions) {
      if (u.children.includes(childId)) {
        if (u.partnerA) parents.push(this.people.get(u.partnerA));
        if (u.partnerB) parents.push(this.people.get(u.partnerB));
      }
    }
    return parents.filter(Boolean);
  }

  getChildren(personId) {
    const children = [];
    for (const u of this.unions) {
      if (u.partnerA === personId || u.partnerB === personId) {
        for (const cid of u.children) {
          const c = this.people.get(cid);
          if (c && !children.some(x => x.id === c.id)) children.push(c);
        }
      }
    }
    return children;
  }

  getPartners(personId) {
    const partners = [];
    for (const u of this.unions) {
      if (u.partnerA === personId && u.partnerB) {
        partners.push(this.people.get(u.partnerB));
      } else if (u.partnerB === personId && u.partnerA) {
        partners.push(this.people.get(u.partnerA));
      }
    }
    return partners.filter(Boolean);
  }

  getSiblings(personId) {
    const siblings = [];
    for (const u of this.unions) {
      if (u.children.includes(personId)) {
        for (const cid of u.children) {
          if (cid !== personId) {
            const sib = this.people.get(cid);
            if (sib && !siblings.some(x => x.id === sib.id)) siblings.push(sib);
          }
        }
      }
    }
    return siblings;
  }

  isAncestor(ancestorId, personId, visited = new Set()) {
    if (visited.has(personId)) return false;
    visited.add(personId);
    for (const p of this.getParents(personId)) {
      if (p.id === ancestorId || this.isAncestor(ancestorId, p.id, visited)) {
        return true;
      }
    }
    return false;
  }

  findPath(nameA, nameB) {
    const start = this.getPerson(nameA);
    const end = this.getPerson(nameB);
    if (!start) return { error: `Person "${nameA}" not found` };
    if (!end) return { error: `Person "${nameB}" not found` };
    if (start.id === end.id) return { path: [start.name], nodeIds: [start.id], description: 'Same person' };

    const queue = [[start.id]];
    const visited = new Set([start.id]);
    const stepTaken = new Map();

    while (queue.length > 0) {
      const currentPath = queue.shift();
      const curr = currentPath[currentPath.length - 1];

      if (curr === end.id) {
        const textSteps = [];
        for (let i = 0; i < currentPath.length - 1; i++) {
          const u = currentPath[i];
          const v = currentPath[i + 1];
          const uName = this.people.get(u).name;
          const vName = this.people.get(v).name;
          const relDesc = stepTaken.get(`${u}->${v}`);
          textSteps.push(`${uName} ${relDesc} ${vName}`);
        }
        return {
          path: currentPath.map(id => this.people.get(id).name),
          nodeIds: currentPath,
          description: textSteps.join(' ➔ ')
        };
      }

      const neighbors = [];
      for (const p of this.getParents(curr)) neighbors.push({ id: p.id, desc: 'is child of' });
      for (const c of this.getChildren(curr)) neighbors.push({ id: c.id, desc: 'is parent of' });
      for (const s of this.getPartners(curr)) neighbors.push({ id: s.id, desc: 'is partner of' });
      for (const sib of this.getSiblings(curr)) neighbors.push({ id: sib.id, desc: 'is sibling of' });

      for (const nb of neighbors) {
        if (!visited.has(nb.id)) {
          visited.add(nb.id);
          stepTaken.set(`${curr}->${nb.id}`, nb.desc);
          queue.push([...currentPath, nb.id]);
        }
      }
    }

    return { path: null, description: `No connection found between ${start.name} and ${end.name}` };
  }

  computeLayout() {
    const nodes = Array.from(this.people.values());
    if (nodes.length === 0) return { nodes: [], unions: [] };

    const genMap = new Map();
    const visited = new Set();

    const assignGen = (id, currentGen) => {
      if (currentGen > 50) return;
      const prev = genMap.get(id) ?? -Infinity;
      if (currentGen > prev) {
        genMap.set(id, currentGen);
      }
      if (visited.has(`${id}:${currentGen}`)) return;
      visited.add(`${id}:${currentGen}`);

      for (const pt of this.getPartners(id)) {
        const ptGen = Math.max(genMap.get(pt.id) ?? -Infinity, currentGen);
        genMap.set(pt.id, ptGen);
        genMap.set(id, ptGen);
      }

      for (const ch of this.getChildren(id)) {
        assignGen(ch.id, (genMap.get(id) ?? currentGen) + 1);
      }
    };

    for (const node of nodes) {
      if (this.getParents(node.id).length === 0) {
        assignGen(node.id, 0);
      }
    }
    for (const node of nodes) {
      if (!genMap.has(node.id)) {
        assignGen(node.id, 0);
      }
    }

    const genBuckets = new Map();
    for (const node of nodes) {
      const g = genMap.get(node.id) || 0;
      if (!genBuckets.has(g)) genBuckets.set(g, []);
      genBuckets.get(g).push(node);
    }

    const CARD_WIDTH = 150;
    const CARD_HEIGHT = 56;
    const GAP_X = 60;
    const GAP_Y = 110;

    const positionedNodes = [];
    const nodeCoords = new Map();

    const sortedGens = Array.from(genBuckets.keys()).sort((a, b) => a - b);
    sortedGens.forEach((gen) => {
      const rawRow = genBuckets.get(gen);
      const row = [];
      const placed = new Set();
      for (const person of rawRow) {
        if (placed.has(person.id)) continue;
        row.push(person);
        placed.add(person.id);
        for (const pt of this.getPartners(person.id)) {
          if (!placed.has(pt.id) && rawRow.some(p => p.id === pt.id)) {
            row.push(pt);
            placed.add(pt.id);
          }
        }
      }

      const totalWidth = row.length * CARD_WIDTH + (row.length - 1) * GAP_X;
      const startX = -totalWidth / 2;

      row.forEach((person, idx) => {
        const x = (person.x !== null && person.x !== undefined) ? person.x : (startX + idx * (CARD_WIDTH + GAP_X));
        const y = (person.y !== null && person.y !== undefined) ? person.y : (gen * (CARD_HEIGHT + GAP_Y));
        const pNode = {
          id: person.id,
          name: person.name,
          gen,
          x,
          y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT
        };
        positionedNodes.push(pNode);
        nodeCoords.set(person.id, pNode);
      });
    });

    const renderedUnions = [];
    for (const u of this.unions) {
      const pA = nodeCoords.get(u.partnerA);
      const pB = u.partnerB ? nodeCoords.get(u.partnerB) : null;
      if (!pA) continue;

      let junctionX, junctionY;
      if (pB) {
        const leftP = pA.x < pB.x ? pA : pB;
        const rightP = pA.x < pB.x ? pB : pA;
        junctionX = (leftP.x + leftP.width + rightP.x) / 2;
        junctionY = leftP.y + leftP.height / 2;
      } else {
        junctionX = pA.x + pA.width / 2;
        junctionY = pA.y + pA.height;
      }

      const children = u.children.map(cid => nodeCoords.get(cid)).filter(Boolean);

      renderedUnions.push({
        id: u.id,
        rawUnion: u,
        partnerA: pA,
        partnerB: pB,
        junctionX,
        junctionY,
        children
      });
    }

    return { nodes: positionedNodes, unions: renderedUnions };
  }

  toJSON() {
    return {
      people: Array.from(this.people.values()),
      unions: this.unions
    };
  }

  fromJSON(data) {
    this.people.clear();
    this.unions = [];
    if (data && Array.isArray(data.people)) {
      data.people.forEach(p => this.people.set(p.id, p));
    }
    if (data && Array.isArray(data.unions)) {
      this.unions = data.unions;
    }
  }
}

// -------------------------------------------------------------
// Interactive UI & SVG Controller
// -------------------------------------------------------------

const tree = new FamilyTree();

// Viewport Transform
let panX = (window.innerWidth || 800) / 2;
let panY = 120;
let zoom = 1;
let isPanning = false;
let startPan = { x: 0, y: 0 };

// Dragging Node state
let draggingNodeId = null;
let dragStartMouse = { x: 0, y: 0 };
let dragStartNodePos = { x: 0, y: 0 };
let hasDragged = false;

// Selection & Kinship Highlight
let selectedNodeId = null;
let highlightedPathNodes = new Set();

// Connect Dragging State (drag from connector handle)
let connectingFromNodeId = null;

// DOM Elements
const viewport = document.getElementById('viewport');
const transformLayer = document.getElementById('transformLayer');
const edgesLayer = document.getElementById('edgesLayer');
const nodesLayer = document.getElementById('nodesLayer');
const treeStats = document.getElementById('treeStats');
const nodeActionsBar = document.getElementById('nodeActionsBar');

// CLI Elements
const cliDrawer = document.getElementById('cliDrawer');
const cliBtn = document.getElementById('cliBtn');
const cliCloseBtn = document.getElementById('cliCloseBtn');
const cliInput = document.getElementById('cliInput');
const cliOutput = document.getElementById('cliOutput');

// Modals
const modalPerson = document.getElementById('modalPerson');
const modalRelation = document.getElementById('modalRelation');
const modalKinship = document.getElementById('modalKinship');
const personNameInput = document.getElementById('personNameInput');
const relPersonA = document.getElementById('relPersonA');
const relPersonB = document.getElementById('relPersonB');
const relTypeSelect = document.getElementById('relTypeSelect');
const kinPersonA = document.getElementById('kinPersonA');
const kinPersonB = document.getElementById('kinPersonB');
const kinResult = document.getElementById('kinResult');

const commandHistory = [];
let historyIndex = -1;

function saveLocal() {
  try {
    localStorage.setItem('bare_family_tree_data', JSON.stringify(tree.toJSON()));
  } catch (e) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem('bare_family_tree_data');
    if (raw) {
      tree.fromJSON(JSON.parse(raw));
      return true;
    }
  } catch (e) {}
  return false;
}

function applyTransform() {
  transformLayer.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);
  updateActionsBarPosition();
}

function updateStats() {
  treeStats.textContent = `${tree.people.size} people · ${tree.unions.length} unions`;
}

function updateActionsBarPosition() {
  if (!selectedNodeId) {
    nodeActionsBar.style.display = 'none';
    return;
  }
  const { nodes } = tree.computeLayout();
  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) {
    nodeActionsBar.style.display = 'none';
    return;
  }
  const screenX = panX + (node.x + node.width / 2) * zoom;
  const screenY = panY + (node.y + node.height + 12) * zoom;
  nodeActionsBar.style.display = 'flex';
  nodeActionsBar.style.left = `${screenX}px`;
  nodeActionsBar.style.top = `${screenY}px`;
  const nameEl = document.getElementById('actionPersonName');
  if (nameEl) nameEl.textContent = node.name;
}

// -------------------------------------------------------------
// SVG Render: Union-based Marriage lines & Child branch bus bars
// -------------------------------------------------------------

function render() {
  updateStats();
  saveLocal();
  const { nodes, unions } = tree.computeLayout();

  edgesLayer.innerHTML = '';
  nodesLayer.innerHTML = '';

  // Render Unions and Child Branches
  unions.forEach((u) => {
    // 1. If two partners, draw marriage line between them
    if (u.partnerB) {
      const leftP = u.partnerA.x < u.partnerB.x ? u.partnerA : u.partnerB;
      const rightP = u.partnerA.x < u.partnerB.x ? u.partnerB : u.partnerA;
      const p1x = leftP.x + leftP.width;
      const p1y = leftP.y + leftP.height / 2;
      const p2x = rightP.x;
      const p2y = rightP.y + rightP.height / 2;

      const partnerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      partnerLine.setAttribute('x1', p1x);
      partnerLine.setAttribute('y1', p1y);
      partnerLine.setAttribute('x2', p2x);
      partnerLine.setAttribute('y2', p2y);
      partnerLine.setAttribute('class', 'edge-spouse');
      edgesLayer.appendChild(partnerLine);
    }

    // 2. Draw union junction dot
    const junctionCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    junctionCircle.setAttribute('cx', u.junctionX);
    junctionCircle.setAttribute('cy', u.junctionY);
    junctionCircle.setAttribute('r', '5');
    junctionCircle.setAttribute('class', 'union-junction');
    junctionCircle.setAttribute('title', 'Union Junction - Click to add child');
    junctionCircle.addEventListener('click', (e) => {
      e.stopPropagation();
      const childName = prompt(`Add Child to ${u.partnerA.name}${u.partnerB ? ' & ' + u.partnerB.name : ''}:`);
      if (childName && childName.trim()) {
        tree.addChild(u.partnerA.name, childName.trim(), u.partnerB ? u.partnerB.name : null);
        render();
      }
    });
    edgesLayer.appendChild(junctionCircle);

    // 3. Draw branch down to children from union junction
    if (u.children.length > 0) {
      const stemDrop = 35;
      const busY = u.junctionY + stemDrop;

      // Vertical stem from junction to bus bar
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1', u.junctionX);
      stem.setAttribute('y1', u.junctionY);
      stem.setAttribute('x2', u.junctionX);
      stem.setAttribute('y2', busY);
      stem.setAttribute('class', 'edge-parent');
      edgesLayer.appendChild(stem);

      // Horizontal bus bar across children
      const childCenterXs = u.children.map(c => c.x + c.width / 2);
      const minChildX = Math.min(u.junctionX, ...childCenterXs);
      const maxChildX = Math.max(u.junctionX, ...childCenterXs);

      if (u.children.length > 1 || minChildX !== maxChildX) {
        const busBar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        busBar.setAttribute('x1', minChildX);
        busBar.setAttribute('y1', busY);
        busBar.setAttribute('x2', maxChildX);
        busBar.setAttribute('y2', busY);
        busBar.setAttribute('class', 'edge-parent');
        edgesLayer.appendChild(busBar);
      }

      // Vertical drop line from bus bar into top of each child
      u.children.forEach((child) => {
        const childCenterX = child.x + child.width / 2;
        const dropLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        dropLine.setAttribute('x1', childCenterX);
        dropLine.setAttribute('y1', busY);
        dropLine.setAttribute('x2', childCenterX);
        dropLine.setAttribute('y2', child.y);
        const isPath = highlightedPathNodes.has(child.id) &&
                       (highlightedPathNodes.has(u.partnerA.id) || (u.partnerB && highlightedPathNodes.has(u.partnerB.id)));
        dropLine.setAttribute('class', `edge-parent ${isPath ? 'highlighted' : ''}`);
        dropLine.setAttribute('marker-end', 'url(#arrow)');
        edgesLayer.appendChild(dropLine);
      });
    }
  });

  // Render Nodes
  nodes.forEach((node) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const isSelected = selectedNodeId === node.id;
    const isHighlighted = highlightedPathNodes.has(node.id);

    let cls = 'node-group';
    if (isSelected) cls += ' selected';
    if (isHighlighted) cls += ' path-highlight';
    g.setAttribute('class', cls);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    // Card background rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'node-card');
    rect.setAttribute('width', node.width);
    rect.setAttribute('height', node.height);

    // Text Label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'node-text');
    text.setAttribute('x', node.width / 2);
    text.setAttribute('y', node.height / 2);
    text.textContent = node.name;

    // Connector drag handle (bottom circle)
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', node.width / 2);
    handle.setAttribute('cy', node.height);
    handle.setAttribute('r', '6');
    handle.setAttribute('class', 'node-handle');
    handle.setAttribute('title', 'Drag to connect to another person');

    g.appendChild(rect);
    g.appendChild(text);
    g.appendChild(handle);

    // Node drag & drop events
    g.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      hasDragged = false;
      draggingNodeId = node.id;
      dragStartMouse = { x: e.clientX, y: e.clientY };
      dragStartNodePos = { x: node.x, y: node.y };
    });

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasDragged) return; // Ignore click if user was dragging
      selectedNodeId = selectedNodeId === node.id ? null : node.id;
      render();
    });

    nodesLayer.appendChild(g);
  });

  updateActionsBarPosition();
}

// -------------------------------------------------------------
// Mouse Drag & Drop Handlers (Canvas Pan + Node Dragging)
// -------------------------------------------------------------

viewport.addEventListener('mousedown', (e) => {
  if (e.target.closest('.node-group') || e.target.closest('.union-junction')) return;
  isPanning = true;
  startPan = { x: e.clientX - panX, y: e.clientY - panY };
  selectedNodeId = null;
  nodeActionsBar.style.display = 'none';
  render();
});

window.addEventListener('mousemove', (e) => {
  if (draggingNodeId) {
    const dx = (e.clientX - dragStartMouse.x) / zoom;
    const dy = (e.clientY - dragStartMouse.y) / zoom;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasDragged = true;
    }
    const person = tree.getPersonById(draggingNodeId);
    if (person) {
      person.x = dragStartNodePos.x + dx;
      person.y = dragStartNodePos.y + dy;
      render();
    }
    return;
  }

  if (isPanning) {
    panX = e.clientX - startPan.x;
    panY = e.clientY - startPan.y;
    applyTransform();
  }
});

window.addEventListener('mouseup', () => {
  if (draggingNodeId) {
    draggingNodeId = null;
    saveLocal();
  }
  isPanning = false;
});

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  zoom = Math.min(Math.max(zoom * zoomFactor, 0.3), 3);
  applyTransform();
}, { passive: false });

// Double-click canvas to create new person
viewport.addEventListener('dblclick', (e) => {
  if (e.target.closest('.node-group')) return;
  const name = prompt('New Person Name:');
  if (name && name.trim()) {
    try {
      const clickX = (e.clientX - panX) / zoom - 75;
      const clickY = (e.clientY - panY) / zoom - 28;
      tree.addPerson(name.trim(), clickX, clickY);
      render();
    } catch (err) {
      alert(err.message);
    }
  }
});

// -------------------------------------------------------------
// Card Action Buttons
// -------------------------------------------------------------

document.getElementById('actionAddChild')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  const childName = prompt(`Add Child of ${p.name}:`);
  if (childName && childName.trim()) {
    try {
      tree.addChild(p.name, childName.trim());
      render();
    } catch (err) {
      alert(err.message);
    }
  }
});

document.getElementById('actionAddSpouse')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  const partnerName = prompt(`Add Partner / Spouse of ${p.name}:`);
  if (partnerName && partnerName.trim()) {
    try {
      const partner = tree.addPerson(partnerName.trim(), (p.x || 0) + 210, p.y || 0);
      tree.getOrCreateUnion(p.name, partner.name);
      render();
    } catch (err) {
      alert(err.message);
    }
  }
});

document.getElementById('actionAddParent')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  const parentName = prompt(`Add Parent of ${p.name}:`);
  if (parentName && parentName.trim()) {
    try {
      const parent = tree.addPerson(parentName.trim(), p.x || 0, (p.y || 110) - 110);
      tree.addChild(parent.name, p.name);
      render();
    } catch (err) {
      alert(err.message);
    }
  }
});

document.getElementById('actionDelete')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  if (confirm(`Delete ${p.name}?`)) {
    tree.deletePerson(p.id);
    selectedNodeId = null;
    nodeActionsBar.style.display = 'none';
    render();
  }
});

// Auto-layout / Reset Layout button
document.getElementById('btnAutoLayout')?.addEventListener('click', () => {
  for (const p of tree.people.values()) {
    p.x = null;
    p.y = null;
  }
  render();
});

// -------------------------------------------------------------
// CLI Terminal Controller (Hotkey 'E')
// -------------------------------------------------------------

function toggleCli(force) {
  const isOpen = cliDrawer.classList.toggle('open', force);
  if (isOpen) {
    cliInput.focus();
  }
}

function printCli(text, type = 'res') {
  const line = document.createElement('div');
  line.className = `cli-log-${type}`;
  line.textContent = text;
  cliOutput.appendChild(line);
  cliOutput.scrollTop = cliOutput.scrollHeight;
}

function runCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;

  printCli(`> ${cmd}`, 'cmd');
  commandHistory.push(cmd);
  historyIndex = commandHistory.length;

  const args = (cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map(s => s.replace(/^"|"$/g, ''));
  const action = (args[0] || '').toLowerCase();

  switch (action) {
    case 'help':
      printCli('Union-Based Family Tree Commands:', 'help');
      printCli('  add <name>                          - Add person (e.g. add Alice)', 'help');
      printCli('  partner <p1> <p2>                   - Create union between 2 partners', 'help');
      printCli('  child <parent1> [parent2] <child>   - Add child born from union', 'help');
      printCli('  find <p1> <p2>                      - Find kinship path between 2 people', 'help');
      printCli('  delete <name>                       - Delete person', 'help');
      printCli('  list                                - Print people, unions, & siblings', 'help');
      printCli('  sample                              - Load Mom + Dad + egg + egg2 sample', 'help');
      printCli('  clear                               - Clear terminal logs', 'help');
      printCli('  reset                               - Clear entire tree', 'help');
      printCli('  exit                                - Close CLI drawer', 'help');
      break;

    case 'add':
      if (args.length < 2) return printCli('Usage: add <person-name>', 'err');
      try {
        const name = args.slice(1).join(' ');
        tree.addPerson(name);
        printCli(`Added person "${name}"`, 'success');
        render();
      } catch (err) {
        printCli(err.message, 'err');
      }
      break;

    case 'partner':
    case 'spouse':
    case 'union':
      if (args.length < 3) return printCli('Usage: partner <person1> <person2>', 'err');
      try {
        tree.getOrCreateUnion(args[1], args[2]);
        printCli(`Created union between ${args[1]} and ${args[2]}`, 'success');
        render();
      } catch (err) {
        printCli(err.message, 'err');
      }
      break;

    case 'child':
      if (args.length < 3) return printCli('Usage: child <parent1> [parent2] <childName>', 'err');
      try {
        if (args.length === 3) {
          tree.addChild(args[1], args[2]);
          printCli(`Added child "${args[2]}" to ${args[1]}`, 'success');
        } else {
          tree.addChild(args[1], args[3], args[2]);
          printCli(`Added child "${args[3]}" to union of ${args[1]} & ${args[2]}`, 'success');
        }
        render();
      } catch (err) {
        printCli(err.message, 'err');
      }
      break;

    case 'find':
      if (args.length < 3) return printCli('Usage: find <person1> <person2>', 'err');
      const res = tree.findPath(args[1], args[2]);
      if (res.error) {
        printCli(res.error, 'err');
      } else {
        printCli(`Kinship Path: ${res.description}`, 'success');
        if (res.nodeIds) {
          highlightedPathNodes = new Set(res.nodeIds);
          render();
        }
      }
      break;

    case 'list':
      printCli(`People (${tree.people.size}):`, 'res');
      for (const p of tree.people.values()) {
        const parents = tree.getParents(p.id).map(x => x.name).join(' & ') || 'none';
        const partners = tree.getPartners(p.id).map(x => x.name).join(', ') || 'none';
        const kids = tree.getChildren(p.id).map(x => x.name).join(', ') || 'none';
        const sibs = tree.getSiblings(p.id).map(x => x.name).join(', ') || 'none';
        printCli(` • ${p.name} | Parents: [${parents}] | Partner: [${partners}] | Children: [${kids}] | Siblings: [${sibs}]`, 'res');
      }
      break;

    case 'delete':
    case 'rm':
      if (args.length < 2) return printCli('Usage: delete <person-name>', 'err');
      const delName = args.slice(1).join(' ');
      if (tree.deletePerson(delName)) {
        printCli(`Deleted person "${delName}"`, 'success');
        render();
      } else {
        printCli(`Person "${delName}" not found`, 'err');
      }
      break;

    case 'sample':
      loadSampleTree();
      printCli('Sample tree loaded (Mom + Dad -> egg, egg2)', 'success');
      break;

    case 'clear':
      cliOutput.innerHTML = '';
      break;

    case 'reset':
      tree.fromJSON({ people: [], unions: [] });
      highlightedPathNodes.clear();
      printCli('Tree reset', 'success');
      render();
      break;

    case 'exit':
      toggleCli(false);
      break;

    default:
      printCli(`Unknown command "${action}". Type "help" for command list.`, 'err');
  }
}

// CLI Keyboard Handlers
cliInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runCommand(cliInput.value);
    cliInput.value = '';
  } else if (e.key === 'ArrowUp') {
    if (historyIndex > 0) {
      historyIndex--;
      cliInput.value = commandHistory[historyIndex] || '';
    }
  } else if (e.key === 'ArrowDown') {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      cliInput.value = commandHistory[historyIndex] || '';
    } else {
      historyIndex = commandHistory.length;
      cliInput.value = '';
    }
  } else if (e.key === 'Escape') {
    toggleCli(false);
  }
});

// Global Keyboard Handler (Hotkey 'E' and Esc)
window.addEventListener('keydown', (e) => {
  const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    toggleCli(false);
    modalPerson.classList.remove('active');
    modalRelation.classList.remove('active');
    modalKinship.classList.remove('active');
    selectedNodeId = null;
    render();
  } else if ((e.key === 'e' || e.key === 'E') && !isInput) {
    e.preventDefault();
    toggleCli();
  }
});

cliBtn.addEventListener('click', () => toggleCli(true));
cliCloseBtn.addEventListener('click', () => toggleCli(false));

// Header Buttons
document.getElementById('btnNewPerson').addEventListener('click', () => {
  personNameInput.value = '';
  modalPerson.classList.add('active');
  personNameInput.focus();
});

document.getElementById('cancelPersonModal').addEventListener('click', () => {
  modalPerson.classList.remove('active');
});

document.getElementById('savePersonModal').addEventListener('click', () => {
  const name = personNameInput.value.trim();
  if (name) {
    try {
      tree.addPerson(name);
      render();
      modalPerson.classList.remove('active');
    } catch (err) {
      alert(err.message);
    }
  }
});

// Relation Modal (Union / Child)
document.getElementById('btnNewRelation').addEventListener('click', () => {
  relPersonA.value = '';
  relPersonB.value = '';
  modalRelation.classList.add('active');
  relPersonA.focus();
});

document.getElementById('cancelRelModal').addEventListener('click', () => {
  modalRelation.classList.remove('active');
});

document.getElementById('saveRelModal').addEventListener('click', () => {
  const a = relPersonA.value.trim();
  const b = relPersonB.value.trim();
  const type = relTypeSelect.value;
  if (!a || !b) return;

  try {
    if (type === 'partner') {
      tree.getOrCreateUnion(a, b);
    } else if (type === 'parent') {
      // a is parent of b
      tree.addChild(a, b);
    } else if (type === 'child') {
      // a is child of b
      tree.addChild(b, a);
    }
    render();
    modalRelation.classList.remove('active');
  } catch (err) {
    alert(err.message);
  }
});

// Find Kinship Modal
document.getElementById('btnFindKin').addEventListener('click', () => {
  const people = Array.from(tree.people.values()).map(p => p.name).sort();
  const listA = document.getElementById('peopleDataList');
  if (listA) {
    listA.innerHTML = people.map(p => `<option value="${p}">`).join('');
  }
  kinPersonA.value = '';
  kinPersonB.value = '';
  kinResult.textContent = '';
  modalKinship.classList.add('active');
  kinPersonA.focus();
});

document.getElementById('cancelKinModal').addEventListener('click', () => {
  modalKinship.classList.remove('active');
});

document.getElementById('calcKinModal').addEventListener('click', () => {
  const a = kinPersonA.value.trim();
  const b = kinPersonB.value.trim();
  if (!a || !b) return;
  const res = tree.findPath(a, b);
  if (res.error) {
    kinResult.style.color = '#f85149';
    kinResult.textContent = res.error;
  } else {
    kinResult.style.color = '#3fb950';
    kinResult.textContent = res.description;
    if (res.nodeIds) {
      highlightedPathNodes = new Set(res.nodeIds);
      render();
    }
  }
});

// Sample Tree matching Screenshot 1: Mom + Dad -> egg, egg2
function loadSampleTree() {
  tree.fromJSON({ people: [], unions: [] });
  highlightedPathNodes.clear();

  // 1. Mom & Dad form a union
  tree.getOrCreateUnion('mom', 'dad');

  // 2. Children born from the union of Mom & Dad
  tree.addChild('mom', 'egg', 'dad');
  tree.addChild('mom', 'egg2', 'dad');

  render();
}

document.getElementById('btnSample').addEventListener('click', () => {
  loadSampleTree();
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('Clear entire family tree?')) {
    tree.fromJSON({ people: [], unions: [] });
    highlightedPathNodes.clear();
    selectedNodeId = null;
    nodeActionsBar.style.display = 'none';
    render();
  }
});

// CLI Quick chips
document.querySelectorAll('.cli-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    cliInput.value = chip.getAttribute('data-cmd') || '';
    cliInput.focus();
  });
});

// Initial load
if (!loadLocal() || tree.people.size === 0) {
  loadSampleTree();
} else {
  render();
}
applyTransform();
