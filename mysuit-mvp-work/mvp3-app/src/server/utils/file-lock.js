const active = new Set();

function acquire(key) {
  if (active.has(key)) return false;
  active.add(key);
  return true;
}

function release(key) { active.delete(key); }
function isLocked(key) { return active.has(key); }

module.exports = { acquire, release, isLocked };
