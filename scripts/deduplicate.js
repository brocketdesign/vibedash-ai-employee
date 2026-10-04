const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Run: MONGODB_URI=... node scripts/deduplicate.js');
  process.exit(1);
}

async function dedup() {
  const client = await MongoClient.connect(uri);
  const db = client.db('vibedash');

  const projects = await db.collection('projects').find({}).toArray();
  console.log('Total projects:', projects.length);

  // Group by userId + githubRepo
  const groups = {};
  for (const p of projects) {
    const key = p.userId + '::' + (p.githubRepo || p._id.toString());
    if (groups[key] === undefined) groups[key] = [];
    groups[key].push(p);
  }

  const dupeKeys = Object.entries(groups).filter(([, v]) => v.length > 1);
  console.log('Duplicate groups:', dupeKeys.length);

  const allIdsToDelete = [];
  for (const [, copies] of dupeKeys) {
    copies.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    console.log('  Repo:', copies[0].githubRepo || copies[0].name, '- copies:', copies.length);
    for (let i = 1; i < copies.length; i++) {
      allIdsToDelete.push(copies[i]._id);
    }
  }

  if (allIdsToDelete.length > 0) {
    console.log('Deleting', allIdsToDelete.length, 'duplicates in one batch...');
    const result = await db.collection('projects').deleteMany({ _id: { $in: allIdsToDelete } });
    console.log('Deleted:', result.deletedCount);
  } else {
    console.log('No duplicates found.');
  }

  const remaining = await db.collection('projects').countDocuments();
  console.log('Remaining projects:', remaining);

  await client.close();
  process.exit(0);
}

dedup().catch(console.error);
