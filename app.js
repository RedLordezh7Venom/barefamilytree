// app.js - Visual Renderer, User Interaction, and CLI Controller
import { FamilyTree } from './core/tree.js';

const tree = new FamilyTree();

// Pan & Zoom State
let panX = window.innerWidth / 2;
let panY = 120;
let zoom = 1;
let isPanning = false;
let startPan = { x: 0, y: 0 };
let selectedNodeId = null;

// DOM Elements
const viewport = document.getElementById('viewport');
const transformLayer = document.getElementById('transformLayer');
const edgesLayer = document.getElementById('edgesLayer');
const nodesLayer = document.getElementById('nodesLayer');
const treeStats = document.getElementById('treeStats');

// CLI Elements
const cliDrawer = document.getElementById('cliDrawer');
const cliBtn = document.getElementById('cliBtn');
const cliCloseBtn = document.getElementById('cliCloseBtn');
const cliInput = document.getElementById('cliInput');
const cliOutput = document.getElementById('cliOutput');

// Modals
const modalPerson = document.getElementById('modalPerson');
const modalRelation = document.getElementById('modalRelation');
const personNameInput = document.getElementById('personNameInput');
const relPersonA = document.getElementById('relPersonA');
const relPersonB = document.getElementById('relPersonB');
const relTypeSelect = document.getElementById('relTypeSelect');

// History for CLI
const commandHistory = [];
let historyIndex = -1;

// Update Transform Layer
function applyTransform() {
  transformLayer.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);
}
applyTransform();

// Update Stats counter
function updateStats() {
  treeStats.textContent = `${tree.people.size} people · ${tree.relations.length} relations`;
}

// Render SVG Tree
function render() {
  updateStats();
  const { nodes, edges } = tree.computeLayout();

  // Clear layers
  edgesLayer.innerHTML = '';
  nodesLayer.innerHTML = '';

  // Render Edges
  edges.forEach((edge) => {
    const x1 = edge.from.x + edge.from.width / 2;
    const y1 = edge.from.y + edge.from.height;
    const x2 = edge.to.x + edge.to.width / 2;
    const y2 = edge.to.y;

    if (edge.type === 'parent') {
      // Smooth cubic bezier downward curve
      const midY = (y1 + y2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute('class', 'edge-parent');
      path.setAttribute('marker-end', 'url(#arrow)');
      edgesLayer.appendChild(path);
    } else if (edge.type === 'spouse') {
      // Horizontal dashed line connecting spouses
      const spY1 = edge.from.y + edge.from.height / 2;
      const spY2 = edge.to.y + edge.to.height / 2;
      const spX1 = edge.from.x < edge.to.x ? edge.from.x + edge.from.width : edge.from.x;
      const spX2 = edge.from.x < edge.to.x ? edge.to.x : edge.to.x + edge.to.width;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${spX1} ${spY1} L ${spX2} ${spY2}`);
      path.setAttribute('class', 'edge-spouse');
      edgesLayer.appendChild(path);
    }
  });

  // Render Nodes
  nodes.forEach((node) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `node-group ${selectedNodeId === node.id ? 'selected' : ''}`);
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
      selectedNodeId = selectedNodeId === node.id ? null : node.id;
      render();
    });

    nodesLayer.appendChild(g);
  });
}

// Pan & Zoom Listeners
viewport.addEventListener('mousedown', (e) => {
  if (e.target.closest('.node-group')) return;
  isPanning = true;
  startPan = { x: e.clientX - panX, y: e.clientY - panY };
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

// CLI Terminal Logic
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

// Command Parser
function runCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;

  printCli(`> ${cmd}`, 'cmd');
  commandHistory.push(cmd);
  historyIndex = commandHistory.length;

  // Split keeping quoted arguments intact: add "Jane Doe"
  const args = (cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map(s => s.replace(/^"|"$/g, ''));
  const action = (args[0] || '').toLowerCase();

  switch (action) {
    case 'help':
      printCli('Available Commands:', 'help');
      printCli('  add <name>                          - Add person (e.g. add Alice)', 'help');
      printCli('  rel <name1> <type> <name2>          - Add relation (types: parent, child, spouse, sibling)', 'help');
      printCli('  join <name1> <type> <name2>         - Connect disjoint trees or people', 'help');
      printCli('  find <name1> <name2>                - Trace kinship path between 2 people', 'help');
      printCli('  delete <name>                       - Delete person & their relations', 'help');
      printCli('  list                                - Print all people and relations', 'help');
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

      // If args.length > 4 or rType is not a keyword, look for a keyword in tokens
      const kwIdx = args.findIndex((t, i) => i >= 2 && relKeywords.includes(t.toLowerCase()));
      if (kwIdx !== -1 && kwIdx < args.length - 1) {
        p1 = args.slice(1, kwIdx).join(' ');
        rType = args[kwIdx];
        p2 = args.slice(kwIdx + 1).join(' ');
      }

      if (!p1 || !rType || !p2) {
        return printCli('Usage: rel <person1> <parent|child|spouse|sibling> <person2> (quotes optional)', 'err');
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
        // Check for 'and' or 'to' connector: find John Doe and Jane Doe
        const splitIdx = args.findIndex((t, i) => i >= 2 && ['and', 'to'].includes(t.toLowerCase()));
        if (splitIdx !== -1 && splitIdx < args.length - 1) {
          p1 = args.slice(1, splitIdx).join(' ');
          p2 = args.slice(splitIdx + 1).join(' ');
        } else {
          return printCli('Usage: find "Person 1" "Person 2" (wrap names in quotes)', 'err');
        }
      }

      if (!p1 || !p2) return printCli('Usage: find <person1> <person2>', 'err');
      const res = tree.findPath(p1, p2);
      if (res.error) printCli(res.error, 'err');
      else printCli(`Kinship Path: ${res.description}`, 'success');
      break;
    }

    case 'list':
      printCli(`People (${tree.people.size}):`, 'res');
      for (const p of tree.people.values()) {
        const parents = tree.getParents(p.id).map(x => x.name).join(', ') || 'none';
        const spouses = tree.getSpouses(p.id).map(x => x.name).join(', ') || 'none';
        printCli(` • ${p.name} (Parents: ${parents} | Spouse: ${spouses})`, 'res');
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

    case 'clear':
      cliOutput.innerHTML = '';
      break;

    case 'reset':
      tree.fromJSON({ people: [], relations: [] });
      printCli('Tree cleared', 'success');
      render();
      break;

    case 'exit':
      toggleCli(false);
      break;

    default:
      printCli(`Unknown command: "${action}". Type "help" for command list.`, 'err');
  }
}

// CLI Event Listeners
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

// Global Keyboard Shortcut: 'E' opens CLI, Esc closes
window.addEventListener('keydown', (e) => {
  // If user is currently focused on an input element, do not hijack unless it's Esc
  const isInputFocused = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    toggleCli(false);
    modalPerson.classList.remove('active');
    modalRelation.classList.remove('active');
  } else if ((e.key === 'e' || e.key === 'E') && !isInputFocused) {
    e.preventDefault();
    toggleCli();
  }
});

cliBtn.addEventListener('click', () => toggleCli(true));
cliCloseBtn.addEventListener('click', () => toggleCli(false));

// Modal Actions
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
    tree.addPerson(name);
    render();
    modalPerson.classList.remove('active');
  }
});

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

document.getElementById('btnFindKin').addEventListener('click', () => {
  const a = prompt('First person:');
  if (!a) return;
  const b = prompt('Second person:');
  if (!b) return;
  const res = tree.findPath(a, b);
  alert(res.description || res.error);
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('Clear entire family tree?')) {
    tree.fromJSON({ people: [], relations: [] });
    render();
  }
});

// Load Sample Family
document.getElementById('btnSample').addEventListener('click', () => {
  loadSampleTree();
});

function loadSampleTree() {
  tree.fromJSON({ people: [], relations: [] });
  tree.addRelation('Grandpa George', 'parent', 'John');
  tree.addRelation('Grandma Mary', 'spouse', 'Grandpa George');
  tree.addRelation('Grandma Mary', 'parent', 'John');
  tree.addRelation('John', 'spouse', 'Sarah');
  tree.addRelation('John', 'parent', 'Leo');
  tree.addRelation('John', 'parent', 'Maya');
  // Disjoint side branch joined via marriage
  tree.addRelation('Robert', 'parent', 'Sarah');
  tree.addRelation('Clara', 'spouse', 'Robert');
  render();
}

// Initial Sample
loadSampleTree();
