// core/tree.js - Union-based Bare Family Tree Engine

export class FamilyTree {
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
    const p = this.getPerson(name);
    if (!p) return false;
    this.people.delete(p.id);

    // Remove from unions
    this.unions = this.unions.filter(u => {
      // If was a partner, remove union or make single partner
      if (u.partnerA === p.id && u.partnerB === p.id) return false;
      if (u.partnerA === p.id) {
        u.partnerA = u.partnerB;
        u.partnerB = null;
      } else if (u.partnerB === p.id) {
        u.partnerB = null;
      }
      // Remove from children
      u.children = u.children.filter(cid => cid !== p.id);
      // Keep union only if it has at least one partner or children
      return u.partnerA !== null || u.children.length > 0;
    });

    return true;
  }

  // Find or create union between two partners
  getOrCreateUnion(nameA, nameB = null) {
    const pA = this.getOrCreate(nameA);
    const pB = nameB ? this.getOrCreate(nameB) : null;
    if (pB && pA.id === pB.id) throw new Error('Cannot create union with oneself');

    // Check if union already exists
    for (const u of this.unions) {
      if (pB) {
        if ((u.partnerA === pA.id && u.partnerB === pB.id) ||
            (u.partnerA === pB.id && u.partnerB === pA.id)) {
          return u;
        }
      } else {
        if (u.partnerA === pA.id && !u.partnerB) {
          return u;
        }
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

  // Add child to a union of parentA and optional parentB
  addChild(parentA, childName, parentB = null) {
    const pA = this.getOrCreate(parentA);
    const child = this.getOrCreate(childName);
    if (child.id === pA.id) throw new Error('Child cannot be their own parent');
    if (parentB) {
      const pB = this.getOrCreate(parentB);
      if (child.id === pB.id) throw new Error('Child cannot be their own parent');
    }

    // Check ancestor cycle
    if (this.isAncestor(child.id, pA.id)) {
      throw new Error(`Cannot add child: ${pA.name} is a descendant of ${child.name}`);
    }
    if (parentB && this.isAncestor(child.id, this.getPerson(parentB).id)) {
      throw new Error(`Cannot add child: ${parentB} is a descendant of ${child.name}`);
    }

    // If parentB is not specified, check if pA already has a single union with a spouse
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

  // Get parents of a child
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

  // Get children of a person
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

  // Get partners / spouses
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

  // Inferred siblings: share at least one parent union
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

  // Trace kinship path using BFS
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

  // Auto layout calculation: generational rows with partners side-by-side & union junction
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

      // Partners share generation
      for (const pt of this.getPartners(id)) {
        const ptGen = Math.max(genMap.get(pt.id) ?? -Infinity, currentGen);
        genMap.set(pt.id, ptGen);
        genMap.set(id, ptGen);
      }

      // Children are gen + 1
      for (const ch of this.getChildren(id)) {
        assignGen(ch.id, (genMap.get(id) ?? currentGen) + 1);
      }
    };

    // Roots (people with no parents) start at gen 0
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
    const GAP_Y = 100;

    const positionedNodes = [];
    const nodeCoords = new Map();

    const sortedGens = Array.from(genBuckets.keys()).sort((a, b) => a - b);
    sortedGens.forEach((gen) => {
      const rawRow = genBuckets.get(gen);
      // Order row so partners stay adjacent
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
        // If person has custom dragged coordinates (x, y), preserve them
        const x = person.x !== null && person.x !== undefined ? person.x : (startX + idx * (CARD_WIDTH + GAP_X));
        const y = person.y !== null && person.y !== undefined ? person.y : (gen * (CARD_HEIGHT + GAP_Y));
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

    // Compute union junction coordinates and child branches
    const renderedUnions = [];
    for (const u of this.unions) {
      const pA = nodeCoords.get(u.partnerA);
      const pB = u.partnerB ? nodeCoords.get(u.partnerB) : null;
      if (!pA) continue;

      let junctionX, junctionY;
      if (pB) {
        // Center between partners
        const leftP = pA.x < pB.x ? pA : pB;
        const rightP = pA.x < pB.x ? pB : pA;
        junctionX = (leftP.x + leftP.width + rightP.x) / 2;
        junctionY = leftP.y + leftP.height / 2;
      } else {
        // Single parent bottom
        junctionX = pA.x + pA.width / 2;
        junctionY = pA.y + pA.height;
      }

      const children = u.children.map(cid => nodeCoords.get(cid)).filter(Boolean);

      renderedUnions.push({
        id: u.id,
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
