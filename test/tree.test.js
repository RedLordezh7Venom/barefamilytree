// test/tree.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FamilyTree } from '../core/tree.js';

test('addPerson creates nodes', () => {
  const tree = new FamilyTree();
  const p1 = tree.addPerson('Alice');
  assert.equal(p1.name, 'Alice');
  assert.equal(tree.people.size, 1);
});

test('undo union and reset relations', () => {
  const tree = new FamilyTree();
  const u = tree.addUnion('mom', 'dad');
  tree.addChild('mom', 'dad', 'egg');
  assert.equal(tree.unions.length, 1);

  // Undo specific union
  tree.removeUnion(u.id);
  assert.equal(tree.unions.length, 0);
  assert.equal(tree.people.size, 3); // mom, dad, egg still exist!

  // Reconnect and reset relations
  tree.addChild('mom', 'dad', 'egg');
  assert.equal(tree.unions.length, 1);
  tree.resetRelations();
  assert.equal(tree.unions.length, 0);
  assert.equal(tree.people.size, 3);
});

test('unlinkChild removes child from union', () => {
  const tree = new FamilyTree();
  tree.addChild('mom', 'dad', 'egg');
  const egg = tree.getPerson('egg');
  assert.equal(tree.getParents(egg.id).length, 2);

  tree.unlinkChild(egg.id);
  assert.equal(tree.getParents(egg.id).length, 0);
  assert.equal(tree.people.size, 3);
});
