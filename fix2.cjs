const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.html')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const orig = content;
  
  content = content.replace(/setFo₹/g, 'setForm');
  content = content.replace(/paymentFo₹/g, 'paymentForm');
  content = content.replace(/Confi₹/g, 'Confirm');
  content = content.replace(/depositFo₹/g, 'depositForm');
  content = content.replace(/no₹alizeOrdermode/g, 'normalizeOrderMode');

  if (orig !== content) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
