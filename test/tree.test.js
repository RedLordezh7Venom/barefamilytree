// test/tree.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FamilyTree, HistoryTracker } from '../core/tree.js';

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

  tree.removeUnion(u.id);
  assert.equal(tree.unions.length, 0);
  assert.equal(tree.people.size, 3);

  tree.addChild('mom', 'dad', 'egg');
  assert.equal(tree.unions.length, 1);
  tree.resetRelations();
  assert.equal(tree.unions.length, 0);
  assert.equal(tree.people.size, 3);
});

test('HistoryTracker handles undo (Ctrl+Z) and redo', () => {
  const tree = new FamilyTree();
  const history = new HistoryTracker(tree);

  // Initial state: empty
  history.record();
  tree.addPerson('mom');
  assert.equal(tree.people.size, 1);

  // Undo restores empty
  assert.equal(history.undo(), true);
  assert.equal(tree.people.size, 0);

  // Redo restores mom
  assert.equal(history.redo(), true);
  assert.equal(tree.people.size, 1);
  assert.equal(tree.getPerson('mom').name, 'mom');
});
