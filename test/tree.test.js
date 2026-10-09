// test/tree.test.js - Unit tests for Union-based FamilyTree
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FamilyTree } from '../core/tree.js';

test('addPerson creates and normalizes nodes', () => {
  const tree = new FamilyTree();
  const mom = tree.addPerson('Mom');
  assert.equal(mom.name, 'Mom');
  assert.ok(mom.id);

  // Deduplication
  const duplicate = tree.addPerson('mom ');
  assert.equal(duplicate.id, mom.id);
  assert.equal(tree.people.size, 1);
});

test('unions and children model parents, children, and inferred siblings', () => {
  const tree = new FamilyTree();
  // Form union between Mom and Dad
  tree.getOrCreateUnion('Mom', 'Dad');
  // Add children to the union
  tree.addChild('Mom', 'egg', 'Dad');
  tree.addChild('Mom', 'egg2', 'Dad');

  const mom = tree.getPerson('Mom');
  const dad = tree.getPerson('Dad');
  const egg = tree.getPerson('egg');
  const egg2 = tree.getPerson('egg2');

  // Both Mom and Dad are parents
  const eggParents = tree.getParents(egg.id).map(p => p.id);
  assert.ok(eggParents.includes(mom.id));
  assert.ok(eggParents.includes(dad.id));

  // Both egg and egg2 are children of Mom and Dad
  const momKids = tree.getChildren(mom.id).map(c => c.id);
  assert.deepEqual(momKids.sort(), [egg.id, egg2.id].sort());

  // Siblings are inferred automatically from sharing the union
  const eggSiblings = tree.getSiblings(egg.id).map(s => s.id);
  assert.deepEqual(eggSiblings, [egg2.id]);
});

test('subtrees merge cleanly when joining people across groups', () => {
  const tree = new FamilyTree();
  // Family A: Arthur has child Bob
  tree.addChild('Arthur', 'Bob');
  // Family B: Catherine has child David
  tree.addChild('Catherine', 'David');

  // Merge via partnership between Bob and David
  tree.getOrCreateUnion('Bob', 'David');

  // Tracing kinship from Arthur to Catherine
  const kinship = tree.findPath('Arthur', 'Catherine');
  assert.ok(kinship.path);
  assert.deepEqual(kinship.path, ['Arthur', 'Bob', 'David', 'Catherine']);
});

test('deletePerson cleans up unions and child references', () => {
  const tree = new FamilyTree();
  tree.getOrCreateUnion('Mom', 'Dad');
  tree.addChild('Mom', 'Kid', 'Dad');
  assert.equal(tree.people.size, 3);

  const deleted = tree.deletePerson('Dad');
  assert.equal(deleted, true);
  assert.equal(tree.people.size, 2);

  const kidParents = tree.getParents(tree.getPerson('Kid').id).map(p => p.name);
  assert.deepEqual(kidParents, ['Mom']);
});

test('ancestral cycles throw error and prevent infinite loops', () => {
  const tree = new FamilyTree();
  tree.addChild('Alice', 'Bob');
  tree.addChild('Bob', 'Charlie');

  // Attempting to make Alice child of Charlie must throw
  assert.throws(() => {
    tree.addChild('Charlie', 'Alice');
  }, /descendant/);
});

test('computeLayout returns union junction and children coordinates', () => {
  const tree = new FamilyTree();
  tree.getOrCreateUnion('Mom', 'Dad');
  tree.addChild('Mom', 'egg', 'Dad');
  tree.addChild('Mom', 'egg2', 'Dad');

  const layout = tree.computeLayout();
  assert.equal(layout.nodes.length, 4);
  assert.equal(layout.unions.length, 1);

  const union = layout.unions[0];
  assert.ok(union.junctionX !== undefined);
  assert.ok(union.junctionY !== undefined);
  assert.equal(union.children.length, 2);
});
