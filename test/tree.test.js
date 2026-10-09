// test/tree.test.js - Unit tests for FamilyTree
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FamilyTree } from '../core/tree.js';

test('addPerson creates and normalizes nodes', () => {
  const tree = new FamilyTree();
  const alice = tree.addPerson('Alice');
  assert.equal(alice.name, 'Alice');
  assert.ok(alice.id);

  // Deduplication
  const duplicate = tree.addPerson('alice ');
  assert.equal(duplicate.id, alice.id);
  assert.equal(tree.people.size, 1);
});

test('addRelation establishes parent-child and spouse connections', () => {
  const tree = new FamilyTree();
  tree.addRelation('Grandpa', 'parent', 'Dad');
  tree.addRelation('Dad', 'spouse', 'Mom');
  tree.addRelation('Dad', 'parent', 'Son');

  const dad = tree.getPerson('Dad');
  const grandpa = tree.getPerson('Grandpa');
  const mom = tree.getPerson('Mom');
  const son = tree.getPerson('Son');

  assert.deepEqual(tree.getParents(dad.id).map(p => p.id), [grandpa.id]);
  assert.deepEqual(tree.getSpouses(dad.id).map(p => p.id), [mom.id]);
  assert.deepEqual(tree.getChildren(dad.id).map(p => p.id), [son.id]);
});

test('subtrees merge cleanly when joining people across groups', () => {
  const tree = new FamilyTree();
  // Family A
  tree.addRelation('Arthur', 'parent', 'Bob');
  // Family B
  tree.addRelation('Catherine', 'parent', 'David');

  // Merging two disjoint trees via marriage
  tree.addRelation('Bob', 'spouse', 'David');

  assert.equal(tree.people.size, 4);
  assert.equal(tree.relations.length, 3);

  // Path from Arthur to Catherine should now be found
  const kinship = tree.findPath('Arthur', 'Catherine');
  assert.ok(kinship.path);
  assert.deepEqual(kinship.path, ['Arthur', 'Bob', 'David', 'Catherine']);
});

test('computeLayout calculates generational depths', () => {
  const tree = new FamilyTree();
  tree.addRelation('Elder', 'parent', 'Parent');
  tree.addRelation('Parent', 'parent', 'Child');

  const layout = tree.computeLayout();
  assert.equal(layout.nodes.length, 3);
  assert.equal(layout.edges.length, 2);

  const elder = layout.nodes.find(n => n.name === 'Elder');
  const parent = layout.nodes.find(n => n.name === 'Parent');
  const child = layout.nodes.find(n => n.name === 'Child');

  assert.equal(elder.gen, 0);
  assert.equal(parent.gen, 1);
  assert.equal(child.gen, 2);
  assert.ok(elder.y < parent.y && parent.y < child.y);
});
