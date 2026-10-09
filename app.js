// app.js - Bare Family Tree: HTML Cards + Direct Add + Undo/Redo (Ctrl+Z)

class FamilyTree {
  constructor() {
    this.people = new Map(); // id -> { id, name, x, y }
    this.unions = []; // [ { id, p1, p2, children: [childId, ...] } ]
  }

  _norm(name) {
    return (name || '').trim();
  }

  getPerson(nameOrId) {
    if (!nameOrId) return null;
    if (this.people.has(nameOrId)) return this.people.get(nameOrId);
    const norm = this._norm(nameOrId).toLowerCase();
    for (const p of this.people.values()) {
      if (p.name.toLowerCase() === norm) return p;
    }
    return null;
  }

  addPerson(name, x = 160, y = 120) {
    const clean = this._norm(name);
    if (!clean) return null;

    const id = 'p_' + Math.random().toString(36).substring(2, 9);
    const person = { id, name: clean, x: Math.round(x), y: Math.round(y) };
    this.people.set(id, person);
    return person;
  }

  deletePerson(nameOrId) {
    const p = this.getPerson(nameOrId);
    if (!p) return false;
    this.people.delete(p.id);

    this.unions = this.unions.filter(u => {
      if (u.p1 === p.id && u.p2 === p.id) return false;
      if (u.p1 === p.id) {
        u.p1 = u.p2;
        u.p2 = null;
      } else if (u.p2 === p.id) {
        u.p2 = null;
      }
      u.children = u.children.filter(cid => cid !== p.id);
      return u.p1 !== null || u.children.length > 0;
    });

    return true;
  }

  removeUnion(unionId) {
    this.unions = this.unions.filter(u => u.id !== unionId);
  }

  unlinkChild(childId) {
    for (const u of this.unions) {
      u.children = u.children.filter(cid => cid !== childId);
    }
  }

  resetRelations() {
    this.unions = [];
  }

  addUnion(parentA, parentB) {
    const p1 = this.getPerson(parentA) || this.addPerson(parentA);
    const p2 = parentB ? (this.getPerson(parentB) || this.addPerson(parentB)) : null;

    if (p2 && p1.id === p2.id) return null;

    for (const u of this.unions) {
      if (p2) {
        if ((u.p1 === p1.id && u.p2 === p2.id) || (u.p1 === p2.id && u.p2 === p1.id)) {
          return u;
        }
      } else {
        if (u.p1 === p1.id && !u.p2) return u;
      }
    }

    const union = {
      id: 'u_' + Math.random().toString(36).substring(2, 9),
      p1: p1.id,
      p2: p2 ? p2.id : null,
      children: []
    };
    this.unions.push(union);
    return union;
  }

  addChild(parentA, parentB, childName) {
    let p1Name = parentA;
    let p2Name = parentB;
    let cName = childName;

    if (childName === undefined || childName === null) {
      cName = parentB;
      p2Name = null;
    }

    const p1 = this.getPerson(p1Name) || this.addPerson(p1Name);
    const p2 = p2Name ? (this.getPerson(p2Name) || this.addPerson(p2Name)) : null;

    const childX = p2 ? Math.round((p1.x + p2.x) / 2) : p1.x;
    const childY = p1.y + 160;
    const child = this.getPerson(cName) || this.addPerson(cName, childX, childY);

    if (child.id === p1.id || (p2 && child.id === p2.id)) return null;

    let union = null;
    for (const u of this.unions) {
      if (p2) {
        if ((u.p1 === p1.id && u.p2 === p2.id) || (u.p1 === p2.id && u.p2 === p1.id)) {
          union = u;
          break;
        }
      } else {
        if (u.p1 === p1.id && !u.p2) {
          union = u;
          break;
        }
      }
    }

    if (!union) {
      union = this.addUnion(p1.id, p2 ? p2.id : null);
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
        if (u.p1) parents.push(this.people.get(u.p1));
        if (u.p2) parents.push(this.people.get(u.p2));
      }
    }
    return parents.filter(Boolean);
  }

  getChildren(personId) {
    const kids = [];
    for (const u of this.unions) {
      if (u.p1 === personId || u.p2 === personId) {
        for (const cid of u.children) {
          const c = this.people.get(cid);
          if (c && !kids.some(k => k.id === c.id)) kids.push(c);
        }
      }
    }
    return kids;
  }

  getSiblings(personId) {
    const sibs = [];
    for (const u of this.unions) {
      if (u.children.includes(personId)) {
        for (const cid of u.children) {
          if (cid !== personId) {
            const s = this.people.get(cid);
            if (s && !sibs.some(k => k.id === s.id)) sibs.push(s);
          }
        }
      }
    }
    return sibs;
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
// Interactive UI Controller with Undo / Redo (Ctrl+Z)
// -------------------------------------------------------------

const tree = new FamilyTree();
const CARD_W = 140;
const CARD_H = 54;

// History Stacks
const undoStack = [];
const redoStack = [];

function recordState() {
  undoStack.push(JSON.stringify(tree.toJSON()));
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0; // Clear redo upon new mutation
  updateUndoRedoUI();
}

function undo() {
  if (undoStack.length === 0) return false;
  redoStack.push(JSON.stringify(tree.toJSON()));
  const prevState = JSON.parse(undoStack.pop());
  tree.fromJSON(prevState);
  render();
  updateUndoRedoUI();
  return true;
}

function redo() {
  if (redoStack.length === 0) return false;
  undoStack.push(JSON.stringify(tree.toJSON()));
  const nextState = JSON.parse(redoStack.pop());
  tree.fromJSON(nextState);
  render();
  updateUndoRedoUI();
  return true;
}

function updateUndoRedoUI() {
  btnUndo.style.opacity = undoStack.length > 0 ? '1' : '0.4';
  btnRedo.style.opacity = redoStack.length > 0 ? '1' : '0.4';
}

// DOM Elements
const canvasContainer = document.getElementById('canvasContainer');
const cardsLayer = document.getElementById('cardsLayer');
const svgLinesLayer = document.getElementById('svgLinesLayer');
const statsCount = document.getElementById('statsCount');
const directNameInput = document.getElementById('directNameInput');
const btnDirectAdd = document.getElementById('btnDirectAdd');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnResetRelations = document.getElementById('btnResetRelations');
const btnQuickSample = document.getElementById('btnQuickSample');
const btnClearAll = document.getElementById('btnClearAll');

// Dragging Card State
let activeDragCard = null;
let dragOffset = { x: 0, y: 0 };
let cardMoved = false;

// Dragging Connection State (from handle)
let connectingSource = null;
const dragPreviewSvg = document.getElementById('dragPreviewSvg');
const dragLine = document.getElementById('dragLine');

// CLI Elements
const cliDrawer = document.getElementById('cliDrawer');
const cliToggleBtn = document.getElementById('cliToggleBtn');
const cliCloseBtn = document.getElementById('cliCloseBtn');
const cliInputField = document.getElementById('cliInputField');
const cliLog = document.getElementById('cliLog');

function save() {
  try {
    localStorage.setItem('bare_family_tree_store', JSON.stringify(tree.toJSON()));
  } catch (e) {}
}

function load() {
  try {
    const raw = localStorage.getItem('bare_family_tree_store');
    if (raw) {
      tree.fromJSON(JSON.parse(raw));
      return true;
    }
  } catch (e) {}
  return false;
}

function updateStats() {
  statsCount.textContent = `${tree.people.size} people · ${tree.unions.length} unions`;
}

// -------------------------------------------------------------
// Render: Cards + Marriage Lines + Union Children Trees
// -------------------------------------------------------------

function render() {
  updateStats();
  save();

  // Clear existing
  cardsLayer.innerHTML = '';
  svgLinesLayer.innerHTML = '';

  // 1. Draw Lines & Union Buttons
  tree.unions.forEach((u) => {
    const p1 = tree.people.get(u.p1);
    const p2 = u.p2 ? tree.people.get(u.p2) : null;
    if (!p1) return;

    let unionCenterX, unionCenterY;

    if (p2) {
      // Line between Mom and Dad
      const p1CenterX = p1.x + CARD_W / 2;
      const p1CenterY = p1.y + CARD_H / 2;
      const p2CenterX = p2.x + CARD_W / 2;
      const p2CenterY = p2.y + CARD_H / 2;

      unionCenterX = (p1CenterX + p2CenterX) / 2;
      unionCenterY = (p1CenterY + p2CenterY) / 2;

      // Draw marriage dashed line
      const mLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      mLine.setAttribute('x1', p1CenterX);
      mLine.setAttribute('y1', p1CenterY);
      mLine.setAttribute('x2', p2CenterX);
      mLine.setAttribute('y2', p2CenterY);
      mLine.setAttribute('class', 'marriage-line');
      svgLinesLayer.appendChild(mLine);
    } else {
      // Single parent
      unionCenterX = p1.x + CARD_W / 2;
      unionCenterY = p1.y + CARD_H;
    }

    // Union Badge: contains [+ Child] and [✂ Break]
    const unionBadge = document.createElement('div');
    unionBadge.className = 'union-badge';
    unionBadge.style.left = `${unionCenterX}px`;
    unionBadge.style.top = `${unionCenterY}px`;

    // Button 1: Add Child
    const addKidBtn = document.createElement('button');
    addKidBtn.className = 'union-btn-add';
    addKidBtn.textContent = '+ Child';
    addKidBtn.title = `Add child born from ${p1.name}${p2 ? ' & ' + p2.name : ''}`;
    addKidBtn.onclick = (e) => {
      e.stopPropagation();
      const childName = prompt(`Enter child name for ${p1.name}${p2 ? ' & ' + p2.name : ''}:`);
      if (childName && childName.trim()) {
        recordState();
        tree.addChild(p1.name, p2 ? p2.name : null, childName.trim());
        render();
      }
    };
    unionBadge.appendChild(addKidBtn);

    // Button 2: Break / Undo Union
    const breakBtn = document.createElement('button');
    breakBtn.className = 'union-btn-break';
    breakBtn.textContent = '✂ Break';
    breakBtn.title = `Undo union between ${p1.name}${p2 ? ' and ' + p2.name : ''}`;
    breakBtn.onclick = (e) => {
      e.stopPropagation();
      recordState();
      tree.removeUnion(u.id);
      render();
    };
    unionBadge.appendChild(breakBtn);

    cardsLayer.appendChild(unionBadge);

    // If children exist, draw branch down to children
    const kids = u.children.map(cid => tree.people.get(cid)).filter(Boolean);
    if (kids.length > 0) {
      const busY = unionCenterY + 45;

      // Vertical stem from union to bus bar
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1', unionCenterX);
      stem.setAttribute('y1', unionCenterY);
      stem.setAttribute('x2', unionCenterX);
      stem.setAttribute('y2', busY);
      stem.setAttribute('class', 'child-line');
      svgLinesLayer.appendChild(stem);

      // Horizontal bus bar
      const kidXCenters = kids.map(k => k.x + CARD_W / 2);
      const minX = Math.min(unionCenterX, ...kidXCenters);
      const maxX = Math.max(unionCenterX, ...kidXCenters);

      if (kids.length > 1 || minX !== maxX) {
        const bus = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bus.setAttribute('x1', minX);
        bus.setAttribute('y1', busY);
        bus.setAttribute('x2', maxX);
        bus.setAttribute('y2', busY);
        bus.setAttribute('class', 'child-line');
        svgLinesLayer.appendChild(bus);
      }

      // Vertical drop line to each child card
      kids.forEach((k) => {
        const kCenterX = k.x + CARD_W / 2;
        const drop = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        drop.setAttribute('x1', kCenterX);
        drop.setAttribute('y1', busY);
        drop.setAttribute('x2', kCenterX);
        drop.setAttribute('y2', k.y);
        drop.setAttribute('class', 'child-line');
        drop.setAttribute('marker-end', 'url(#arrow)');
        svgLinesLayer.appendChild(drop);
      });
    }
  });

  // 2. Render Cards
  tree.people.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'person-card';
    card.id = `card_${p.id}`;
    card.style.left = `${p.x}px`;
    card.style.top = `${p.y}px`;

    // Title / Name
    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = p.name;
    card.appendChild(title);

    // Delete Button (top right ✕)
    const delBtn = document.createElement('button');
    delBtn.className = 'card-del-btn';
    delBtn.textContent = '✕';
    delBtn.title = `Delete ${p.name}`;
    delBtn.onclick = (e) => {
      e.stopPropagation();
      recordState();
      tree.deletePerson(p.id);
      render();
    };
    card.appendChild(delBtn);

    // If person is a child in a union, show unlink button (top left ⤹)
    const parents = tree.getParents(p.id);
    if (parents.length > 0) {
      const unlinkBtn = document.createElement('button');
      unlinkBtn.className = 'card-unlink-btn';
      unlinkBtn.textContent = '⤹';
      unlinkBtn.title = `Unlink ${p.name} from parents (${parents.map(x => x.name).join(' & ')})`;
      unlinkBtn.onclick = (e) => {
        e.stopPropagation();
        recordState();
        tree.unlinkChild(p.id);
        render();
      };
      card.appendChild(unlinkBtn);
    }

    // Bottom Handle (drag to partner or child)
    const handle = document.createElement('div');
    handle.className = 'card-handle';
    handle.textContent = '↓';
    handle.title = 'Drag onto another person to partner';
    handle.onmousedown = (e) => {
      e.stopPropagation();
      startConnecting(p, e);
    };
    card.appendChild(handle);

    // Card Dragging (moves the card)
    card.onmousedown = (e) => {
      if (e.target.closest('.card-del-btn') || e.target.closest('.card-unlink-btn') || e.target.closest('.card-handle')) return;
      activeDragCard = p;
      cardMoved = false;
      const rect = card.getBoundingClientRect();
      dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    cardsLayer.appendChild(card);
  });
}

// -------------------------------------------------------------
// Mouse Handlers (Card Drag & Connect Drag)
// -------------------------------------------------------------

function startConnecting(person, e) {
  connectingSource = person;
  dragPreviewSvg.style.display = 'block';
  const startX = person.x + CARD_W / 2;
  const startY = person.y + CARD_H;
  dragLine.setAttribute('x1', startX);
  dragLine.setAttribute('y1', startY);
  dragLine.setAttribute('x2', e.clientX);
  dragLine.setAttribute('y2', e.clientY);
  dragLine.style.display = 'block';
}

window.addEventListener('mousemove', (e) => {
  // If moving a card
  if (activeDragCard) {
    if (!cardMoved) {
      recordState();
      cardMoved = true;
    }
    const containerRect = canvasContainer.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;
    activeDragCard.x = Math.max(10, Math.min(newX, containerRect.width - CARD_W - 10));
    activeDragCard.y = Math.max(10, Math.min(newY, containerRect.height - CARD_H - 10));
    render();
    return;
  }

  // If dragging connection line
  if (connectingSource) {
    const containerRect = canvasContainer.getBoundingClientRect();
    dragLine.setAttribute('x2', e.clientX - containerRect.left);
    dragLine.setAttribute('y2', e.clientY - containerRect.top);

    // Highlight card under cursor
    document.querySelectorAll('.person-card').forEach(el => el.classList.remove('drop-target'));
    const targetElem = document.elementFromPoint(e.clientX, e.clientY)?.closest('.person-card');
    if (targetElem && targetElem.id !== `card_${connectingSource.id}`) {
      targetElem.classList.add('drop-target');
    }
  }
});

window.addEventListener('mouseup', (e) => {
  if (activeDragCard) {
    activeDragCard = null;
    save();
  }

  if (connectingSource) {
    const targetElem = document.elementFromPoint(e.clientX, e.clientY)?.closest('.person-card');
    dragLine.style.display = 'none';
    dragPreviewSvg.style.display = 'none';

    if (targetElem && targetElem.id !== `card_${connectingSource.id}`) {
      const targetId = targetElem.id.replace('card_', '');
      const targetPerson = tree.people.get(targetId);
      if (targetPerson) {
        recordState();
        tree.addUnion(connectingSource.id, targetPerson.id);
        render();
      }
    }
    document.querySelectorAll('.person-card').forEach(el => el.classList.remove('drop-target'));
    connectingSource = null;
  }
});

// Double click canvas to add new person
canvasContainer.addEventListener('dblclick', (e) => {
  if (e.target.closest('.person-card') || e.target.closest('.union-badge')) return;
  const name = prompt('Enter new person name:');
  if (name && name.trim()) {
    recordState();
    const rect = canvasContainer.getBoundingClientRect();
    const x = e.clientX - rect.left - CARD_W / 2;
    const y = e.clientY - rect.top - CARD_H / 2;
    tree.addPerson(name.trim(), x, y);
    render();
  }
});

// Direct Add Button & Input (Works 100% reliably)
btnDirectAdd.addEventListener('click', () => {
  const name = directNameInput.value.trim();
  if (!name) {
    directNameInput.focus();
    return;
  }
  recordState();
  const containerRect = canvasContainer.getBoundingClientRect();
  const cWidth = containerRect.width || 800;
  const cHeight = containerRect.height || 600;
  const offset = (tree.people.size % 6) * 35;
  const x = Math.max(30, cWidth / 2 - CARD_W / 2 + offset - 80);
  const y = Math.max(30, cHeight / 2 - CARD_H / 2 + offset - 80);

  const p = tree.addPerson(name, x, y);
  directNameInput.value = '';
  render();

  if (p) {
    const el = document.getElementById(`card_${p.id}`);
    if (el) {
      el.classList.add('flash-new');
      setTimeout(() => el.classList.remove('flash-new'), 1200);
    }
  }
  directNameInput.focus();
});

directNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnDirectAdd.click();
  }
});

// Undo / Redo Buttons
btnUndo.addEventListener('click', () => undo());
btnRedo.addEventListener('click', () => redo());

// Reset Relations Button
btnResetRelations.addEventListener('click', () => {
  recordState();
  tree.resetRelations();
  render();
});

// Load Sample Tree
function loadSampleTree() {
  recordState();
  tree.fromJSON({ people: [], unions: [] });
  const mom = tree.addPerson('mom', 220, 80);
  const dad = tree.addPerson('dad', 440, 80);
  tree.addUnion(mom.id, dad.id);

  tree.addChild('mom', 'dad', 'egg');
  tree.addChild('mom', 'dad', 'egg2');

  const egg = tree.getPerson('egg');
  const egg2 = tree.getPerson('egg2');
  if (egg) { egg.x = 220; egg.y = 260; }
  if (egg2) { egg2.x = 440; egg2.y = 260; }

  render();
}

btnQuickSample.addEventListener('click', () => {
  loadSampleTree();
});

btnClearAll.addEventListener('click', () => {
  recordState();
  tree.fromJSON({ people: [], unions: [] });
  render();
});

// -------------------------------------------------------------
// Global Keyboard Handlers (Ctrl+Z Undo / Ctrl+Y Redo, Hotkey 'E')
// -------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

  // Ctrl+Z / Cmd+Z for Undo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    if (!isInput) {
      e.preventDefault();
      undo();
      return;
    }
  }

  // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z for Redo
  if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) {
    if (!isInput) {
      e.preventDefault();
      redo();
      return;
    }
  }

  // Esc closes CLI
  if (e.key === 'Escape') {
    toggleCli(false);
  } else if ((e.key === 'e' || e.key === 'E') && !isInput) {
    e.preventDefault();
    toggleCli();
  }
});

// -------------------------------------------------------------
// CLI Terminal Drawer (Hotkey 'E')
// -------------------------------------------------------------

function toggleCli(force) {
  const isOpen = cliDrawer.classList.toggle('open', force);
  if (isOpen) {
    cliInputField.focus();
  }
}

function printCli(text, type = 'res') {
  const line = document.createElement('div');
  line.className = `log-${type}`;
  line.textContent = text;
  cliLog.appendChild(line);
  cliLog.scrollTop = cliLog.scrollHeight;
}

function runCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  printCli(`> ${cmd}`, 'cmd');

  const args = (cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map(s => s.replace(/^"|"$/g, ''));
  const action = (args[0] || '').toLowerCase();

  switch (action) {
    case 'help':
      printCli('Commands:', 'info');
      printCli('  undo                                - Undo last action (Ctrl+Z)', 'info');
      printCli('  redo                                - Redo action (Ctrl+Y)', 'info');
      printCli('  add <name>                          - Add person', 'info');
      printCli('  union <p1> <p2>                     - Partner two people', 'info');
      printCli('  child <p1> <p2> <child>             - Union makes a child', 'info');
      printCli('  break <p1> <p2>                     - Undo union between p1 and p2', 'info');
      printCli('  unlink <child>                      - Unlink child from parents', 'info');
      printCli('  reset-relations                     - Remove all relations (keep people)', 'info');
      printCli('  del <name>                          - Delete person', 'info');
      printCli('  sample                              - Load mom + dad -> egg, egg2', 'info');
      printCli('  list                                - Print people & unions', 'info');
      printCli('  clear                               - Clear terminal logs', 'info');
      printCli('  exit                                - Close CLI drawer', 'info');
      break;

    case 'undo':
      if (undo()) printCli('Undid last action', 'success');
      else printCli('Nothing to undo', 'info');
      break;

    case 'redo':
      if (redo()) printCli('Redid action', 'success');
      else printCli('Nothing to redo', 'info');
      break;

    case 'add':
      if (args.length < 2) return printCli('Usage: add <name>', 'err');
      recordState();
      tree.addPerson(args.slice(1).join(' '));
      printCli(`Added ${args.slice(1).join(' ')}`, 'success');
      render();
      break;

    case 'union':
    case 'partner':
      if (args.length < 3) return printCli('Usage: union <p1> <p2>', 'err');
      recordState();
      tree.addUnion(args[1], args[2]);
      printCli(`Union created between ${args[1]} and ${args[2]}`, 'success');
      render();
      break;

    case 'child':
      if (args.length < 4) return printCli('Usage: child <parent1> <parent2> <childName>', 'err');
      recordState();
      tree.addChild(args[1], args[2], args[3]);
      printCli(`Added child "${args[3]}" to union of ${args[1]} & ${args[2]}`, 'success');
      render();
      break;

    case 'break':
      if (args.length < 3) return printCli('Usage: break <p1> <p2>', 'err');
      const p1 = tree.getPerson(args[1]);
      const p2 = tree.getPerson(args[2]);
      if (p1 && p2) {
        recordState();
        tree.unions = tree.unions.filter(u => !(
          (u.p1 === p1.id && u.p2 === p2.id) || (u.p1 === p2.id && u.p2 === p1.id)
        ));
        printCli(`Broken union between ${args[1]} and ${args[2]}`, 'success');
        render();
      } else {
        printCli('Persons not found', 'err');
      }
      break;

    case 'unlink':
      if (args.length < 2) return printCli('Usage: unlink <childName>', 'err');
      const ch = tree.getPerson(args.slice(1).join(' '));
      if (ch) {
        recordState();
        tree.unlinkChild(ch.id);
        printCli(`Unlinked ${ch.name}`, 'success');
        render();
      } else {
        printCli('Person not found', 'err');
      }
      break;

    case 'reset-relations':
      recordState();
      tree.resetRelations();
      printCli('All relations reset (people preserved)', 'success');
      render();
      break;

    case 'del':
    case 'delete':
    case 'rm':
      if (args.length < 2) return printCli('Usage: del <name>', 'err');
      recordState();
      if (tree.deletePerson(args.slice(1).join(' '))) {
        printCli(`Deleted ${args.slice(1).join(' ')}`, 'success');
        render();
      } else {
        printCli(`Not found: ${args.slice(1).join(' ')}`, 'err');
      }
      break;

    case 'sample':
      loadSampleTree();
      printCli('Sample loaded (mom + dad ➔ egg, egg2)', 'success');
      break;

    case 'list':
      printCli(`People (${tree.people.size}):`, 'res');
      for (const p of tree.people.values()) {
        const parents = tree.getParents(p.id).map(x => x.name).join(' & ') || 'none';
        const kids = tree.getChildren(p.id).map(x => x.name).join(', ') || 'none';
        const sibs = tree.getSiblings(p.id).map(x => x.name).join(', ') || 'none';
        printCli(` • ${p.name} | Parents: [${parents}] | Children: [${kids}] | Siblings: [${sibs}]`, 'res');
      }
      break;

    case 'clear':
      cliLog.innerHTML = '';
      break;

    case 'exit':
      toggleCli(false);
      break;

    default:
      printCli(`Unknown command "${action}". Type "help"`, 'err');
  }
}

cliInputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runCommand(cliInputField.value);
    cliInputField.value = '';
  } else if (e.key === 'Escape') {
    toggleCli(false);
  }
});

cliToggleBtn.addEventListener('click', () => toggleCli(true));
cliCloseBtn.addEventListener('click', () => toggleCli(false));

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    cliInputField.value = chip.getAttribute('data-cmd') || '';
    cliInputField.focus();
  });
});

// Initialize
if (!load() || tree.people.size === 0) {
  loadSampleTree();
} else {
  render();
}
updateUndoRedoUI();
