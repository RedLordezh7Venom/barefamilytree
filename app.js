// Bare Family Tree - Self-Contained App (No CORS / Works natively via file:// and http://)

class FamilyTree {
  constructor() {
    this.people = new Map(); // id -> { id, name }
    this.relations = []; // { from, to, type }
  }

  _norm(name) {
    return (name || '').trim();
  }

  getPerson(name) {
    const norm = this._norm(name).toLowerCase();
    for (const p of this.people.values()) {
      if (p.name.toLowerCase() === norm) return p;
    }
    return null;
  }

  getPersonById(id) {
    return this.people.get(id) || null;
  }

  addPerson(name) {
    const clean = this._norm(name);
    if (!clean) throw new Error('Person name cannot be empty');
    const existing = this.getPerson(clean);
    if (existing) return existing;

    const id = 'p_' + Math.random().toString(36).substring(2, 9);
    const person = { id, name: clean };
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
    this.relations = this.relations.filter(r => r.from !== p.id && r.to !== p.id);
    return true;
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

  _addDirectedEdge(fromId, toId, type) {
    if (type === 'parent' && this.isAncestor(toId, fromId)) {
      throw new Error('Cannot add relation: would create an ancestral loop/cycle');
    }
    const exists = this.relations.some(r => r.from === fromId && r.to === toId && r.type === type);
    if (!exists) {
      this.relations.push({ from: fromId, to: toId, type });
    }
  }

  _addSpouseEdge(id1, id2) {
    const exists = this.relations.some(
      r => r.type === 'spouse' && ((r.from === id1 && r.to === id2) || (r.from === id2 && r.to === id1))
    );
    if (!exists) {
      this.relations.push({ from: id1, to: id2, type: 'spouse' });
    }
  }

  addRelation(nameA, relType, nameB) {
    const a = this.getOrCreate(nameA);
    const b = this.getOrCreate(nameB);
    if (a.id === b.id) throw new Error('Cannot relate a person to themselves');

    const type = relType.toLowerCase().trim();

    if (type === 'parent') {
      this._addDirectedEdge(a.id, b.id, 'parent');
    } else if (type === 'child') {
      this._addDirectedEdge(b.id, a.id, 'parent');
    } else if (type === 'spouse' || type === 'partner') {
      this._addSpouseEdge(a.id, b.id);
    } else if (type === 'sibling') {
      const parentsB = this.getParents(b.id);
      if (parentsB.length > 0) {
        parentsB.forEach(p => this._addDirectedEdge(p.id, a.id, 'parent'));
      } else {
        const parentsA = this.getParents(a.id);
        if (parentsA.length > 0) {
          parentsA.forEach(p => this._addDirectedEdge(p.id, b.id, 'parent'));
        } else {
          const sharedParent = this.addPerson(`${a.name} & ${b.name}'s Parent`);
          this._addDirectedEdge(sharedParent.id, a.id, 'parent');
          this._addDirectedEdge(sharedParent.id, b.id, 'parent');
        }
      }
    } else {
      throw new Error(`Unknown relation type "${relType}". Use: parent, child, spouse, or sibling.`);
    }

    return { a, type, b };
  }

  getParents(personId) {
    return this.relations
      .filter(r => r.to === personId && r.type === 'parent')
      .map(r => this.people.get(r.from))
      .filter(Boolean);
  }

  getChildren(personId) {
    return this.relations
      .filter(r => r.from === personId && r.type === 'parent')
      .map(r => this.people.get(r.to))
      .filter(Boolean);
  }

  getSpouses(personId) {
    return this.relations
      .filter(r => r.type === 'spouse' && (r.from === personId || r.to === personId))
      .map(r => this.people.get(r.from === personId ? r.to : r.from))
      .filter(Boolean);
  }

  findPath(nameA, nameB) {
    const start = this.getPerson(nameA);
    const end = this.getPerson(nameB);
    if (!start) return { error: `Person "${nameA}" not found` };
    if (!end) return { error: `Person "${nameB}" not found` };
    if (start.id === end.id) return { path: [start.name], nodeIds: [start.id], description: 'Same person' };

    const queue = [[start.id]];
    const visited = new Set([start.id]);
    const edgeTaken = new Map();

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
          const relDesc = edgeTaken.get(`${u}->${v}`);
          textSteps.push(`${uName} ${relDesc} ${vName}`);
        }
        return {
          path: currentPath.map(id => this.people.get(id).name),
          nodeIds: currentPath,
          steps: textSteps,
          description: textSteps.join(' ➔ ')
        };
      }

      const neighbors = [];
      for (const p of this.getParents(curr)) neighbors.push({ id: p.id, desc: 'is child of' });
      for (const c of this.getChildren(curr)) neighbors.push({ id: c.id, desc: 'is parent of' });
      for (const s of this.getSpouses(curr)) neighbors.push({ id: s.id, desc: 'is spouse of' });

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          edgeTaken.set(`${curr}->${neighbor.id}`, neighbor.desc);
          queue.push([...currentPath, neighbor.id]);
        }
      }
    }

    return { path: null, description: `No connection found between ${start.name} and ${end.name}` };
  }

  computeLayout() {
    const nodes = Array.from(this.people.values());
    if (nodes.length === 0) return { nodes: [], edges: [] };

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

      for (const sp of this.getSpouses(id)) {
        const spGen = Math.max(genMap.get(sp.id) ?? -Infinity, currentGen);
        genMap.set(sp.id, spGen);
        genMap.set(id, spGen);
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

    const CARD_WIDTH = 140;
    const CARD_HEIGHT = 50;
    const GAP_X = 50;
    const GAP_Y = 85;

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
        for (const sp of this.getSpouses(person.id)) {
          if (!placed.has(sp.id) && rawRow.some(p => p.id === sp.id)) {
            row.push(sp);
            placed.add(sp.id);
          }
        }
      }

      const totalWidth = row.length * CARD_WIDTH + (row.length - 1) * GAP_X;
      const startX = -totalWidth / 2;

      row.forEach((person, idx) => {
        const x = startX + idx * (CARD_WIDTH + GAP_X);
        const y = gen * (CARD_HEIGHT + GAP_Y);
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

    const positionedEdges = [];
    for (const rel of this.relations) {
      const from = nodeCoords.get(rel.from);
      const to = nodeCoords.get(rel.to);
      if (from && to) {
        positionedEdges.push({ type: rel.type, from, to });
      }
    }

    return { nodes: positionedNodes, edges: positionedEdges };
  }

  toJSON() {
    return {
      people: Array.from(this.people.values()),
      relations: this.relations
    };
  }

  fromJSON(data) {
    this.people.clear();
    this.relations = [];
    if (data && Array.isArray(data.people)) {
      data.people.forEach(p => this.people.set(p.id, p));
    }
    if (data && Array.isArray(data.relations)) {
      this.relations = data.relations;
    }
  }
}

// -------------------------------------------------------------
// UI & Visual Controller
// -------------------------------------------------------------

const tree = new FamilyTree();

// Pan & Zoom
let panX = (window.innerWidth || 800) / 2;
let panY = 100;
let zoom = 1;
let isPanning = false;
let startPan = { x: 0, y: 0 };

// Selection & Connection State
let selectedNodeId = null;
let connectSourceId = null; // When in 'Connect to...' mode
let highlightedPathNodes = new Set();

// DOM elements
const viewport = document.getElementById('viewport');
const transformLayer = document.getElementById('transformLayer');
const edgesLayer = document.getElementById('edgesLayer');
const nodesLayer = document.getElementById('nodesLayer');
const treeStats = document.getElementById('treeStats');
const nodeActionsBar = document.getElementById('nodeActionsBar');
const connectBanner = document.getElementById('connectBanner');

// CLI elements
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

// Storage
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
  treeStats.textContent = `${tree.people.size} people · ${tree.relations.length} relations`;
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
  const screenY = panY + (node.y + node.height + 10) * zoom;
  nodeActionsBar.style.display = 'flex';
  nodeActionsBar.style.left = `${screenX}px`;
  nodeActionsBar.style.top = `${screenY}px`;
  const nameEl = document.getElementById('actionPersonName');
  if (nameEl) nameEl.textContent = node.name;
}

function render() {
  updateStats();
  saveLocal();
  const { nodes, edges } = tree.computeLayout();

  edgesLayer.innerHTML = '';
  nodesLayer.innerHTML = '';

  // Draw Edges
  edges.forEach((edge) => {
    const x1 = edge.from.x + edge.from.width / 2;
    const y1 = edge.from.y + edge.from.height;
    const x2 = edge.to.x + edge.to.width / 2;
    const y2 = edge.to.y;

    if (edge.type === 'parent') {
      const midY = (y1 + y2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      const isPath = highlightedPathNodes.has(edge.from.id) && highlightedPathNodes.has(edge.to.id);
      path.setAttribute('class', `edge-parent ${isPath ? 'highlighted' : ''}`);
      path.setAttribute('marker-end', 'url(#arrow)');
      edgesLayer.appendChild(path);
    } else if (edge.type === 'spouse') {
      const spY = edge.from.y + edge.from.height / 2;
      const spX1 = edge.from.x < edge.to.x ? edge.from.x + edge.from.width : edge.from.x;
      const spX2 = edge.from.x < edge.to.x ? edge.to.x : edge.to.x + edge.to.width;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${spX1} ${spY} L ${spX2} ${spY}`);
      const isPath = highlightedPathNodes.has(edge.from.id) && highlightedPathNodes.has(edge.to.id);
      path.setAttribute('class', `edge-spouse ${isPath ? 'highlighted' : ''}`);
      edgesLayer.appendChild(path);
    }
  });

  // Draw Nodes
  nodes.forEach((node) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const isSelected = selectedNodeId === node.id;
    const isConnectSource = connectSourceId === node.id;
    const isHighlighted = highlightedPathNodes.has(node.id);

    let cls = 'node-group';
    if (isSelected) cls += ' selected';
    if (isConnectSource) cls += ' connect-source';
    if (isHighlighted) cls += ' path-highlight';
    g.setAttribute('class', cls);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'node-card');
    rect.setAttribute('width', node.width);
    rect.setAttribute('height', node.height);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'node-text');
    text.setAttribute('x', node.width / 2);
    text.setAttribute('y', node.height / 2);
    text.textContent = node.name;

    g.appendChild(rect);
    g.appendChild(text);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      handleNodeClick(node);
    });

    nodesLayer.appendChild(g);
  });

  updateActionsBarPosition();
}

function handleNodeClick(node) {
  if (connectSourceId) {
    if (connectSourceId === node.id) {
      // Deselect connect mode
      connectSourceId = null;
      connectBanner.style.display = 'none';
      render();
      return;
    }
    // Connect source to clicked node
    const srcPerson = tree.getPersonById(connectSourceId);
    connectSourceId = null;
    connectBanner.style.display = 'none';
    if (srcPerson) {
      openRelationModal(srcPerson.name, node.name);
    }
    return;
  }

  // Normal node selection toggle
  selectedNodeId = selectedNodeId === node.id ? null : node.id;
  render();
}

// Canvas Pan & Zoom
viewport.addEventListener('mousedown', (e) => {
  if (e.target.closest('.node-group')) return;
  isPanning = true;
  startPan = { x: e.clientX - panX, y: e.clientY - panY };
  // clicking canvas background clears selection
  selectedNodeId = null;
  nodeActionsBar.style.display = 'none';
  render();
});

window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  panX = e.clientX - startPan.x;
  panY = e.clientY - startPan.y;
  applyTransform();
});

window.addEventListener('mouseup', () => {
  isPanning = false;
});

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  zoom = Math.min(Math.max(zoom * zoomFactor, 0.3), 3);
  applyTransform();
}, { passive: false });

// Double click canvas to add person
viewport.addEventListener('dblclick', (e) => {
  if (e.target.closest('.node-group')) return;
  const name = prompt('New Person Name:');
  if (name && name.trim()) {
    try {
      tree.addPerson(name.trim());
      render();
    } catch (err) {
      alert(err.message);
    }
  }
});

// Card Action Toolbar Handlers
document.getElementById('actionAddChild')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  const childName = prompt(`Add Child of ${p.name}:`);
  if (childName && childName.trim()) {
    try {
      tree.addRelation(p.name, 'parent', childName.trim());
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
      tree.addRelation(parentName.trim(), 'parent', p.name);
      render();
    } catch (err) {
      alert(err.message);
    }
  }
});

document.getElementById('actionAddSpouse')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  const spouseName = prompt(`Add Spouse/Partner of ${p.name}:`);
  if (spouseName && spouseName.trim()) {
    try {
      tree.addRelation(p.name, 'spouse', spouseName.trim());
      render();
    } catch (err) {
      alert(err.message);
    }
  }
});

document.getElementById('actionConnect')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  connectSourceId = p.id;
  selectedNodeId = null;
  nodeActionsBar.style.display = 'none';
  connectBanner.style.display = 'flex';
  document.getElementById('connectSourceText').textContent = p.name;
  render();
});

document.getElementById('cancelConnectBtn')?.addEventListener('click', () => {
  connectSourceId = null;
  connectBanner.style.display = 'none';
  render();
});

document.getElementById('actionDelete')?.addEventListener('click', () => {
  const p = tree.getPersonById(selectedNodeId);
  if (!p) return;
  if (confirm(`Delete ${p.name} and their relations?`)) {
    tree.deletePerson(p.id);
    selectedNodeId = null;
    nodeActionsBar.style.display = 'none';
    render();
  }
});

// CLI Logic
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
      printCli('Available Commands:', 'help');
      printCli('  add <name>                          - Add person (e.g. add Alice)', 'help');
      printCli('  rel <p1> <type> <p2>                - Add relation (types: parent, child, spouse, sibling)', 'help');
      printCli('  join <p1> <type> <p2>               - Connect disjoint trees or people', 'help');
      printCli('  find <p1> <p2>                      - Trace kinship path between 2 people', 'help');
      printCli('  delete <name>                       - Delete person & relations', 'help');
      printCli('  list                                - Print people & connections', 'help');
      printCli('  sample                              - Load sample family tree', 'help');
      printCli('  clear                               - Clear terminal logs', 'help');
      printCli('  reset                               - Clear whole tree', 'help');
      printCli('  exit                                - Close CLI drawer', 'help');
      break;

    case 'add':
      if (args.length < 2) return printCli('Usage: add <person-name>', 'err');
      const name = args.slice(1).join(' ');
      try {
        tree.addPerson(name);
        printCli(`Added person "${name}"`, 'success');
        render();
      } catch (err) {
        printCli(err.message, 'err');
      }
      break;

    case 'rel':
    case 'relate':
    case 'join':
    case 'connect': {
      const relKeywords = ['parent', 'child', 'spouse', 'partner', 'sibling'];
      let p1 = args[1];
      let rType = args[2];
      let p2 = args[3];

      const kwIdx = args.findIndex((t, i) => i >= 2 && relKeywords.includes(t.toLowerCase()));
      if (kwIdx !== -1 && kwIdx < args.length - 1) {
        p1 = args.slice(1, kwIdx).join(' ');
        rType = args[kwIdx];
        p2 = args.slice(kwIdx + 1).join(' ');
      }

      if (!p1 || !rType || !p2) {
        return printCli('Usage: rel <person1> <parent|child|spouse|sibling> <person2>', 'err');
      }

      try {
        tree.addRelation(p1, rType, p2);
        printCli(`Connected ${p1} [${rType}] ${p2}`, 'success');
        render();
      } catch (err) {
        printCli(err.message, 'err');
      }
      break;
    }

    case 'find': {
      let p1 = args[1];
      let p2 = args[2];
      if (args.length > 3) {
        const splitIdx = args.findIndex((t, i) => i >= 2 && ['and', 'to'].includes(t.toLowerCase()));
        if (splitIdx !== -1 && splitIdx < args.length - 1) {
          p1 = args.slice(1, splitIdx).join(' ');
          p2 = args.slice(splitIdx + 1).join(' ');
        } else {
          return printCli('Usage: find "Person 1" "Person 2"', 'err');
        }
      }
      if (!p1 || !p2) return printCli('Usage: find <person1> <person2>', 'err');
      const res = tree.findPath(p1, p2);
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
    }

    case 'list':
      printCli(`People (${tree.people.size}):`, 'res');
      for (const p of tree.people.values()) {
        const parents = tree.getParents(p.id).map(x => x.name).join(', ') || 'none';
        const spouses = tree.getSpouses(p.id).map(x => x.name).join(', ') || 'none';
        const kids = tree.getChildren(p.id).map(x => x.name).join(', ') || 'none';
        printCli(` • ${p.name} | Parents: ${parents} | Spouse: ${spouses} | Children: ${kids}`, 'res');
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
      printCli('Sample family tree loaded', 'success');
      break;

    case 'clear':
      cliOutput.innerHTML = '';
      break;

    case 'reset':
      tree.fromJSON({ people: [], relations: [] });
      highlightedPathNodes.clear();
      printCli('Tree reset', 'success');
      render();
      break;

    case 'exit':
      toggleCli(false);
      break;

    default:
      printCli(`Unknown command: "${action}". Type "help" for command list.`, 'err');
  }
}

// CLI shortcuts
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

// Global Keyboard Listener
window.addEventListener('keydown', (e) => {
  const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    toggleCli(false);
    modalPerson.classList.remove('active');
    modalRelation.classList.remove('active');
    modalKinship.classList.remove('active');
    connectSourceId = null;
    connectBanner.style.display = 'none';
    selectedNodeId = null;
    render();
  } else if ((e.key === 'e' || e.key === 'E') && !isInput) {
    e.preventDefault();
    toggleCli();
  }
});

cliBtn.addEventListener('click', () => toggleCli(true));
cliCloseBtn.addEventListener('click', () => toggleCli(false));

// Modal Helper
function openRelationModal(p1 = '', p2 = '') {
  relPersonA.value = p1;
  relPersonB.value = p2;
  modalRelation.classList.add('active');
  if (!p1) relPersonA.focus();
  else if (!p2) relPersonB.focus();
}

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

document.getElementById('btnNewRelation').addEventListener('click', () => {
  openRelationModal();
});

document.getElementById('cancelRelModal').addEventListener('click', () => {
  modalRelation.classList.remove('active');
});

document.getElementById('saveRelModal').addEventListener('click', () => {
  const a = relPersonA.value.trim();
  const b = relPersonB.value.trim();
  const rel = relTypeSelect.value;
  if (a && b) {
    try {
      tree.addRelation(a, rel, b);
      render();
      modalRelation.classList.remove('active');
    } catch (err) {
      alert(err.message);
    }
  }
});

// Find Kinship Modal
document.getElementById('btnFindKin').addEventListener('click', () => {
  // Populate dropdowns or datalists
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

// Load Sample Tree
function loadSampleTree() {
  tree.fromJSON({ people: [], relations: [] });
  highlightedPathNodes.clear();
  tree.addRelation('Grandpa George', 'parent', 'John');
  tree.addRelation('Grandma Mary', 'spouse', 'Grandpa George');
  tree.addRelation('Grandma Mary', 'parent', 'John');
  tree.addRelation('John', 'spouse', 'Sarah');
  tree.addRelation('John', 'parent', 'Leo');
  tree.addRelation('John', 'parent', 'Maya');
  tree.addRelation('Robert', 'parent', 'Sarah');
  tree.addRelation('Clara', 'spouse', 'Robert');
  render();
}

document.getElementById('btnSample').addEventListener('click', () => {
  loadSampleTree();
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('Clear entire family tree?')) {
    tree.fromJSON({ people: [], relations: [] });
    highlightedPathNodes.clear();
    selectedNodeId = null;
    nodeActionsBar.style.display = 'none';
    render();
  }
});

// Quick CLI prompt chips
document.querySelectorAll('.cli-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    cliInput.value = chip.getAttribute('data-cmd') || '';
    cliInput.focus();
  });
});

// Initialize
if (!loadLocal() || tree.people.size === 0) {
  loadSampleTree();
} else {
  render();
}
applyTransform();
