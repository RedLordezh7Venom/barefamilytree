// core/tree.js - Bare family tree data structure and graph operations

export class FamilyTree {
  constructor() {
    this.people = new Map(); // id -> { id, name }
    this.relations = []; // { from, to, type } where type: 'parent' | 'spouse'
  }

  // Helper to normalize names
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
    const p = this.getPerson(name);
    if (!p) return false;
    this.people.delete(p.id);
    this.relations = this.relations.filter(r => r.from !== p.id && r.to !== p.id);
    return true;
  }

  addRelation(nameA, relType, nameB) {
    const a = this.getOrCreate(nameA);
    const b = this.getOrCreate(nameB);
    if (a.id === b.id) throw new Error('Cannot relate a person to themselves');

    const type = relType.toLowerCase().trim();

    if (type === 'parent') {
      // a is parent of b
      this._addDirectedEdge(a.id, b.id, 'parent');
    } else if (type === 'child') {
      // a is child of b => b is parent of a
      this._addDirectedEdge(b.id, a.id, 'parent');
    } else if (type === 'spouse' || type === 'partner') {
      this._addSpouseEdge(a.id, b.id);
    } else if (type === 'sibling') {
      // Find parents of B or create a shared parent anchor
      const parentsB = this.getParents(b.id);
      if (parentsB.length > 0) {
        parentsB.forEach(p => this._addDirectedEdge(p.id, a.id, 'parent'));
      } else {
        const parentsA = this.getParents(a.id);
        if (parentsA.length > 0) {
          parentsA.forEach(p => this._addDirectedEdge(p.id, b.id, 'parent'));
        } else {
          // create a generic parent node
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

  // Find shortest relationship path between two people using BFS
  findPath(nameA, nameB) {
    const start = this.getPerson(nameA);
    const end = this.getPerson(nameB);
    if (!start) return { error: `Person "${nameA}" not found` };
    if (!end) return { error: `Person "${nameB}" not found` };
    if (start.id === end.id) return { path: [start.name], description: 'Same person' };

    const queue = [[start.id]];
    const visited = new Set([start.id]);
    const edgeTaken = new Map(); // key `${u}->${v}` => description

    while (queue.length > 0) {
      const currentPath = queue.shift();
      const curr = currentPath[currentPath.length - 1];

      if (curr === end.id) {
        // Build readable description
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
          steps: textSteps,
          description: textSteps.join(' ➔ ')
        };
      }

      // Check all neighbors: parents, children, spouses
      const neighbors = [];
      for (const p of this.getParents(curr)) {
        neighbors.push({ id: p.id, desc: 'is child of' });
      }
      for (const c of this.getChildren(curr)) {
        neighbors.push({ id: c.id, desc: 'is parent of' });
      }
      for (const s of this.getSpouses(curr)) {
        neighbors.push({ id: s.id, desc: 'is spouse of' });
      }

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

  // Compute 2D generational layout coordinates
  computeLayout() {
    const nodes = Array.from(this.people.values());
    if (nodes.length === 0) return { nodes: [], edges: [] };

    // Find generations: roots (no parents) start at gen 0
    const genMap = new Map();
    const visited = new Set();

    // Assign generation depths (guarded against recursive loops)
    const assignGen = (id, currentGen) => {
      if (currentGen > 50) return; // Prevent runaway recursion
      const prev = genMap.get(id) ?? -Infinity;
      if (currentGen > prev) {
        genMap.set(id, currentGen);
      }
      if (visited.has(`${id}:${currentGen}`)) return;
      visited.add(`${id}:${currentGen}`);

      // Spouses share generation
      for (const sp of this.getSpouses(id)) {
        const spGen = Math.max(genMap.get(sp.id) ?? -Infinity, currentGen);
        genMap.set(sp.id, spGen);
        genMap.set(id, spGen);
      }

      // Children are gen + 1
      for (const ch of this.getChildren(id)) {
        assignGen(ch.id, (genMap.get(id) ?? currentGen) + 1);
      }
    };

    // Start with people who have no parents
    for (const node of nodes) {
      if (this.getParents(node.id).length === 0) {
        assignGen(node.id, 0);
      }
    }
    // Any remaining disconnected nodes
    for (const node of nodes) {
      if (!genMap.has(node.id)) {
        assignGen(node.id, 0);
      }
    }

    // Group nodes by generation
    const genBuckets = new Map();
    for (const node of nodes) {
      const g = genMap.get(node.id) || 0;
      if (!genBuckets.has(g)) genBuckets.set(g, []);
      genBuckets.get(g).push(node);
    }

    // Calculate (x, y) coordinates
    const CARD_WIDTH = 140;
    const CARD_HEIGHT = 50;
    const GAP_X = 60;
    const GAP_Y = 90;

    const positionedNodes = [];
    const nodeCoords = new Map();

    const sortedGens = Array.from(genBuckets.keys()).sort((a, b) => a - b);
    sortedGens.forEach((gen) => {
      const rawRow = genBuckets.get(gen);
      // Group spouses adjacently
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

    // Map edges with coordinates
    const positionedEdges = [];
    for (const rel of this.relations) {
      const from = nodeCoords.get(rel.from);
      const to = nodeCoords.get(rel.to);
      if (from && to) {
        positionedEdges.push({
          type: rel.type,
          from,
          to
        });
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
