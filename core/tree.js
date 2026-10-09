// core/tree.js - Simplest Primitive Tree: Union of 2 parents makes a child

export class FamilyTree {
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

    // Remove from unions
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

  findPath(nameA, nameB) {
    const start = this.getPerson(nameA);
    const end = this.getPerson(nameB);
    if (!start) return { error: `"${nameA}" not found` };
    if (!end) return { error: `"${nameB}" not found` };
    if (start.id === end.id) return { path: [start.name], description: 'Same person' };

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
          textSteps.push(`${uName} ${stepTaken.get(`${u}->${v}`)} ${vName}`);
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
      for (const s of this.getSiblings(curr)) neighbors.push({ id: s.id, desc: 'is sibling of' });

      for (const nb of neighbors) {
        if (!visited.has(nb.id)) {
          visited.add(nb.id);
          stepTaken.set(`${curr}->${nb.id}`, nb.desc);
          queue.push([...currentPath, nb.id]);
        }
      }
    }

    return { path: null, description: `No connection between ${start.name} and ${end.name}` };
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

// History Tracker for Undo / Redo (Ctrl+Z / Ctrl+Y)
export class HistoryTracker {
  constructor(tree, maxSnapshots = 50) {
    this.tree = tree;
    this.maxSnapshots = maxSnapshots;
    this.undoStack = [];
    this.redoStack = [];
  }

  record() {
    this.undoStack.push(JSON.stringify(this.tree.toJSON()));
    if (this.undoStack.length > this.maxSnapshots) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(JSON.stringify(this.tree.toJSON()));
    const prev = JSON.parse(this.undoStack.pop());
    this.tree.fromJSON(prev);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(JSON.stringify(this.tree.toJSON()));
    const next = JSON.parse(this.redoStack.pop());
    this.tree.fromJSON(next);
    return true;
  }
}
