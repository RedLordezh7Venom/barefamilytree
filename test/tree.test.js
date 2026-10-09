// test/tree.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FamilyTree } from '../core/tree.js';

test('addPerson and deduplication', () => {
  const tree = new FamilyTree();
  const mom = tree.addPerson('mom');
  assert.equal(mom.name, 'mom');
  const dup = tree.addPerson('MOM');
  assert.equal(dup.id, mom.id);
  assert.equal(tree.people.size, 1);
});

test('union of 2 parents makes a child (and siblings inferred)', () => {
  const tree = new FamilyTree();
  tree.addUnion('mom', 'dad');
  tree.addChild('mom', 'dad', 'egg');
  tree.addChild('mom', 'dad', 'egg2');

  const egg = tree.getPerson('egg');
  const egg2 = tree.getPerson('egg2');
  const mom = tree.getPerson('mom');
  const dad = tree.getPerson('dad');

  // Both parents confirmed
  const parents = tree.getParents(egg.id).map(p => p.id);
  assert.ok(parents.includes(mom.id) && parents.includes(dad.id));

  // Both children confirmed
  const kids = tree.getChildren(mom.id).map(c => c.id);
  assert.deepEqual(kids.sort(), [egg.id, egg2.id].sort());

  // Siblings inferred from union
  const sibs = tree.getSiblings(egg.id).map(s => s.id);
  assert.deepEqual(sibs, [egg2.id]);
});

test('deletePerson cleans up unions and references', () => {
  const tree = new FamilyTree();
  tree.addChild('mom', 'dad', 'egg');
  assert.equal(tree.people.size, 3);

  tree.deletePerson('dad');
  assert.equal(tree.people.size, 2);
  assert.equal(tree.getPerson('dad'), null);

  const eggParents = tree.getParents(tree.getPerson('egg').id).map(p => p.name);
  assert.deepEqual(eggParents, ['mom']);
});

test('findPath traces relationship between parents and kids', () => {
  const tree = new FamilyTree();
  tree.addChild('mom', 'dad', 'egg');
  const res = tree.findPath('dad', 'egg');
  assert.ok(res.path);
  assert.deepEqual(res.path, ['dad', 'egg']);
});
